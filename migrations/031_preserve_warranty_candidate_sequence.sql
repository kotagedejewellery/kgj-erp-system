CREATE OR REPLACE FUNCTION public.enqueue_warranty_activation(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  completion RECORD;
  source_order RECORD;
  candidates JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.warranty_preparations
    WHERE order_id = p_order_id AND is_ready = true
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tracking_stages
    WHERE order_id = p_order_id AND current_stage = 'selesai'
  ) THEN
    RETURN;
  END IF;

  SELECT id, created_at
  INTO completion
  FROM public.stage_history
  WHERE order_id = p_order_id
    AND stage = 'selesai'
    AND status = 'completed'
  ORDER BY created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT legacy_id, kode_order
  INTO source_order
  FROM public.legacy_orders
  WHERE id = p_order_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'candidate_sequence', candidate_sequence,
      'unit_code', unit_code,
      'gender', gender,
      'starting_weight_gram', starting_weight_gram
    )
    ORDER BY candidate_sequence
  )
  INTO candidates
  FROM public.warranty_preparation_units
  WHERE order_id = p_order_id;
  IF candidates IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.warranty_activation_outbox (
    event_id,
    order_id,
    payload,
    next_retry_at
  ) VALUES (
    completion.id,
    p_order_id,
    jsonb_build_object(
      'schema_version', 1,
      'event_id', completion.id,
      'event_type', 'warranty_activation_ready',
      'occurred_at', now(),
      'order', jsonb_build_object(
        'source_id', source_order.legacy_id::TEXT,
        'reference', source_order.kode_order
      ),
      'data', jsonb_build_object(
        'activation_event_id', completion.id,
        'activated_at', completion.created_at,
        'candidates', candidates
      )
    ),
    now()
  ) ON CONFLICT (order_id) DO NOTHING;
END;
$$;
