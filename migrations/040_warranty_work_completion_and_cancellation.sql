ALTER TABLE public.warranty_works
  DROP CONSTRAINT IF EXISTS warranty_works_status_check;

ALTER TABLE public.warranty_works
  ADD CONSTRAINT warranty_works_status_check
  CHECK (status IN (
    'requested', 'in_progress', 'qc', 'completion_pending', 'completed',
    'cancellation_requested', 'cancelled', 'cancellation_rejected'
  ));

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
  outbound_status TEXT;
  valid_transition BOOLEAN := false;
BEGIN
  SELECT * INTO work_row FROM public.warranty_works WHERE id = p_work_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'warranty_work_not_found'; END IF;

  valid_transition := (work_row.status = 'requested' AND p_status = 'in_progress')
    OR (work_row.status = 'in_progress' AND p_status = 'qc')
    OR (work_row.status IN ('qc', 'cancellation_requested') AND p_status = 'completion_pending')
    OR (work_row.status IN ('requested', 'in_progress', 'qc') AND p_status = 'cancellation_requested')
    OR (work_row.status = 'cancellation_requested' AND p_status IN ('cancelled', 'cancellation_rejected'));
  IF NOT valid_transition THEN RAISE EXCEPTION 'invalid_work_transition'; END IF;
  IF p_status = 'completion_pending' AND work_row.requires_qc AND p_qc_passed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'qc_required';
  END IF;
  IF p_status = 'completion_pending' AND work_row.requires_final_weight AND p_final_weight_gram IS NULL THEN
    RAISE EXCEPTION 'final_weight_required';
  END IF;
  IF p_status = 'completion_pending' AND work_row.requires_attachment AND jsonb_array_length(COALESCE(p_attachment_ids, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'attachment_required';
  END IF;

  next_version := work_row.work_version + 1;
  outbound_status := CASE WHEN p_status = 'completion_pending' THEN 'completed' ELSE p_status END;
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
      'work_reference', work_row.work_reference, 'work_version', next_version, 'status', outbound_status,
      'pic_id', COALESCE(p_pic_id, work_row.pic_id), 'qc_passed', COALESCE(p_qc_passed, work_row.qc_passed),
      'final_weight_gram', COALESCE(p_final_weight_gram, work_row.final_weight_gram),
      'attachment_ids', COALESCE(p_attachment_ids, work_row.attachment_ids), 'notes', p_notes
    )
  ));
  RETURN QUERY SELECT work_row.work_reference, next_version, p_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_warranty_work_cancellation_requested(
  p_source TEXT,
  p_event_id UUID,
  p_order_source_id TEXT,
  p_order_reference TEXT,
  p_claim_reference TEXT,
  p_work_reference TEXT,
  p_reason TEXT,
  p_payload JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  local_order_id UUID;
  work_row public.warranty_works%ROWTYPE;
  inserted_event_id UUID;
  next_version INTEGER;
BEGIN
  SELECT id INTO local_order_id FROM public.legacy_orders
  WHERE legacy_id::TEXT = p_order_source_id AND kode_order = p_order_reference;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_identity_mismatch'; END IF;

  INSERT INTO public.warranty_event_inbox (source, event_id, event_type, payload)
  VALUES (p_source, p_event_id, 'warranty_work_cancellation_requested', p_payload)
  ON CONFLICT (source, event_id) DO NOTHING
  RETURNING event_id INTO inserted_event_id;
  IF inserted_event_id IS NULL THEN RETURN 'duplicate'; END IF;

  SELECT * INTO work_row FROM public.warranty_works
  WHERE order_id = local_order_id AND claim_reference = p_claim_reference AND work_reference = p_work_reference
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'warranty_work_not_found'; END IF;
  IF work_row.status IN ('completed', 'cancelled', 'cancellation_rejected') THEN RETURN 'stale'; END IF;

  next_version := work_row.work_version + 1;
  UPDATE public.warranty_works
  SET status = 'cancellation_requested', work_version = next_version, updated_at = now()
  WHERE id = work_row.id;
  INSERT INTO public.warranty_work_events (work_id, work_version, status, notes)
  VALUES (work_row.id, next_version, 'cancellation_requested', p_reason);
  RETURN 'applied';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_warranty_work_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.canonical_status = 'completed' THEN
    UPDATE public.warranty_works
    SET status = 'completed', updated_at = now()
    WHERE claim_reference = NEW.claim_reference AND status = 'completion_pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS warranty_claim_projection_sync_work_completion ON public.warranty_claim_projections;
CREATE TRIGGER warranty_claim_projection_sync_work_completion
AFTER INSERT OR UPDATE OF canonical_status ON public.warranty_claim_projections
FOR EACH ROW EXECUTE FUNCTION public.sync_warranty_work_completion();
