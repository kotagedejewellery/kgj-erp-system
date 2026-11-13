-- Classify a physical ready-stock ring without changing order workflow or allocation behavior.

ALTER TABLE public.inventory_stock_units
  ADD COLUMN IF NOT EXISTS ring_gender VARCHAR(30) NOT NULL DEFAULT 'unspecified';

ALTER TABLE public.inventory_stock_units
  DROP CONSTRAINT IF EXISTS inventory_stock_units_ring_gender_check;

ALTER TABLE public.inventory_stock_units
  ADD CONSTRAINT inventory_stock_units_ring_gender_check
  CHECK (ring_gender IN ('pria', 'wanita', 'unisex', 'unspecified'));

CREATE OR REPLACE FUNCTION public.inventory_record_ready_stock_opening(
  p_unit_code TEXT,
  p_brand_id INTEGER,
  p_source_product_id INTEGER,
  p_source_material_id INTEGER,
  p_location_id UUID,
  p_size TEXT,
  p_material_description TEXT,
  p_actual_weight_grams NUMERIC,
  p_actor_id UUID,
  p_ring_gender TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_stock_unit_id UUID;
  v_catalog_name VARCHAR(255);
  v_catalog_sku VARCHAR(120);
  v_catalog_cover_image_url TEXT;
  v_requires_unit_weight BOOLEAN;
BEGIN
  IF NULLIF(BTRIM(p_unit_code), '') IS NULL
    OR p_brand_id IS NULL OR p_brand_id <= 0
    OR p_source_product_id IS NULL OR p_source_product_id <= 0
    OR p_source_material_id IS NULL OR p_source_material_id <= 0
    OR p_location_id IS NULL
    OR NULLIF(BTRIM(p_size), '') IS NULL
    OR NULLIF(BTRIM(p_material_description), '') IS NULL
    OR BTRIM(p_ring_gender) NOT IN ('pria', 'wanita', 'unisex')
    OR (p_actual_weight_grams IS NOT NULL AND p_actual_weight_grams <= 0)
  THEN RAISE EXCEPTION 'inventory_ready_stock_opening_invalid'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE id = p_location_id AND location_type = 'warehouse' AND is_active) THEN
    RAISE EXCEPTION 'inventory_ready_stock_warehouse_invalid';
  END IF;

  SELECT requires_unit_weight INTO v_requires_unit_weight
  FROM public.inventory_materials WHERE source_material_id = p_source_material_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_material_mapping_missing'; END IF;
  IF v_requires_unit_weight AND p_actual_weight_grams IS NULL THEN RAISE EXCEPTION 'inventory_ready_stock_weight_missing'; END IF;

  SELECT name, sku, cover_image_url INTO v_catalog_name, v_catalog_sku, v_catalog_cover_image_url
  FROM public.inventory_catalog_products
  WHERE source_system = 'yii2' AND source_product_id = p_source_product_id AND source_available AND is_published;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_catalog_product_missing'; END IF;

  INSERT INTO public.inventory_stock_units (
    unit_code, brand_id, source_product_id, source_material_id, location_id, size, material_description,
    actual_weight_grams, ring_gender, catalog_product_name, catalog_product_sku, catalog_cover_image_url
  ) VALUES (
    UPPER(BTRIM(p_unit_code)), p_brand_id, p_source_product_id, p_source_material_id, p_location_id, BTRIM(p_size), BTRIM(p_material_description),
    p_actual_weight_grams, BTRIM(p_ring_gender), v_catalog_name, v_catalog_sku, v_catalog_cover_image_url
  ) RETURNING id INTO v_stock_unit_id;

  INSERT INTO public.inventory_mutations (mutation_type, stock_unit_id, quantity_grams, to_location_id, reason, created_by)
  VALUES ('opening', v_stock_unit_id, p_actual_weight_grams, p_location_id, COALESCE(NULLIF(BTRIM(p_reason), ''), 'Stok awal ready-stock'), p_actor_id);
  RETURN v_stock_unit_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_update_ready_stock_unit(
  p_unit_id UUID,
  p_unit_code TEXT,
  p_brand_id INTEGER,
  p_source_product_id INTEGER,
  p_source_material_id INTEGER,
  p_location_id UUID,
  p_size TEXT,
  p_material_description TEXT,
  p_actual_weight_grams NUMERIC,
  p_condition TEXT,
  p_ring_gender TEXT,
  p_actor_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_unit public.inventory_stock_units%ROWTYPE;
  v_catalog_name VARCHAR(255);
  v_catalog_sku VARCHAR(120);
  v_catalog_cover_image_url TEXT;
  v_requires_unit_weight BOOLEAN;
BEGIN
  IF NULLIF(BTRIM(p_unit_code), '') IS NULL
    OR p_brand_id IS NULL OR p_brand_id <= 0
    OR p_source_product_id IS NULL OR p_source_product_id <= 0
    OR p_source_material_id IS NULL OR p_source_material_id <= 0
    OR p_location_id IS NULL
    OR NULLIF(BTRIM(p_size), '') IS NULL
    OR NULLIF(BTRIM(p_material_description), '') IS NULL
    OR NULLIF(BTRIM(p_condition), '') IS NULL
    OR BTRIM(p_ring_gender) NOT IN ('pria', 'wanita', 'unisex', 'unspecified')
    OR (p_actual_weight_grams IS NOT NULL AND p_actual_weight_grams <= 0)
  THEN RAISE EXCEPTION 'inventory_ready_stock_update_invalid'; END IF;

  SELECT * INTO v_unit FROM public.inventory_stock_units WHERE id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_stock_unit_not_found'; END IF;
  IF v_unit.status NOT IN ('available', 'inspection') THEN RAISE EXCEPTION 'inventory_stock_unit_not_editable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE id = p_location_id AND location_type = 'warehouse' AND is_active) THEN
    RAISE EXCEPTION 'inventory_ready_stock_warehouse_invalid';
  END IF;

  SELECT requires_unit_weight INTO v_requires_unit_weight
  FROM public.inventory_materials WHERE source_material_id = p_source_material_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_material_mapping_missing'; END IF;
  IF v_requires_unit_weight AND p_actual_weight_grams IS NULL THEN RAISE EXCEPTION 'inventory_ready_stock_weight_missing'; END IF;

  v_catalog_name := v_unit.catalog_product_name;
  v_catalog_sku := v_unit.catalog_product_sku;
  v_catalog_cover_image_url := v_unit.catalog_cover_image_url;
  IF p_source_product_id IS DISTINCT FROM v_unit.source_product_id THEN
    SELECT name, sku, cover_image_url INTO v_catalog_name, v_catalog_sku, v_catalog_cover_image_url
    FROM public.inventory_catalog_products
    WHERE source_system = 'yii2' AND source_product_id = p_source_product_id AND source_available AND is_published;
    IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_catalog_product_missing'; END IF;
  END IF;

  UPDATE public.inventory_stock_units
  SET unit_code = UPPER(BTRIM(p_unit_code)), brand_id = p_brand_id, source_product_id = p_source_product_id,
      source_material_id = p_source_material_id, location_id = p_location_id, size = BTRIM(p_size),
      material_description = BTRIM(p_material_description), actual_weight_grams = p_actual_weight_grams,
      condition = BTRIM(p_condition), ring_gender = BTRIM(p_ring_gender), catalog_product_name = v_catalog_name,
      catalog_product_sku = v_catalog_sku, catalog_cover_image_url = v_catalog_cover_image_url, updated_at = now()
  WHERE id = p_unit_id;

  IF v_unit.location_id IS DISTINCT FROM p_location_id THEN
    INSERT INTO public.inventory_mutations (mutation_type, stock_unit_id, quantity_grams, from_location_id, to_location_id, reason, created_by)
    VALUES ('transfer', p_unit_id, v_unit.actual_weight_grams, v_unit.location_id, p_location_id, 'Pindah gudang ready-stock', p_actor_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_adjust_ready_stock_quantity(
  p_brand_id INTEGER,
  p_source_product_id INTEGER,
  p_source_material_id INTEGER,
  p_location_id UUID,
  p_size TEXT,
  p_condition TEXT,
  p_ring_gender TEXT,
  p_quantity_change INTEGER,
  p_reason TEXT,
  p_actor_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_material public.inventory_materials%ROWTYPE;
  v_catalog public.inventory_catalog_products%ROWTYPE;
  v_unit public.inventory_stock_units%ROWTYPE;
  v_unit_id UUID;
  v_quantity INTEGER := ABS(p_quantity_change);
  v_changed INTEGER := 0;
  v_unit_code TEXT;
BEGIN
  IF p_brand_id IS NULL OR p_brand_id <= 0 OR p_source_product_id IS NULL OR p_source_product_id <= 0
    OR p_source_material_id IS NULL OR p_source_material_id <= 0 OR p_location_id IS NULL
    OR NULLIF(BTRIM(p_size), '') IS NULL OR NULLIF(BTRIM(p_condition), '') IS NULL
    OR BTRIM(p_ring_gender) NOT IN ('pria', 'wanita', 'unisex', 'unspecified')
    OR p_quantity_change IS NULL OR p_quantity_change = 0 OR ABS(p_quantity_change) > 1000
    OR NULLIF(BTRIM(p_reason), '') IS NULL OR p_actor_id IS NULL
  THEN RAISE EXCEPTION 'inventory_ready_stock_quantity_invalid'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE id = p_location_id AND location_type = 'warehouse' AND is_active) THEN
    RAISE EXCEPTION 'inventory_ready_stock_warehouse_invalid';
  END IF;
  SELECT * INTO v_material FROM public.inventory_materials WHERE source_material_id = p_source_material_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_material_mapping_missing'; END IF;
  IF v_material.requires_unit_weight THEN RAISE EXCEPTION 'inventory_ready_stock_quantity_weight_required'; END IF;

  IF p_quantity_change > 0 THEN
    IF BTRIM(p_ring_gender) = 'unspecified' THEN RAISE EXCEPTION 'inventory_ready_stock_ring_gender_required'; END IF;
    SELECT * INTO v_catalog FROM public.inventory_catalog_products
    WHERE source_system = 'yii2' AND source_product_id = p_source_product_id AND source_available AND is_published;
    IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_catalog_product_missing'; END IF;
    FOR v_changed IN 1..v_quantity LOOP
      v_unit_code := 'QTY-' || p_brand_id || '-' || p_source_product_id || '-' || regexp_replace(UPPER(BTRIM(p_size)), '[^A-Z0-9]+', '-', 'g') || '-' || SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12);
      INSERT INTO public.inventory_stock_units (
        unit_code, brand_id, source_product_id, source_material_id, location_id, size, material_description,
        actual_weight_grams, condition, ring_gender, catalog_product_name, catalog_product_sku, catalog_cover_image_url
      ) VALUES (
        v_unit_code, p_brand_id, p_source_product_id, p_source_material_id, p_location_id, BTRIM(p_size), v_material.name,
        NULL, BTRIM(p_condition), BTRIM(p_ring_gender), v_catalog.name, v_catalog.sku, v_catalog.cover_image_url
      ) RETURNING id INTO v_unit_id;
      INSERT INTO public.inventory_mutations (mutation_type, stock_unit_id, quantity_grams, to_location_id, reason, created_by)
      VALUES ('receipt', v_unit_id, NULL, p_location_id, 'Tambah stok ready-stock: ' || BTRIM(p_reason), p_actor_id);
    END LOOP;
    RETURN v_quantity;
  END IF;

  FOR v_unit IN SELECT * FROM public.inventory_stock_units
    WHERE brand_id = p_brand_id AND source_product_id = p_source_product_id AND source_material_id = p_source_material_id
      AND location_id = p_location_id AND size = BTRIM(p_size) AND condition = BTRIM(p_condition)
      AND ring_gender = BTRIM(p_ring_gender) AND status = 'available'
    ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT v_quantity
  LOOP
    UPDATE public.inventory_stock_units SET status = 'retired', updated_at = now() WHERE id = v_unit.id;
    INSERT INTO public.inventory_mutations (mutation_type, stock_unit_id, quantity_grams, from_location_id, reason, created_by)
    VALUES ('retire_finished_good', v_unit.id, NULL, v_unit.location_id, 'Kurangi stok ready-stock: ' || BTRIM(p_reason), p_actor_id);
    v_changed := v_changed + 1;
  END LOOP;
  IF v_changed <> v_quantity THEN RAISE EXCEPTION 'inventory_ready_stock_quantity_insufficient'; END IF;
  RETURN v_changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_add_ready_stock_variations(
  p_brand_id INTEGER,
  p_source_product_id INTEGER,
  p_source_material_id INTEGER,
  p_location_id UUID,
  p_condition TEXT,
  p_ring_gender TEXT,
  p_variations JSONB,
  p_reason TEXT,
  p_actor_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
  v_size TEXT;
  v_quantity INTEGER;
  v_total INTEGER := 0;
BEGIN
  IF p_brand_id IS NULL OR p_brand_id <= 0 OR p_source_product_id IS NULL OR p_source_product_id <= 0
    OR p_source_material_id IS NULL OR p_source_material_id <= 0 OR p_location_id IS NULL
    OR NULLIF(BTRIM(p_condition), '') IS NULL OR BTRIM(p_ring_gender) NOT IN ('pria', 'wanita', 'unisex')
    OR NULLIF(BTRIM(p_reason), '') IS NULL OR p_actor_id IS NULL
    OR jsonb_typeof(p_variations) <> 'array' OR jsonb_array_length(p_variations) = 0 OR jsonb_array_length(p_variations) > 50
  THEN RAISE EXCEPTION 'inventory_ready_stock_variations_invalid'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_variations) AS variation(value) GROUP BY NULLIF(BTRIM(variation.value->>'size'), '') HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'inventory_ready_stock_variation_duplicate_size';
  END IF;
  FOR v_row IN SELECT value FROM jsonb_array_elements(p_variations) LOOP
    v_size := NULLIF(BTRIM(v_row->>'size'), '');
    BEGIN v_quantity := NULLIF(v_row->>'quantity', '')::INTEGER;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'inventory_ready_stock_variations_invalid'; END;
    IF v_size IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 1000 OR v_total + v_quantity > 1000 THEN
      RAISE EXCEPTION 'inventory_ready_stock_variations_invalid';
    END IF;
    PERFORM public.inventory_adjust_ready_stock_quantity(
      p_brand_id, p_source_product_id, p_source_material_id, p_location_id, v_size,
      BTRIM(p_condition), BTRIM(p_ring_gender), v_quantity, BTRIM(p_reason), p_actor_id
    );
    v_total := v_total + v_quantity;
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_record_ready_stock_opening(TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_record_ready_stock_opening(TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, UUID, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.inventory_update_ready_stock_unit(UUID, TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_update_ready_stock_unit(UUID, TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.inventory_adjust_ready_stock_quantity(INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_adjust_ready_stock_quantity(INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.inventory_add_ready_stock_variations(INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_add_ready_stock_variations(INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, JSONB, TEXT, UUID) TO service_role;
