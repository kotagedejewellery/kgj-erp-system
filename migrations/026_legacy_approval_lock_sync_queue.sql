CREATE TABLE IF NOT EXISTS public.legacy_approval_lock_sync_queue (
  order_id UUID PRIMARY KEY REFERENCES public.legacy_orders(id) ON DELETE CASCADE,
  legacy_id INTEGER NOT NULL,
  kode_order VARCHAR(100) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'failed', 'synced', 'exhausted')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  last_http_status INTEGER,
  next_retry_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_approval_lock_sync_queue_retry
  ON public.legacy_approval_lock_sync_queue(status, next_retry_at)
  WHERE status IN ('pending', 'failed');
