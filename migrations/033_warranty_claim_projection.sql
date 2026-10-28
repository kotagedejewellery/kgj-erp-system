CREATE TABLE IF NOT EXISTS public.warranty_claim_projections (
  claim_reference VARCHAR(120) PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.legacy_orders(id) ON DELETE CASCADE,
  claim_version INTEGER NOT NULL CHECK (claim_version > 0),
  canonical_status VARCHAR(80) NOT NULL,
  quota_initial INTEGER NOT NULL CHECK (quota_initial >= 0),
  approved_grant INTEGER NOT NULL CHECK (approved_grant >= 0),
  quota_used INTEGER NOT NULL CHECK (quota_used >= 0),
  quota_reserved INTEGER NOT NULL CHECK (quota_reserved >= 0),
  quota_available INTEGER NOT NULL CHECK (quota_available >= 0),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warranty_claim_projections_order_id
  ON public.warranty_claim_projections(order_id);

ALTER TABLE public.warranty_claim_projections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_warranty_claim_changed(
  p_source TEXT,
  p_event_id UUID,
  p_order_source_id TEXT,
  p_order_reference TEXT,
  p_claim_reference TEXT,
  p_claim_version INTEGER,
  p_canonical_status TEXT,
  p_quota_initial INTEGER,
  p_approved_grant INTEGER,
  p_quota_used INTEGER,
  p_quota_reserved INTEGER,
  p_quota_available INTEGER,
  p_payload JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  local_order_id UUID;
  inserted_event_id UUID;
  applied_version INTEGER;
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
    'warranty_claim_changed',
    p_payload
  ) ON CONFLICT (source, event_id) DO NOTHING
  RETURNING event_id INTO inserted_event_id;

  IF inserted_event_id IS NULL THEN
    RETURN 'duplicate';
  END IF;

  INSERT INTO public.warranty_claim_projections (
    claim_reference,
    order_id,
    claim_version,
    canonical_status,
    quota_initial,
    approved_grant,
    quota_used,
    quota_reserved,
    quota_available,
    last_updated_at
  ) VALUES (
    p_claim_reference,
    local_order_id,
    p_claim_version,
    p_canonical_status,
    p_quota_initial,
    p_approved_grant,
    p_quota_used,
    p_quota_reserved,
    p_quota_available,
    now()
  ) ON CONFLICT (claim_reference) DO UPDATE
  SET claim_version = EXCLUDED.claim_version,
      canonical_status = EXCLUDED.canonical_status,
      quota_initial = EXCLUDED.quota_initial,
      approved_grant = EXCLUDED.approved_grant,
      quota_used = EXCLUDED.quota_used,
      quota_reserved = EXCLUDED.quota_reserved,
      quota_available = EXCLUDED.quota_available,
      last_updated_at = now()
  WHERE EXCLUDED.claim_version > public.warranty_claim_projections.claim_version
  RETURNING claim_version INTO applied_version;

  RETURN CASE WHEN applied_version IS NULL THEN 'stale' ELSE 'applied' END;
END;
$$;
