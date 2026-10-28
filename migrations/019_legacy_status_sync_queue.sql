-- Durable Main-ERP -> Yii2 status-sync queue.
-- Review against the live Supabase schema before applying.

CREATE TABLE IF NOT EXISTS public.legacy_status_sync_queue (
  order_id UUID PRIMARY KEY REFERENCES public.legacy_orders(id) ON DELETE CASCADE,
  legacy_id INTEGER NOT NULL,
  stage VARCHAR(50) NOT NULL,
  id_status INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'failed', 'synced', 'exhausted')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  last_http_status INTEGER,
  last_response TEXT,
  next_retry_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_status_sync_queue_retry
  ON public.legacy_status_sync_queue(status, next_retry_at)
  WHERE status IN ('pending', 'failed');
