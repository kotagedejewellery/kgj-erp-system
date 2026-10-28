CREATE TABLE IF NOT EXISTS public.warranty_candidate_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.warranty_preparation_units(id) ON DELETE CASCADE,
  command VARCHAR(20) NOT NULL CHECK (command IN ('validate', 'activate')),
  request_id UUID NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  response JSONB,
  last_error TEXT,
  initiated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, command)
);

CREATE INDEX IF NOT EXISTS idx_warranty_candidate_commands_unit_id
  ON public.warranty_candidate_commands(unit_id);

ALTER TABLE public.warranty_candidate_commands ENABLE ROW LEVEL SECURITY;
