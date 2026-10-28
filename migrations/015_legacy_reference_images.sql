-- ============================================================
-- 015_legacy_reference_images.sql
-- Adds reference image URL columns to legacy_orders so Yii2 can
-- send customer reference photos for workshop workers to view.
-- ============================================================

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS reference_image_pria_url TEXT;

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS reference_image_wanita_url TEXT;
