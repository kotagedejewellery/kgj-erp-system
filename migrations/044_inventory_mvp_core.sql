-- Inventory MVP core. Forward-only; apply only after reviewing the live schema.

CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  location_type VARCHAR(20) NOT NULL CHECK (location_type IN ('warehouse', 'wip')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_locations_one_default_per_type
  ON public.inventory_locations (location_type)
  WHERE is_default AND is_active;

CREATE TABLE IF NOT EXISTS public.inventory_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  source_material_id INTEGER UNIQUE,
  waste_percent NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (waste_percent >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_material_balances (
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  material_id UUID NOT NULL REFERENCES public.inventory_materials(id) ON DELETE RESTRICT,
  quantity_grams NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (quantity_grams >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, material_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_stock_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code VARCHAR(80) NOT NULL UNIQUE,
  brand_id INTEGER NOT NULL CHECK (brand_id > 0),
  source_product_id INTEGER,
  location_id UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  size VARCHAR(30),
  material_description VARCHAR(120),
  actual_weight_grams NUMERIC(14,3),
  condition VARCHAR(30) NOT NULL DEFAULT 'good',
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'allocated', 'inspection')),
  allocated_order_id UUID REFERENCES public.legacy_orders(id) ON DELETE RESTRICT,
  allocated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'allocated' AND allocated_order_id IS NOT NULL)
    OR (status <> 'allocated' AND allocated_order_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_units_one_per_order
  ON public.inventory_stock_units (allocated_order_id)
  WHERE allocated_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inventory_order_issues (
  order_id UUID PRIMARY KEY REFERENCES public.legacy_orders(id) ON DELETE RESTRICT,
  issue_type VARCHAR(20) NOT NULL CHECK (issue_type IN ('custom', 'ready_stock')),
  issued_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mutation_type VARCHAR(30) NOT NULL CHECK (mutation_type IN (
    'opening', 'receipt', 'adjustment', 'issue_to_wip',
    'allocate_finished_good', 'return_from_wip', 'scrap'
  )),
  material_id UUID REFERENCES public.inventory_materials(id) ON DELETE RESTRICT,
  stock_unit_id UUID REFERENCES public.inventory_stock_units(id) ON DELETE RESTRICT,
  quantity_grams NUMERIC(14,3) NOT NULL CHECK (quantity_grams > 0),
  from_location_id UUID REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  to_location_id UUID REFERENCES public.inventory_locations(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.legacy_orders(id) ON DELETE RESTRICT,
  reason TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(material_id, stock_unit_id) = 1)
);

CREATE INDEX IF NOT EXISTS inventory_mutations_order_created_at
  ON public.inventory_mutations (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_mutations_material_created_at
  ON public.inventory_mutations (material_id, created_at DESC);

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_material_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_order_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_mutations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.inventory_issue_custom_for_approval(
  p_order_id UUID,
  p_actor_id UUID,
  p_remarks TEXT DEFAULT NULL
)
RETURNS TABLE (legacy_id INTEGER, kode_order VARCHAR)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tracking public.tracking_stages%ROWTYPE;
  v_order public.legacy_orders%ROWTYPE;
  v_source_location UUID;
  v_wip_location UUID;
  v_component JSONB;
  v_gender INTEGER;
  v_source_material_id INTEGER;
  v_material public.inventory_materials%ROWTYPE;
  v_balance NUMERIC(14,3);
  v_weight NUMERIC(14,3);
  v_issue_quantity NUMERIC(14,3);
  v_component_count INTEGER := 0;
  v_seen_male BOOLEAN := FALSE;
  v_seen_female BOOLEAN := FALSE;
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory_order_not_available';
  END IF;

  SELECT id INTO v_source_location
  FROM public.inventory_locations
  WHERE location_type = 'warehouse' AND is_active AND is_default;
  SELECT id INTO v_wip_location
  FROM public.inventory_locations
  WHERE location_type = 'wip' AND is_active AND is_default;

  IF v_source_location IS NULL OR v_wip_location IS NULL THEN
    RAISE EXCEPTION 'inventory_default_locations_missing';
  END IF;

  FOR v_component IN SELECT value FROM jsonb_array_elements(v_order.komponen)
  LOOP
    IF COALESCE(v_component->>'id_jenis_bahan', '') = '' THEN
      CONTINUE;
    END IF;

    v_gender := NULLIF(v_component->>'id_gender', '')::INTEGER;
    v_source_material_id := NULLIF(v_component->>'id_jenis_bahan', '')::INTEGER;
    IF v_gender NOT IN (1, 2) THEN
      RAISE EXCEPTION 'inventory_material_gender_invalid';
    END IF;

    IF (v_gender = 1 AND v_seen_male) OR (v_gender = 2 AND v_seen_female) THEN
      RAISE EXCEPTION 'inventory_material_components_ambiguous';
    END IF;
    v_seen_male := v_seen_male OR v_gender = 1;
    v_seen_female := v_seen_female OR v_gender = 2;

    v_component_count := v_component_count + 1;
    IF v_component_count > 2 THEN
      RAISE EXCEPTION 'inventory_material_components_ambiguous';
    END IF;

    v_weight := CASE v_gender
      WHEN 1 THEN v_order.berat_cincin_pria
      WHEN 2 THEN v_order.berat_cincin_wanita
    END;
    IF v_weight IS NULL OR v_weight <= 0 THEN
      RAISE EXCEPTION 'inventory_appraisal_weight_missing';
    END IF;

    SELECT * INTO v_material
    FROM public.inventory_materials
    WHERE source_material_id = v_source_material_id AND is_active;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'inventory_material_mapping_missing:%', v_source_material_id;
    END IF;

    v_issue_quantity := v_weight * (1 + v_material.waste_percent / 100);
    SELECT quantity_grams INTO v_balance
    FROM public.inventory_material_balances
    WHERE location_id = v_source_location AND material_id = v_material.id
    FOR UPDATE;
    IF v_balance IS NULL OR v_balance < v_issue_quantity THEN
      RAISE EXCEPTION 'inventory_stock_insufficient:%', v_material.code;
    END IF;

    UPDATE public.inventory_material_balances
    SET quantity_grams = quantity_grams - v_issue_quantity, updated_at = now()
    WHERE location_id = v_source_location AND material_id = v_material.id;

    INSERT INTO public.inventory_material_balances (location_id, material_id, quantity_grams)
    VALUES (v_wip_location, v_material.id, v_issue_quantity)
    ON CONFLICT (location_id, material_id)
    DO UPDATE SET quantity_grams = inventory_material_balances.quantity_grams + EXCLUDED.quantity_grams,
                  updated_at = now();

    INSERT INTO public.inventory_mutations (
      mutation_type, material_id, quantity_grams, from_location_id, to_location_id,
      order_id, reason, created_by
    ) VALUES (
      'issue_to_wip', v_material.id, v_issue_quantity, v_source_location, v_wip_location,
      p_order_id, p_remarks, p_actor_id
    );
  END LOOP;

  IF v_component_count = 0 THEN
    RAISE EXCEPTION 'inventory_material_component_missing';
  END IF;

  INSERT INTO public.inventory_order_issues (order_id, issue_type, issued_by)
  VALUES (p_order_id, 'custom', p_actor_id);

  UPDATE public.tracking_stages
  SET current_stage = 'racik_bahan', stage_status = 'in_progress', updated_at = now(), updated_by = p_actor_id
  WHERE order_id = p_order_id;

  INSERT INTO public.stage_history (order_id, stage, status, note, changed_by, created_at)
  VALUES (p_order_id, 'racik_bahan', 'completed', CONCAT('Approved by inventory issue', CASE WHEN p_remarks IS NULL THEN '' ELSE ': ' || p_remarks END), p_actor_id, now());

  RETURN QUERY SELECT v_order.legacy_id, v_order.kode_order;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_issue_custom_for_approval(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_issue_custom_for_approval(UUID, UUID, TEXT) TO service_role;

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

REVOKE ALL ON FUNCTION public.inventory_allocate_ready_stock_for_approval(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_allocate_ready_stock_for_approval(UUID, UUID, UUID, TEXT) TO service_role;
