CREATE TABLE IF NOT EXISTS public.warranty_exception_request_actors (
  exception_request_id VARCHAR(120) PRIMARY KEY,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.warranty_exception_requests (
  exception_request_id VARCHAR(120) PRIMARY KEY,
  claim_reference VARCHAR(120) NOT NULL,
  order_id UUID NOT NULL REFERENCES public.legacy_orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warranty_exception_requests_pending
  ON public.warranty_exception_requests(status, created_at)
  WHERE status = 'pending';

ALTER TABLE public.warranty_exception_request_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_exception_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_warranty_exception_requested(
  p_source TEXT,
  p_event_id UUID,
  p_order_source_id TEXT,
  p_order_reference TEXT,
  p_claim_reference TEXT,
  p_exception_request_id TEXT,
  p_reason TEXT,
  p_payload JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  local_order_id UUID;
  inserted_event_id UUID;
  requester_id UUID;
BEGIN
  SELECT id INTO local_order_id FROM public.legacy_orders
  WHERE legacy_id::TEXT = p_order_source_id AND kode_order = p_order_reference;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_identity_mismatch'; END IF;

  INSERT INTO public.warranty_event_inbox (source, event_id, event_type, payload)
  VALUES (p_source, p_event_id, 'warranty_exception_requested', p_payload)
  ON CONFLICT (source, event_id) DO NOTHING
  RETURNING event_id INTO inserted_event_id;
  IF inserted_event_id IS NULL THEN RETURN 'duplicate'; END IF;

  SELECT requested_by INTO requester_id FROM public.warranty_exception_request_actors
  WHERE exception_request_id = p_exception_request_id;
  INSERT INTO public.warranty_exception_requests (
    exception_request_id, claim_reference, order_id, reason, requested_by
  ) VALUES (
    p_exception_request_id, p_claim_reference, local_order_id, p_reason, requester_id
  ) ON CONFLICT (exception_request_id) DO NOTHING;
  RETURN 'applied';
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_warranty_exception(
  p_exception_request_id TEXT,
  p_actor_id UUID,
  p_actor_display_name TEXT,
  p_decision TEXT,
  p_reason TEXT
)
RETURNS TABLE (exception_request_id TEXT, status TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  request_row public.warranty_exception_requests%ROWTYPE;
  order_row RECORD;
  event_id UUID := gen_random_uuid();
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'invalid_exception_decision'; END IF;
  SELECT * INTO request_row FROM public.warranty_exception_requests
  WHERE exception_request_id = p_exception_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'exception_request_not_found'; END IF;
  IF request_row.status <> 'pending' THEN RAISE EXCEPTION 'exception_request_already_decided'; END IF;
  IF request_row.requested_by IS NULL THEN RAISE EXCEPTION 'exception_requester_unknown'; END IF;
  IF request_row.requested_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;

  UPDATE public.warranty_exception_requests
  SET status = p_decision, decided_by = p_actor_id, decided_at = now(), decision_reason = p_reason, updated_at = now()
  WHERE exception_request_id = p_exception_request_id;
  SELECT legacy_id, kode_order INTO order_row FROM public.legacy_orders WHERE id = request_row.order_id;
  INSERT INTO public.warranty_erp_outbox (event_id, event_type, payload)
  VALUES (event_id, 'warranty_exception_decided', jsonb_build_object(
    'schema_version', 1, 'event_id', event_id, 'event_type', 'warranty_exception_decided', 'occurred_at', now(),
    'order', jsonb_build_object('source_id', order_row.legacy_id::TEXT, 'reference', order_row.kode_order),
    'claim_reference', request_row.claim_reference,
    'data', jsonb_build_object(
      'exception_request_id', request_row.exception_request_id,
      'decision', p_decision,
      'actor_id', p_actor_id,
      'actor_display_name', p_actor_display_name,
      'decided_at', now(),
      'reason', p_reason
    )
  ));
  RETURN QUERY SELECT request_row.exception_request_id, p_decision;
END;
$$;

UPDATE public.roles
SET permissions = permissions || '{"warranty.exception.decide": true}'::jsonb
WHERE name = 'operational_supervisor';
