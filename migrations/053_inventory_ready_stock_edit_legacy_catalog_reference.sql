-- Keep a unit's catalog snapshot when only its physical details change.
-- A replacement catalog model must still be active and published.

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

REVOKE ALL ON FUNCTION public.inventory_update_ready_stock_unit(UUID, TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_update_ready_stock_unit(UUID, TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID) TO service_role;
