CREATE TABLE IF NOT EXISTS public.inventory_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.inventory_settings (singleton, is_enabled)
VALUES (TRUE, FALSE)
ON CONFLICT (singleton) DO NOTHING;

INSERT INTO public.inventory_locations (code, name, location_type, is_default)
VALUES
  ('GUDANG_UTAMA', 'Gudang Utama', 'warehouse', TRUE),
  ('WIP', 'Work in Progress', 'wip', TRUE)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.inventory_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.inventory_record_opening_balance(
  p_location_id UUID,
  p_material_id UUID,
  p_quantity_grams NUMERIC,
  p_actor_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  IF p_quantity_grams IS NULL OR p_quantity_grams <= 0 THEN
    RAISE EXCEPTION 'inventory_opening_balance_invalid';
  END IF;

  SELECT quantity_grams INTO v_balance
  FROM inventory_material_balances
  WHERE location_id = p_location_id AND material_id = p_material_id
  FOR UPDATE;

  IF v_balance IS NOT NULL AND v_balance <> 0 THEN
    RAISE EXCEPTION 'inventory_opening_balance_already_recorded';
  END IF;

  INSERT INTO inventory_material_balances (location_id, material_id, quantity_grams)
  VALUES (p_location_id, p_material_id, p_quantity_grams)
  ON CONFLICT (location_id, material_id) DO UPDATE
  SET quantity_grams = EXCLUDED.quantity_grams, updated_at = now();

  INSERT INTO inventory_mutations (
    mutation_type, material_id, quantity_grams, to_location_id, reason, created_by
  ) VALUES (
    'opening', p_material_id, p_quantity_grams, p_location_id, p_reason, p_actor_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_record_opening_balance(UUID, UUID, NUMERIC, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_record_opening_balance(UUID, UUID, NUMERIC, UUID, TEXT) TO service_role;
