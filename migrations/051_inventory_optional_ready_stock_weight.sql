-- Perak ready-stock is counted per unit and is not weighed per ring.
-- Material balances remain gram-based and always require a positive quantity.

ALTER TABLE public.inventory_materials
  ADD COLUMN IF NOT EXISTS requires_unit_weight BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.inventory_mutations
  ALTER COLUMN quantity_grams DROP NOT NULL;

ALTER TABLE public.inventory_mutations
  DROP CONSTRAINT IF EXISTS inventory_mutations_quantity_grams_check;

ALTER TABLE public.inventory_mutations
  ADD CONSTRAINT inventory_mutations_quantity_grams_by_item_check
  CHECK (
    (material_id IS NOT NULL AND quantity_grams IS NOT NULL AND quantity_grams > 0)
    OR (stock_unit_id IS NOT NULL AND (quantity_grams IS NULL OR quantity_grams > 0))
  );

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
    OR (p_actual_weight_grams IS NOT NULL AND p_actual_weight_grams <= 0)
  THEN
    RAISE EXCEPTION 'inventory_ready_stock_opening_invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_locations
    WHERE id = p_location_id AND location_type = 'warehouse' AND is_active
  ) THEN
    RAISE EXCEPTION 'inventory_ready_stock_warehouse_invalid';
  END IF;

  SELECT requires_unit_weight INTO v_requires_unit_weight
  FROM public.inventory_materials
  WHERE source_material_id = p_source_material_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_ready_stock_material_mapping_missing';
  END IF;
  IF v_requires_unit_weight AND p_actual_weight_grams IS NULL THEN
    RAISE EXCEPTION 'inventory_ready_stock_weight_missing';
  END IF;

  SELECT name, sku, cover_image_url
  INTO v_catalog_name, v_catalog_sku, v_catalog_cover_image_url
  FROM public.inventory_catalog_products
  WHERE source_system = 'yii2'
    AND source_product_id = p_source_product_id
    AND source_available
    AND is_published;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_ready_stock_catalog_product_missing';
  END IF;

  INSERT INTO public.inventory_stock_units (
    unit_code, brand_id, source_product_id, source_material_id, location_id,
    size, material_description, actual_weight_grams,
    catalog_product_name, catalog_product_sku, catalog_cover_image_url
  ) VALUES (
    UPPER(BTRIM(p_unit_code)), p_brand_id, p_source_product_id, p_source_material_id, p_location_id,
    BTRIM(p_size), BTRIM(p_material_description), p_actual_weight_grams,
    v_catalog_name, v_catalog_sku, v_catalog_cover_image_url
  )
  RETURNING id INTO v_stock_unit_id;

  INSERT INTO public.inventory_mutations (
    mutation_type, stock_unit_id, quantity_grams, to_location_id, reason, created_by
  ) VALUES (
    'opening', v_stock_unit_id, p_actual_weight_grams, p_location_id,
    COALESCE(NULLIF(BTRIM(p_reason), ''), 'Stok awal ready-stock'), p_actor_id
  );

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
    OR (p_actual_weight_grams IS NOT NULL AND p_actual_weight_grams <= 0)
    OR NULLIF(BTRIM(p_condition), '') IS NULL
  THEN
    RAISE EXCEPTION 'inventory_ready_stock_update_invalid';
  END IF;

  SELECT * INTO v_unit FROM public.inventory_stock_units WHERE id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_stock_unit_not_found'; END IF;
  IF v_unit.status NOT IN ('available', 'inspection') THEN RAISE EXCEPTION 'inventory_stock_unit_not_editable'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_locations
    WHERE id = p_location_id AND location_type = 'warehouse' AND is_active
  ) THEN RAISE EXCEPTION 'inventory_ready_stock_warehouse_invalid'; END IF;

  SELECT requires_unit_weight INTO v_requires_unit_weight
  FROM public.inventory_materials
  WHERE source_material_id = p_source_material_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_material_mapping_missing'; END IF;
  IF v_requires_unit_weight AND p_actual_weight_grams IS NULL THEN RAISE EXCEPTION 'inventory_ready_stock_weight_missing'; END IF;

  SELECT name, sku, cover_image_url INTO v_catalog_name, v_catalog_sku, v_catalog_cover_image_url
  FROM public.inventory_catalog_products
  WHERE source_system = 'yii2' AND source_product_id = p_source_product_id AND source_available AND is_published;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_catalog_product_missing'; END IF;

  UPDATE public.inventory_stock_units
  SET unit_code = UPPER(BTRIM(p_unit_code)), brand_id = p_brand_id, source_product_id = p_source_product_id,
      source_material_id = p_source_material_id, location_id = p_location_id, size = BTRIM(p_size),
      material_description = BTRIM(p_material_description), actual_weight_grams = p_actual_weight_grams,
      condition = BTRIM(p_condition), catalog_product_name = v_catalog_name, catalog_product_sku = v_catalog_sku,
      catalog_cover_image_url = v_catalog_cover_image_url, updated_at = now()
  WHERE id = p_unit_id;

  IF v_unit.location_id IS DISTINCT FROM p_location_id THEN
    INSERT INTO public.inventory_mutations (
      mutation_type, stock_unit_id, quantity_grams, from_location_id, to_location_id, reason, created_by
    ) VALUES (
      'transfer', p_unit_id, v_unit.actual_weight_grams, v_unit.location_id, p_location_id,
      'Pindah gudang ready-stock', p_actor_id
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_allocate_ready_stock_for_approval(
  p_order_id UUID,
  p_actor_id UUID,
  p_stock_unit_id UUID,
  p_remarks TEXT DEFAULT NULL
)
RETURNS TABLE (legacy_id INTEGER, kode_order VARCHAR)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tracking public.tracking_stages%ROWTYPE;
  v_order public.legacy_orders%ROWTYPE;
  v_unit public.inventory_stock_units%ROWTYPE;
  v_component JSONB;
  v_component_count INTEGER := 0;
  v_order_material_id INTEGER;
  v_order_size VARCHAR(30);
  v_requires_unit_weight BOOLEAN;
BEGIN
  SELECT * INTO v_tracking FROM public.tracking_stages WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_tracking.current_stage <> 'approval_penerimaan_order' THEN RAISE EXCEPTION 'inventory_issue_requires_approval_penerimaan_order'; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_order_issues WHERE order_id = p_order_id) THEN RAISE EXCEPTION 'inventory_already_issued'; END IF;
  SELECT * INTO v_order FROM public.legacy_orders WHERE id = p_order_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR v_order.id_produk IS NULL THEN RAISE EXCEPTION 'inventory_ready_stock_product_missing'; END IF;

  FOR v_component IN SELECT value FROM jsonb_array_elements(v_order.komponen) LOOP
    IF COALESCE(v_component->>'id_jenis_bahan', '') = '' THEN CONTINUE; END IF;
    v_component_count := v_component_count + 1;
    IF v_component_count > 1 THEN RAISE EXCEPTION 'inventory_ready_stock_components_ambiguous'; END IF;
    v_order_material_id := NULLIF(v_component->>'id_jenis_bahan', '')::INTEGER;
    v_order_size := NULLIF(BTRIM(v_component->>'ukuran'), '');
  END LOOP;
  IF v_component_count <> 1 OR v_order_size IS NULL THEN RAISE EXCEPTION 'inventory_ready_stock_details_missing'; END IF;

  SELECT * INTO v_unit FROM public.inventory_stock_units WHERE id = p_stock_unit_id FOR UPDATE;
  IF NOT FOUND OR v_unit.status <> 'available' THEN RAISE EXCEPTION 'inventory_stock_unit_unavailable'; END IF;
  IF v_unit.brand_id <> v_order.id_brand THEN RAISE EXCEPTION 'inventory_stock_unit_brand_mismatch'; END IF;
  IF v_unit.source_product_id IS DISTINCT FROM v_order.id_produk THEN RAISE EXCEPTION 'inventory_stock_unit_product_mismatch'; END IF;
  IF v_unit.source_material_id IS NULL OR v_unit.source_material_id <> v_order_material_id THEN RAISE EXCEPTION 'inventory_stock_unit_material_mismatch'; END IF;
  IF v_unit.size IS NULL OR v_unit.size <> v_order_size THEN RAISE EXCEPTION 'inventory_stock_unit_size_mismatch'; END IF;

  SELECT requires_unit_weight INTO v_requires_unit_weight
  FROM public.inventory_materials WHERE source_material_id = v_unit.source_material_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_material_mapping_missing'; END IF;
  IF v_requires_unit_weight AND (v_unit.actual_weight_grams IS NULL OR v_unit.actual_weight_grams <= 0) THEN
    RAISE EXCEPTION 'inventory_stock_unit_weight_missing';
  END IF;

  UPDATE public.inventory_stock_units SET status = 'allocated', allocated_order_id = p_order_id, allocated_at = now(), updated_at = now() WHERE id = p_stock_unit_id;
  INSERT INTO public.inventory_order_issues (order_id, issue_type, issued_by) VALUES (p_order_id, 'ready_stock', p_actor_id);
  INSERT INTO public.inventory_mutations (mutation_type, stock_unit_id, quantity_grams, from_location_id, to_location_id, order_id, reason, created_by)
  VALUES ('allocate_finished_good', p_stock_unit_id, v_unit.actual_weight_grams, v_unit.location_id, v_unit.location_id, p_order_id, p_remarks, p_actor_id);
  UPDATE public.tracking_stages SET current_stage = 'racik_bahan', stage_status = 'in_progress', updated_at = now(), updated_by = p_actor_id WHERE order_id = p_order_id;
  INSERT INTO public.stage_history (order_id, stage, status, note, changed_by, created_at)
  VALUES (p_order_id, 'racik_bahan', 'completed', CONCAT('Approved with ready-stock allocation', CASE WHEN p_remarks IS NULL THEN '' ELSE ': ' || p_remarks END), p_actor_id, now());
  RETURN QUERY SELECT v_order.legacy_id, v_order.kode_order;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_record_ready_stock_opening(TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_record_ready_stock_opening(TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.inventory_update_ready_stock_unit(UUID, TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_update_ready_stock_unit(UUID, TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.inventory_allocate_ready_stock_for_approval(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_allocate_ready_stock_for_approval(UUID, UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.inventory_import_ready_stock_opening(
  p_batch_code TEXT,
  p_brand_id INTEGER,
  p_location_id UUID,
  p_source_material_id INTEGER,
  p_rows JSONB,
  p_actor_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_material public.inventory_materials%ROWTYPE;
  v_row JSONB;
  v_product_id INTEGER;
  v_size TEXT;
  v_quantity INTEGER;
  v_catalog public.inventory_catalog_products%ROWTYPE;
  v_unit_number INTEGER;
  v_unit_id UUID;
  v_unit_code TEXT;
  v_created INTEGER := 0;
  v_batch_code TEXT := UPPER(BTRIM(p_batch_code));
BEGIN
  IF v_batch_code !~ '^[A-Z0-9-]{3,50}$'
    OR p_brand_id IS NULL OR p_brand_id <= 0
    OR p_location_id IS NULL
    OR p_source_material_id IS NULL OR p_source_material_id <= 0
    OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0
  THEN RAISE EXCEPTION 'inventory_ready_stock_import_invalid'; END IF;

  IF EXISTS (SELECT 1 FROM public.inventory_stock_units WHERE unit_code LIKE v_batch_code || '-%') THEN
    RAISE EXCEPTION 'inventory_ready_stock_import_batch_exists';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inventory_locations WHERE id = p_location_id AND location_type = 'warehouse' AND is_active) THEN
    RAISE EXCEPTION 'inventory_ready_stock_warehouse_invalid';
  END IF;
  SELECT * INTO v_material FROM public.inventory_materials WHERE source_material_id = p_source_material_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_material_mapping_missing'; END IF;
  IF v_material.requires_unit_weight THEN RAISE EXCEPTION 'inventory_ready_stock_import_weight_required'; END IF;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT value->>'source_product_id' AS product_id, BTRIM(value->>'size') AS size
      FROM jsonb_array_elements(p_rows)
    ) rows GROUP BY product_id, size HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'inventory_ready_stock_import_duplicate_row'; END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_product_id := NULLIF(v_row->>'source_product_id', '')::INTEGER;
    v_size := NULLIF(BTRIM(v_row->>'size'), '');
    v_quantity := NULLIF(v_row->>'quantity', '')::INTEGER;
    IF v_product_id IS NULL OR v_product_id <= 0 OR v_size IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'inventory_ready_stock_import_row_invalid';
    END IF;
    SELECT * INTO v_catalog FROM public.inventory_catalog_products
    WHERE source_system = 'yii2' AND source_product_id = v_product_id AND source_available AND is_published;
    IF NOT FOUND OR NULLIF(BTRIM(v_catalog.sku), '') IS NULL THEN RAISE EXCEPTION 'inventory_ready_stock_catalog_product_missing'; END IF;

    FOR v_unit_number IN 1..v_quantity LOOP
      v_unit_code := v_batch_code || '-' || regexp_replace(UPPER(v_catalog.sku), '[^A-Z0-9]+', '-', 'g') || '-'
        || regexp_replace(UPPER(v_size), '[^A-Z0-9]+', '-', 'g') || '-' || LPAD(v_unit_number::TEXT, 3, '0');
      INSERT INTO public.inventory_stock_units (
        unit_code, brand_id, source_product_id, source_material_id, location_id, size, material_description,
        actual_weight_grams, catalog_product_name, catalog_product_sku, catalog_cover_image_url
      ) VALUES (
        v_unit_code, p_brand_id, v_product_id, p_source_material_id, p_location_id, v_size, v_material.name,
        NULL, v_catalog.name, v_catalog.sku, v_catalog.cover_image_url
      ) RETURNING id INTO v_unit_id;
      INSERT INTO public.inventory_mutations (mutation_type, stock_unit_id, quantity_grams, to_location_id, reason, created_by)
      VALUES ('opening', v_unit_id, NULL, p_location_id, 'Impor stok awal ready-stock: ' || v_batch_code, p_actor_id);
      v_created := v_created + 1;
    END LOOP;
  END LOOP;
  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_import_ready_stock_opening(TEXT, INTEGER, UUID, INTEGER, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_import_ready_stock_opening(TEXT, INTEGER, UUID, INTEGER, JSONB, UUID) TO service_role;
