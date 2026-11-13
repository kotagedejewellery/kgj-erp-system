DO $$
BEGIN
  IF to_regprocedure('public.inventory_adjust_ready_stock_quantity(integer,integer,integer,uuid,text,text,integer,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'inventory_ready_stock_variations_requires_migration_052';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_add_ready_stock_variations(
  p_brand_id INTEGER,
  p_source_product_id INTEGER,
  p_source_material_id INTEGER,
  p_location_id UUID,
  p_condition TEXT,
  p_variations JSONB,
  p_reason TEXT,
  p_actor_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_material public.inventory_materials%ROWTYPE;
  v_row JSONB;
  v_size TEXT;
  v_quantity INTEGER;
  v_total INTEGER := 0;
BEGIN
  IF p_brand_id IS NULL OR p_brand_id <= 0
    OR p_source_product_id IS NULL OR p_source_product_id <= 0
    OR p_source_material_id IS NULL OR p_source_material_id <= 0
    OR p_location_id IS NULL
    OR NULLIF(BTRIM(p_condition), '') IS NULL
    OR NULLIF(BTRIM(p_reason), '') IS NULL
    OR p_actor_id IS NULL
    OR jsonb_typeof(p_variations) <> 'array'
    OR jsonb_array_length(p_variations) = 0
    OR jsonb_array_length(p_variations) > 50
  THEN
    RAISE EXCEPTION 'inventory_ready_stock_variations_invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_locations
    WHERE id = p_location_id AND location_type = 'warehouse' AND is_active
  ) THEN RAISE EXCEPTION 'inventory_ready_stock_warehouse_invalid'; END IF;

  SELECT * INTO v_material
  FROM public.inventory_materials
  WHERE source_material_id = p_source_material_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'inventory_ready_stock_material_mapping_missing'; END IF;
  IF v_material.requires_unit_weight THEN RAISE EXCEPTION 'inventory_ready_stock_quantity_weight_required'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_variations) AS variation(value)
    GROUP BY NULLIF(BTRIM(variation.value->>'size'), '')
    HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'inventory_ready_stock_variation_duplicate_size'; END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_variations) LOOP
    v_size := NULLIF(BTRIM(v_row->>'size'), '');
    BEGIN
      v_quantity := NULLIF(v_row->>'quantity', '')::INTEGER;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'inventory_ready_stock_variations_invalid';
    END;
    IF v_size IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_quantity > 1000 OR v_total + v_quantity > 1000 THEN
      RAISE EXCEPTION 'inventory_ready_stock_variations_invalid';
    END IF;

    PERFORM public.inventory_adjust_ready_stock_quantity(
      p_brand_id, p_source_product_id, p_source_material_id, p_location_id,
      v_size, BTRIM(p_condition), v_quantity, BTRIM(p_reason), p_actor_id
    );
    v_total := v_total + v_quantity;
  END LOOP;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_add_ready_stock_variations(INTEGER, INTEGER, INTEGER, UUID, TEXT, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_add_ready_stock_variations(INTEGER, INTEGER, INTEGER, UUID, TEXT, JSONB, TEXT, UUID) TO service_role;
