CREATE TABLE IF NOT EXISTS public.warranty_event_inbox (
  source VARCHAR(40) NOT NULL,
  event_id UUID NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, event_id)
);

CREATE TABLE IF NOT EXISTS public.warranty_contract_projections (
  contract_reference VARCHAR(120) PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.legacy_orders(id) ON DELETE CASCADE,
  unit_code VARCHAR(120) NOT NULL,
  brand_code VARCHAR(50) NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, unit_code)
);

CREATE INDEX IF NOT EXISTS idx_warranty_contract_projections_order_id
  ON public.warranty_contract_projections(order_id);

ALTER TABLE public.warranty_event_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_contract_projections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_warranty_contract_activated(
  p_source TEXT,
  p_event_id UUID,
  p_order_source_id TEXT,
  p_order_reference TEXT,
  p_contract_reference TEXT,
  p_unit_code TEXT,
  p_brand_code TEXT,
  p_activated_at TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ,
  p_payload JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  local_order_id UUID;
  inserted_event_id UUID;
BEGIN
  SELECT id
  INTO local_order_id
  FROM public.legacy_orders
  WHERE legacy_id::TEXT = p_order_source_id
    AND kode_order = p_order_reference;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_identity_mismatch';
  END IF;

  INSERT INTO public.warranty_event_inbox (
    source,
    event_id,
    event_type,
    payload
  ) VALUES (
    p_source,
    p_event_id,
    'warranty_contract_activated',
    p_payload
  ) ON CONFLICT (source, event_id) DO NOTHING
  RETURNING event_id INTO inserted_event_id;

  IF inserted_event_id IS NULL THEN
    RETURN 'duplicate';
  END IF;

  INSERT INTO public.warranty_contract_projections (
    contract_reference,
    order_id,
    unit_code,
    brand_code,
    activated_at,
    expires_at
  ) VALUES (
    p_contract_reference,
    local_order_id,
    p_unit_code,
    p_brand_code,
    p_activated_at,
    p_expires_at
  ) ON CONFLICT (contract_reference) DO NOTHING;

  RETURN 'applied';
END;
$$;
