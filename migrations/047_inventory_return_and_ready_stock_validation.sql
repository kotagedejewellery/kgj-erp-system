-- Forward-only hardening for the Inventory MVP. Does not alter legacy order data or stages.

ALTER TABLE public.inventory_stock_units
  ADD COLUMN IF NOT EXISTS source_material_id INTEGER;

ALTER TABLE public.inventory_mutations
  DROP CONSTRAINT IF EXISTS inventory_mutations_mutation_type_check;

ALTER TABLE public.inventory_mutations
  ADD CONSTRAINT inventory_mutations_mutation_type_check
  CHECK (mutation_type IN (
    'opening', 'receipt', 'adjustment', 'issue_to_wip',
    'allocate_finished_good', 'return_from_wip', 'return_to_stock', 'scrap'
  ));

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
BEGIN
  SELECT * INTO v_tracking
  FROM public.tracking_stages
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_tracking.current_stage <> 'approval_penerimaan_order' THEN
    RAISE EXCEPTION 'inventory_issue_requires_approval_penerimaan_order';
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory_order_issues WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'inventory_already_issued';
  END IF;

  SELECT * INTO v_order
  FROM public.legacy_orders
  WHERE id = p_order_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_order.id_produk IS NULL THEN
    RAISE EXCEPTION 'inventory_ready_stock_product_missing';
  END IF;

  FOR v_component IN SELECT value FROM jsonb_array_elements(v_order.komponen)
  LOOP
    IF COALESCE(v_component->>'id_jenis_bahan', '') = '' THEN
      CONTINUE;
    END IF;

    v_component_count := v_component_count + 1;
    IF v_component_count > 1 THEN
      RAISE EXCEPTION 'inventory_ready_stock_components_ambiguous';
    END IF;
    v_order_material_id := NULLIF(v_component->>'id_jenis_bahan', '')::INTEGER;
    v_order_size := NULLIF(BTRIM(v_component->>'ukuran'), '');
  END LOOP;

  IF v_component_count <> 1 OR v_order_size IS NULL THEN
    RAISE EXCEPTION 'inventory_ready_stock_details_missing';
  END IF;

  SELECT * INTO v_unit
  FROM public.inventory_stock_units
  WHERE id = p_stock_unit_id
  FOR UPDATE;

  IF NOT FOUND OR v_unit.status <> 'available' THEN
    RAISE EXCEPTION 'inventory_stock_unit_unavailable';
  END IF;
  IF v_unit.brand_id <> v_order.id_brand THEN
    RAISE EXCEPTION 'inventory_stock_unit_brand_mismatch';
  END IF;
  IF v_unit.source_product_id IS DISTINCT FROM v_order.id_produk THEN
    RAISE EXCEPTION 'inventory_stock_unit_product_mismatch';
  END IF;
  IF v_unit.source_material_id IS NULL OR v_unit.source_material_id <> v_order_material_id THEN
    RAISE EXCEPTION 'inventory_stock_unit_material_mismatch';
  END IF;
  IF v_unit.size IS NULL OR v_unit.size <> v_order_size THEN
    RAISE EXCEPTION 'inventory_stock_unit_size_mismatch';
  END IF;
  IF v_unit.actual_weight_grams IS NULL OR v_unit.actual_weight_grams <= 0 THEN
    RAISE EXCEPTION 'inventory_stock_unit_weight_missing';
  END IF;

  UPDATE public.inventory_stock_units
  SET status = 'allocated', allocated_order_id = p_order_id, allocated_at = now(), updated_at = now()
  WHERE id = p_stock_unit_id;

  INSERT INTO public.inventory_order_issues (order_id, issue_type, issued_by)
  VALUES (p_order_id, 'ready_stock', p_actor_id);

  INSERT INTO public.inventory_mutations (
    mutation_type, stock_unit_id, quantity_grams, from_location_id, to_location_id,
    order_id, reason, created_by
  ) VALUES (
    'allocate_finished_good', p_stock_unit_id, v_unit.actual_weight_grams, v_unit.location_id, v_unit.location_id,
    p_order_id, p_remarks, p_actor_id
  );

  UPDATE public.tracking_stages
  SET current_stage = 'racik_bahan', stage_status = 'in_progress', updated_at = now(), updated_by = p_actor_id
  WHERE order_id = p_order_id;

  INSERT INTO public.stage_history (order_id, stage, status, note, changed_by, created_at)
  VALUES (p_order_id, 'racik_bahan', 'completed', CONCAT('Approved with ready-stock allocation', CASE WHEN p_remarks IS NULL THEN '' ELSE ': ' || p_remarks END), p_actor_id, now());

  RETURN QUERY SELECT v_order.legacy_id, v_order.kode_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.inventory_return_to_stock(
  p_order_id UUID,
  p_actor_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_issue public.inventory_order_issues%ROWTYPE;
  v_tracking public.tracking_stages%ROWTYPE;
  v_warehouse_id UUID;
  v_wip_id UUID;
  v_mutation RECORD;
  v_unit public.inventory_stock_units%ROWTYPE;
  v_wip_balance NUMERIC(14,3);
  v_return_count INTEGER := 0;
BEGIN
  IF NULLIF(BTRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'inventory_return_reason_required';
  END IF;

  SELECT * INTO v_tracking
  FROM public.tracking_stages
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_tracking.current_stage <> 'selesai' OR v_tracking.stage_status <> 'cancelled' THEN
    RAISE EXCEPTION 'inventory_return_requires_cancelled_order';
  END IF;

  SELECT * INTO v_issue
  FROM public.inventory_order_issues
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_issue_not_found';
  END IF;
  IF v_issue.returned_at IS NOT NULL THEN
    RAISE EXCEPTION 'inventory_already_returned';
  END IF;

  IF v_issue.issue_type = 'custom' THEN
    SELECT id INTO v_warehouse_id
    FROM public.inventory_locations
    WHERE location_type = 'warehouse' AND is_active AND is_default;
    SELECT id INTO v_wip_id
    FROM public.inventory_locations
    WHERE location_type = 'wip' AND is_active AND is_default;

    IF v_warehouse_id IS NULL OR v_wip_id IS NULL THEN
      RAISE EXCEPTION 'inventory_default_locations_missing';
    END IF;

    FOR v_mutation IN
      SELECT material_id, quantity_grams
      FROM public.inventory_mutations
      WHERE order_id = p_order_id AND mutation_type = 'issue_to_wip'
      ORDER BY created_at, id
    LOOP
      v_return_count := v_return_count + 1;
      SELECT quantity_grams INTO v_wip_balance
      FROM public.inventory_material_balances
      WHERE location_id = v_wip_id AND material_id = v_mutation.material_id
      FOR UPDATE;

      IF v_wip_balance IS NULL OR v_wip_balance < v_mutation.quantity_grams THEN
        RAISE EXCEPTION 'inventory_wip_balance_insufficient';
      END IF;

      UPDATE public.inventory_material_balances
      SET quantity_grams = quantity_grams - v_mutation.quantity_grams, updated_at = now()
      WHERE location_id = v_wip_id AND material_id = v_mutation.material_id;

      INSERT INTO public.inventory_material_balances (location_id, material_id, quantity_grams)
      VALUES (v_warehouse_id, v_mutation.material_id, v_mutation.quantity_grams)
      ON CONFLICT (location_id, material_id)
      DO UPDATE SET quantity_grams = inventory_material_balances.quantity_grams + EXCLUDED.quantity_grams,
                    updated_at = now();

      INSERT INTO public.inventory_mutations (
        mutation_type, material_id, quantity_grams, from_location_id, to_location_id,
        order_id, reason, created_by
      ) VALUES (
        'return_to_stock', v_mutation.material_id, v_mutation.quantity_grams, v_wip_id, v_warehouse_id,
        p_order_id, p_reason, p_actor_id
      );
    END LOOP;

    IF v_return_count = 0 THEN
      RAISE EXCEPTION 'inventory_issue_ledger_missing';
    END IF;
  ELSIF v_issue.issue_type = 'ready_stock' THEN
    SELECT * INTO v_unit
    FROM public.inventory_stock_units
    WHERE allocated_order_id = p_order_id AND status = 'allocated'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'inventory_stock_unit_allocation_missing';
    END IF;

    UPDATE public.inventory_stock_units
    SET status = 'available', allocated_order_id = NULL, allocated_at = NULL, updated_at = now()
    WHERE id = v_unit.id;

    INSERT INTO public.inventory_mutations (
      mutation_type, stock_unit_id, quantity_grams, from_location_id, to_location_id,
      order_id, reason, created_by
    ) VALUES (
      'return_to_stock', v_unit.id, v_unit.actual_weight_grams, v_unit.location_id, v_unit.location_id,
      p_order_id, p_reason, p_actor_id
    );
  ELSE
    RAISE EXCEPTION 'inventory_issue_type_invalid';
  END IF;

  UPDATE public.inventory_order_issues
  SET returned_at = now()
  WHERE order_id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_allocate_ready_stock_for_approval(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_allocate_ready_stock_for_approval(UUID, UUID, UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.inventory_return_to_stock(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_return_to_stock(UUID, UUID, TEXT) TO service_role;
