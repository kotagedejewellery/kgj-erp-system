-- ============================================================
-- 017_legacy_brand.sql
-- Adds id_brand column to legacy_orders for multi-brand support
-- (KGJ=1, Hijaz=2, MPM=3). Default 1 = KGJ for existing data.
-- ============================================================

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS id_brand INT NOT NULL DEFAULT 1;
