CREATE TABLE IF NOT EXISTS public.brand_intake_policies (
  brand_code VARCHAR(20) PRIMARY KEY,
  requires_pre_receipt_validation BOOLEAN NOT NULL DEFAULT FALSE,
  validator_permission VARCHAR(100) NOT NULL DEFAULT 'can_validate_intake',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.brand_intake_policies (
  brand_code,
  requires_pre_receipt_validation,
  validator_permission,
  is_active
)
VALUES
  ('KGJ', FALSE, 'can_validate_intake', TRUE),
  ('HJZ', FALSE, 'can_validate_intake', TRUE),
  ('MP', TRUE, 'can_validate_intake', TRUE)
ON CONFLICT (brand_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.legacy_order_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_order_id UUID NOT NULL UNIQUE REFERENCES public.legacy_orders(id) ON DELETE CASCADE,
  state VARCHAR(40) NOT NULL CHECK (state IN (
    'pending_spv_cs_validation',
    'approved_spv_cs',
    'returned_for_revision',
    'rejected_by_spv_cs',
    'cancelled_from_source'
  )),
  reason TEXT,
  decided_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_order_intakes_state
  ON public.legacy_order_intakes(state, updated_at DESC);

INSERT INTO public.roles (
  name,
  role_group,
  description,
  permissions,
  allowed_stages
)
VALUES (
  'customer_service_supervisor',
  'management',
  'Supervisor Customer Service â€” validasi intake order',
  '{"can_read": true, "can_insert": false, "can_update": true, "can_delete": false, "can_validate_intake": true}'::jsonb,
  '[]'::jsonb
)
ON CONFLICT (name) DO NOTHING;
