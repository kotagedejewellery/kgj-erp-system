-- ============================================================
-- 014_legacy_price_breakdown.sql
-- 1. Stores the full Yii2 price breakdown so the ERP can display
--    Subtotal / Diskon / Ongkir / Harga Final correctly:
--      harga_final = total_harga - nilai_promo + biaya_pengiriman
--      sisa_bayar  = harga_final - jumlah_bayar
--    (verified against the kgj production schema, 2026-07-16)
-- 2. Stores the order source: custom vs product-checkout.
--    By-produk orders carry no bahan/finishing/permata in komponen —
--    production specs come from the produk catalog (id_produk).
-- ============================================================

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS nilai_promo DECIMAL(15,2);

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS biaya_pengiriman DECIMAL(15,2);

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS id_promo_diskon INTEGER;

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS id_produk INTEGER;

ALTER TABLE public.legacy_orders
  ADD COLUMN IF NOT EXISTS id_jenis_order INTEGER;
