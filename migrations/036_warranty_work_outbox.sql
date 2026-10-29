CREATE TABLE IF NOT EXISTS public.warranty_erp_outbox (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(80) NOT NULL CHECK (event_type IN ('warranty_work_updated', 'warranty_exception_decided')),
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'failed', 'delivered', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  last_http_status INTEGER,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warranty_erp_outbox_retry
  ON public.warranty_erp_outbox(status, next_retry_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.warranty_erp_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_warranty_work_update(
  p_work_id UUID,
  p_actor_id UUID,
  p_status TEXT,
  p_pic_id UUID,
  p_qc_passed BOOLEAN,
  p_final_weight_gram NUMERIC,
  p_attachment_ids JSONB,
  p_notes TEXT
)
RETURNS TABLE (work_reference TEXT, work_version INTEGER, status TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  work_row public.warranty_works%ROWTYPE;
  order_row RECORD;
  next_version INTEGER;
  event_id UUID := gen_random_uuid();
  valid_transition BOOLEAN := false;
BEGIN
  SELECT * INTO work_row FROM public.warranty_works WHERE id = p_work_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'warranty_work_not_found'; END IF;

  valid_transition := (work_row.status = 'requested' AND p_status = 'in_progress')
    OR (work_row.status = 'in_progress' AND p_status = 'qc')
    OR (work_row.status = 'qc' AND p_status = 'completed')
    OR (work_row.status IN ('requested', 'in_progress', 'qc') AND p_status = 'cancellation_requested');
  IF NOT valid_transition THEN RAISE EXCEPTION 'invalid_work_transition'; END IF;
  IF p_status = 'completed' AND work_row.requires_qc AND p_qc_passed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'qc_required';
  END IF;
  IF p_status = 'completed' AND work_row.requires_final_weight AND p_final_weight_gram IS NULL THEN
    RAISE EXCEPTION 'final_weight_required';
  END IF;
  IF p_status = 'completed' AND work_row.requires_attachment AND jsonb_array_length(COALESCE(p_attachment_ids, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'attachment_required';
  END IF;

  next_version := work_row.work_version + 1;
  UPDATE public.warranty_works SET
    status = p_status,
    work_version = next_version,
    pic_id = COALESCE(p_pic_id, work_row.pic_id),
    qc_passed = COALESCE(p_qc_passed, work_row.qc_passed),
    final_weight_gram = COALESCE(p_final_weight_gram, work_row.final_weight_gram),
    attachment_ids = COALESCE(p_attachment_ids, work_row.attachment_ids),
    updated_at = now()
  WHERE id = p_work_id;
  INSERT INTO public.warranty_work_events (work_id, work_version, status, actor_id, notes)
  VALUES (p_work_id, next_version, p_status, p_actor_id, p_notes);

  SELECT legacy_id, kode_order INTO order_row FROM public.legacy_orders WHERE id = work_row.order_id;
  INSERT INTO public.warranty_erp_outbox (event_id, event_type, payload)
  VALUES (event_id, 'warranty_work_updated', jsonb_build_object(
    'schema_version', 1, 'event_id', event_id, 'event_type', 'warranty_work_updated', 'occurred_at', now(),
    'order', jsonb_build_object('source_id', order_row.legacy_id::TEXT, 'reference', order_row.kode_order),
    'claim_reference', work_row.claim_reference,
    'data', jsonb_build_object(
      'work_reference', work_row.work_reference, 'work_version', next_version, 'status', p_status,
      'pic_id', COALESCE(p_pic_id, work_row.pic_id), 'qc_passed', COALESCE(p_qc_passed, work_row.qc_passed),
      'final_weight_gram', COALESCE(p_final_weight_gram, work_row.final_weight_gram),
      'attachment_ids', COALESCE(p_attachment_ids, work_row.attachment_ids), 'notes', p_notes
    )
  ));
  RETURN QUERY SELECT work_row.work_reference, next_version, p_status;
END;
$$;
