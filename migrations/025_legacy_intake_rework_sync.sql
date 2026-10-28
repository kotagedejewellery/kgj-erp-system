ALTER TABLE public.legacy_order_intakes
  ADD COLUMN IF NOT EXISTS rework_request_id UUID,
  ADD COLUMN IF NOT EXISTS rework_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rework_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rework_sync_status VARCHAR(20)
    CHECK (rework_sync_status IN ('pending', 'failed', 'synced', 'exhausted')),
  ADD COLUMN IF NOT EXISTS rework_sync_attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (rework_sync_attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS rework_last_error TEXT,
  ADD COLUMN IF NOT EXISTS rework_last_http_status INTEGER,
  ADD COLUMN IF NOT EXISTS rework_next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rework_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_legacy_order_intakes_rework_retry
  ON public.legacy_order_intakes(rework_sync_status, rework_next_retry_at)
  WHERE state = 'returned_for_revision'
    AND rework_sync_status IN ('pending', 'failed');
