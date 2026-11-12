CREATE OR REPLACE FUNCTION public.inventory_adjust_ready_stock_quantity(
  p_brand_id INTEGER,
  p_source_product_id INTEGER,
  p_source_material_id INTEGER,
  p_location_id UUID,
  p_size TEXT,
  p_condition TEXT,
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
  IF p_brand_id IS NULL OR p_brand_id <= 0
    OR p_source_product_id IS NULL OR p_source_product_id <= 0
    OR p_source_material_id IS NULL OR p_source_material_id <= 0
    OR p_location_id IS NULL
    OR NULLIF(BTRIM(p_size), '') IS NULL
    OR NULLIF(BTRIM(p_condition), '') IS NULL
    OR p_quantity_change IS NULL OR p_quantity_change = 0 OR ABS(p_quantity_change) > 1000
    OR NULLIF(BTRIM(p_reason), '') IS NULL
    OR p_actor_id IS NULL
  THEN
    RAISE EXCEPTION 'inventory_ready_stock_quantity_invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_locations
    WHERE id = p_location_id AND location_type = 'warehouse' AND is_active
  ) THEN
    RAISE EXCEPTION 'inventory_ready_stock_warehouse_invalid';
  END IF;

  SELECT * INTO v_material
  FROM public.inventory_materials
  WHERE source_material_id = p_source_material_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_material_mapping_missing'; END IF;
  IF v_material.requires_unit_weight THEN RAISE EXCEPTION 'inventory_ready_stock_quantity_weight_required'; END IF;

  IF p_quantity_change > 0 THEN
    SELECT * INTO v_catalog
    FROM public.inventory_catalog_products
    WHERE source_system = 'yii2'
      AND source_product_id = p_source_product_id
      AND source_available
      AND is_published;
    IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_catalog_product_missing'; END IF;

    FOR v_changed IN 1..v_quantity LOOP
      v_unit_code := 'QTY-' || p_brand_id || '-' || p_source_product_id || '-'
        || regexp_replace(UPPER(BTRIM(p_size)), '[^A-Z0-9]+', '-', 'g') || '-'
        || SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12);
      INSERT INTO public.inventory_stock_units (
        unit_code, brand_id, source_product_id, source_material_id, location_id,
        size, material_description, actual_weight_grams, condition,
        catalog_product_name, catalog_product_sku, catalog_cover_image_url
      ) VALUES (
        v_unit_code, p_brand_id, p_source_product_id, p_source_material_id, p_location_id,
        BTRIM(p_size), v_material.name, NULL, BTRIM(p_condition),
        v_catalog.name, v_catalog.sku, v_catalog.cover_image_url
      ) RETURNING id INTO v_unit_id;
      INSERT INTO public.inventory_mutations (
        mutation_type, stock_unit_id, quantity_grams, to_location_id, reason, created_by
      ) VALUES (
        'receipt', v_unit_id, NULL, p_location_id, 'Tambah stok ready-stock: ' || BTRIM(p_reason), p_actor_id
      );
    END LOOP;
    RETURN v_quantity;
  END IF;

  FOR v_unit IN
    SELECT * FROM public.inventory_stock_units
    WHERE brand_id = p_brand_id
      AND source_product_id = p_source_product_id
      AND source_material_id = p_source_material_id
      AND location_id = p_location_id
      AND size = BTRIM(p_size)
      AND condition = BTRIM(p_condition)
      AND status = 'available'
    ORDER BY created_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT v_quantity
  LOOP
    UPDATE public.inventory_stock_units
    SET status = 'retired', updated_at = now()
    WHERE id = v_unit.id;
    INSERT INTO public.inventory_mutations (
      mutation_type, stock_unit_id, quantity_grams, from_location_id, reason, created_by
    ) VALUES (
      'retire_finished_good', v_unit.id, NULL, v_unit.location_id, 'Kurangi stok ready-stock: ' || BTRIM(p_reason), p_actor_id
    );
    v_changed := v_changed + 1;
  END LOOP;

  IF v_changed <> v_quantity THEN RAISE EXCEPTION 'inventory_ready_stock_quantity_insufficient'; END IF;
  RETURN v_changed;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_adjust_ready_stock_quantity(INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, INTEGER, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_adjust_ready_stock_quantity(INTEGER, INTEGER, INTEGER, UUID, TEXT, TEXT, INTEGER, TEXT, UUID) TO service_role;
