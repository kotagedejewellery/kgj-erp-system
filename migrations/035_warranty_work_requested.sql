CREATE TABLE IF NOT EXISTS public.warranty_works (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.legacy_orders(id) ON DELETE CASCADE,
  claim_reference VARCHAR(120) NOT NULL UNIQUE,
  work_reference VARCHAR(140) NOT NULL UNIQUE,
  benefit_code VARCHAR(120) NOT NULL,
  condition_notes TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'in_progress', 'qc', 'completed', 'cancellation_requested', 'cancelled', 'cancellation_rejected')),
  work_version INTEGER NOT NULL DEFAULT 1 CHECK (work_version > 0),
  requires_qc BOOLEAN NOT NULL DEFAULT false,
  requires_final_weight BOOLEAN NOT NULL DEFAULT false,
  requires_attachment BOOLEAN NOT NULL DEFAULT false,
  pic_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  qc_passed BOOLEAN NOT NULL DEFAULT false,
  final_weight_gram NUMERIC(10,3),
  attachment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (final_weight_gram IS NULL OR final_weight_gram > 0)
);

CREATE INDEX IF NOT EXISTS idx_warranty_works_order_id ON public.warranty_works(order_id);
CREATE INDEX IF NOT EXISTS idx_warranty_works_status ON public.warranty_works(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.warranty_work_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES public.warranty_works(id) ON DELETE CASCADE,
  work_version INTEGER NOT NULL CHECK (work_version > 0),
  status VARCHAR(40) NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_id, work_version)
);

ALTER TABLE public.warranty_works ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_work_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_warranty_work_requested(
  p_source TEXT,
  p_event_id UUID,
  p_order_source_id TEXT,
  p_order_reference TEXT,
  p_claim_reference TEXT,
  p_benefit_code TEXT,
  p_condition_notes TEXT,
  p_requires_qc BOOLEAN,
  p_requires_final_weight BOOLEAN,
  p_requires_attachment BOOLEAN,
  p_payload JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  local_order_id UUID;
  inserted_event_id UUID;
  work_id UUID;
BEGIN
  SELECT id INTO local_order_id
  FROM public.legacy_orders
  WHERE legacy_id::TEXT = p_order_source_id
    AND kode_order = p_order_reference;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_identity_mismatch';
  END IF;

  INSERT INTO public.warranty_event_inbox (source, event_id, event_type, payload)
  VALUES (p_source, p_event_id, 'warranty_work_requested', p_payload)
  ON CONFLICT (source, event_id) DO NOTHING
  RETURNING event_id INTO inserted_event_id;
  IF inserted_event_id IS NULL THEN
    RETURN 'duplicate';
  END IF;

  INSERT INTO public.warranty_works (
    order_id, claim_reference, work_reference, benefit_code, condition_notes,
    requires_qc, requires_final_weight, requires_attachment
  ) VALUES (
    local_order_id, p_claim_reference, 'WW-' || p_claim_reference, p_benefit_code, p_condition_notes,
    p_requires_qc, p_requires_final_weight, p_requires_attachment
  ) ON CONFLICT (claim_reference) DO UPDATE
    SET updated_at = public.warranty_works.updated_at
  RETURNING id INTO work_id;

  INSERT INTO public.warranty_work_events (work_id, work_version, status, notes)
  VALUES (work_id, 1, 'requested', p_condition_notes)
  ON CONFLICT (work_id, work_version) DO NOTHING;

  RETURN 'applied';
END;
$$;
