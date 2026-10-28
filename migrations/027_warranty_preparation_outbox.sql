CREATE TABLE IF NOT EXISTS public.warranty_preparations (
  order_id UUID PRIMARY KEY REFERENCES public.legacy_orders(id) ON DELETE CASCADE,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  ready_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ready_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (is_ready = false AND ready_at IS NULL)
    OR (is_ready = true AND ready_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.warranty_preparation_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.legacy_orders(id) ON DELETE CASCADE,
  candidate_sequence BIGINT NOT NULL,
  unit_code VARCHAR(120) NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('pria', 'wanita', 'lainnya')),
  starting_weight_gram NUMERIC(10,3) NOT NULL CHECK (starting_weight_gram > 0),
  plan_version_reference VARCHAR(150) NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, candidate_sequence),
  UNIQUE (order_id, unit_code)
);

CREATE INDEX IF NOT EXISTS idx_warranty_preparation_units_order_id
  ON public.warranty_preparation_units(order_id);

CREATE TABLE IF NOT EXISTS public.warranty_activation_outbox (
  event_id UUID PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES public.legacy_orders(id) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL DEFAULT 'warranty_activation_ready',
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'failed', 'delivered', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  last_http_status INTEGER,
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warranty_activation_outbox_retry
  ON public.warranty_activation_outbox(status, next_retry_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.warranty_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_preparation_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_activation_outbox ENABLE ROW LEVEL SECURITY;

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
  FROM (
    SELECT
      row_number() OVER (ORDER BY candidate_sequence) AS candidate_sequence,
      unit_code,
      gender,
      starting_weight_gram
    FROM public.warranty_preparation_units
    WHERE order_id = p_order_id
  ) AS prepared_units;
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

CREATE OR REPLACE FUNCTION public.enqueue_warranty_activation_from_preparation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_ready THEN
    PERFORM public.enqueue_warranty_activation(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_warranty_activation_from_stage_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stage = 'selesai' AND NEW.status = 'completed' THEN
    PERFORM public.enqueue_warranty_activation(NEW.order_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER warranty_preparations_enqueue_activation
AFTER INSERT OR UPDATE OF is_ready ON public.warranty_preparations
FOR EACH ROW EXECUTE FUNCTION public.enqueue_warranty_activation_from_preparation();

CREATE TRIGGER stage_history_enqueue_warranty_activation
AFTER INSERT ON public.stage_history
FOR EACH ROW EXECUTE FUNCTION public.enqueue_warranty_activation_from_stage_history();
