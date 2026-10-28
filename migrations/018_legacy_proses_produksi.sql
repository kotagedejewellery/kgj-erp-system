-- ============================================================
-- 018_legacy_proses_produksi.sql
-- Adds Yii2 paket/proses produksi fields to legacy_orders.
-- Yii2 now sends id_proses_produksi (int), proses_produksi (nama paket),
-- and proses_produksi_label (nama + durasi). Additive, idempotent.
-- ============================================================

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS id_proses_produksi INTEGER;

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS proses_produksi VARCHAR(100);

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS proses_produksi_label VARCHAR(200);
