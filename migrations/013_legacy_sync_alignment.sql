-- ============================================================
-- 013_legacy_sync_alignment.sql
-- Aligns legacy_orders with the 2026-07-15 integration spec
-- (bussiness-documents/integration-spec.md):
--   1. 8 new payload fields from Yii2 (checklist item 2)
--   2. Soft-delete support for reconciliation (checklist item 3)
--   3. sync_logs: allow 'reconcile' sync_type (checklist item 7)
-- ============================================================

-- ── 8 new payload fields (new-orders + webhook payloads) ─────

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS jenis_acara VARCHAR(100);

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS tgl_acara DATE;

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS sumber_closing VARCHAR(100);

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS customer_hobby VARCHAR(255);

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS customer_job VARCHAR(255);

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS jenis_pembayaran VARCHAR(100);

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS jumlah_bayar DECIMAL(15,2);

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS sisa_bayar DECIMAL(15,2);

-- ── Soft-delete reconciliation ───────────────────────────────
-- Yii2 never notifies the ERP about soft-deleted orders; a
-- reconciliation job sets deleted_at for rows absent from the
-- new-orders feed. Rows that reappear get deleted_at cleared.

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_legacy_orders_deleted_at
  ON public.legacy_orders(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── sync_logs: new sync_type for the reconciliation job ──────

ALTER TABLE public.sync_logs
  DROP CONSTRAINT IF EXISTS sync_logs_sync_type_check;

ALTER TABLE public.sync_logs
  ADD CONSTRAINT sync_logs_sync_type_check
  CHECK (sync_type IN ('webhook', 'manual', 'cron', 'reconcile'));

-- ── One-time cleanup (checklist item 3) ──────────────────────
-- ±96 soft-deleted 2026 orders already in Supabase will never
-- reappear in new-orders. Run the reconcile endpoint once after
-- deploying, or mark them manually after comparing with Yii2:
--   UPDATE public.legacy_orders SET deleted_at = now()
--   WHERE kode_order NOT IN (<list from Yii2 new-orders since 2026-01-01>);
