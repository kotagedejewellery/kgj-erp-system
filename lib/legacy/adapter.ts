// lib/legacy/adapter.ts
//
// Maps legacy Yii2 order data (legacy_orders + tracking_stages + stage_history)
// into the object shapes main-erp API routes already return, so the frontend
// (components/pages) stays byte-for-byte unchanged.
//
// Fields with no legacy equivalent are returned as
// null (or "—" where a string is required by the UI). Only the DISPLAYED DATA
// changes; the response contract does not.

import { mapStatusToStage } from "@/lib/legacy/status";
import {
  komponenLabel,
  fontLabel,
  produkKategoriLabel,
} from "@/lib/legacy/komponen-labels";
import { produkInfo, jenisOrderLabel } from "@/lib/legacy/produk-labels";

// ── Yii2 inbound payload shape ────────────────────────────────────────────────

export interface Yii2OrderPayload {
  id: number;
  kode_order: string;
  no_nota?: string;
  nama: string;
  email?: string;
  no_hp?: string;
  alamat?: string;
  alamat_lengkap?: string;
  tgl_order?: string;
  tgl_selesai?: string;
  tgl_deadline_tukang?: string;
  id_status?: number;
  total_harga?: string;
  harga_final?: string;
  order_down_payment?: string;
  nilai_promo?: string;
  biaya_pengiriman?: string;
  id_promo_diskon?: number | null;
  id_produk?: number | null;
  id_jenis_order?: number | null;
  berat_cincin_pria?: string;
  berat_cincin_wanita?: string;
  catatan?: string;
  jenis_acara?: string;
  tgl_acara?: string;
  sumber_closing?: string;
  customer_hobby?: string;
  customer_job?: string;
  jenis_pembayaran?: string;
  jumlah_bayar?: string;
  sisa_bayar?: string;
  komponen?: Record<string, unknown>[];
  id_brand?: number;
  id_proses_produksi?: number | null;
  proses_produksi?: string | null;
  proses_produksi_label?: string | null;
  reference_image_pria_url?: string;
  reference_image_wanita_url?: string;
}

function toNumeric(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value: string | undefined): string | null {
  if (!value || value === "0000-00-00") return null;
  return value;
}

export function buildLegacyOrderRow(order: Yii2OrderPayload) {
  return {
    legacy_id: order.id,
    kode_order: order.kode_order,
    no_nota: order.no_nota ?? null,
    nama: order.nama,
    email: order.email ?? null,
    no_hp: order.no_hp ?? null,
    alamat: order.alamat ?? null,
    alamat_lengkap: order.alamat_lengkap ?? null,
    tgl_order: toDate(order.tgl_order),
    tgl_selesai: toDate(order.tgl_selesai),
    tgl_deadline_tukang: toDate(order.tgl_deadline_tukang),
    id_status: order.id_status ?? null,
    total_harga: toNumeric(order.total_harga),
    harga_final: toNumeric(order.harga_final),
    order_down_payment: toNumeric(order.order_down_payment),
    nilai_promo: toNumeric(order.nilai_promo),
    biaya_pengiriman: toNumeric(order.biaya_pengiriman),
    id_promo_diskon: order.id_promo_diskon ?? null,
    id_produk: order.id_produk ?? null,
    id_jenis_order: order.id_jenis_order ?? null,
    berat_cincin_pria: toNumeric(order.berat_cincin_pria),
    berat_cincin_wanita: toNumeric(order.berat_cincin_wanita),
    catatan: order.catatan ?? null,
    jenis_acara: order.jenis_acara ?? null,
    tgl_acara: toDate(order.tgl_acara),
    sumber_closing: order.sumber_closing ?? null,
    customer_hobby: order.customer_hobby ?? null,
    customer_job: order.customer_job ?? null,
    jenis_pembayaran: order.jenis_pembayaran ?? null,
    jumlah_bayar: toNumeric(order.jumlah_bayar),
    sisa_bayar: toNumeric(order.sisa_bayar),
    komponen: order.komponen ?? [],
    id_brand: order.id_brand ?? 1,
    id_proses_produksi: order.id_proses_produksi ?? null,
    proses_produksi: order.proses_produksi ?? null,
    proses_produksi_label: order.proses_produksi_label ?? null,
    reference_image_pria_url: order.reference_image_pria_url ?? null,
    reference_image_wanita_url: order.reference_image_wanita_url ?? null,
    last_synced_at: new Date().toISOString(),
  };
}

// Full-field upsert for existing orders (spec checklist item 1): Yii2 fires
// the webhook on EVERY save, so every field may have changed — not just
// id_status. Identity fields (legacy_id, kode_order) are never rewritten.
// Re-applying an identical payload is a harmless no-op at the row level.
export function buildLegacyOrderUpdate(order: Yii2OrderPayload) {
  const { legacy_id: _legacyId, kode_order: _kodeOrder, ...updatable } =
    buildLegacyOrderRow(order);
  const update: Record<string, unknown> = { ...updatable, deleted_at: null };
  // Only the pull feed (new-orders) carries nilai_promo/biaya_pengiriman;
  // webhook payloads omit them — don't clobber pull-synced values with null.
  if (order.nilai_promo === undefined) delete update.nilai_promo;
  if (order.biaya_pengiriman === undefined) delete update.biaya_pengiriman;
  if (order.id_produk === undefined) delete update.id_produk;
  if (order.id_jenis_order === undefined) delete update.id_jenis_order;
  if (order.id_brand === undefined) delete update.id_brand;
  if (order.id_proses_produksi === undefined) delete update.id_proses_produksi;
  if (order.proses_produksi === undefined) delete update.proses_produksi;
  if (order.proses_produksi_label === undefined) delete update.proses_produksi_label;
  if (order.reference_image_pria_url === undefined) delete update.reference_image_pria_url;
  if (order.reference_image_wanita_url === undefined) delete update.reference_image_wanita_url;
  return update;
}

// ── Source row shapes (public.legacy_orders / public.tracking_stages) ─────────

export interface LegacyOrderRow {
  id: string;
  legacy_id: number;
  kode_order: string;
  no_nota: string | null;
  nama: string;
  email: string | null;
  no_hp: string | null;
  alamat: string | null;
  alamat_lengkap: string | null;
  tgl_order: string | null;
  tgl_selesai: string | null;
  tgl_deadline_tukang: string | null;
  id_status: number | null;
  total_harga: number | null;
  harga_final: number | null;
  order_down_payment: number | null;
  nilai_promo: number | null;
  biaya_pengiriman: number | null;
  id_promo_diskon: number | null;
  id_produk: number | null;
  id_jenis_order: number | null;
  berat_cincin_pria: number | null;
  berat_cincin_wanita: number | null;
  catatan: string | null;
  jenis_acara: string | null;
  tgl_acara: string | null;
  sumber_closing: string | null;
  customer_hobby: string | null;
  customer_job: string | null;
  jenis_pembayaran: string | null;
  jumlah_bayar: number | null;
  sisa_bayar: number | null;
  komponen: Record<string, unknown>[] | null;
  id_brand: number | null;
  id_proses_produksi: number | null;
  proses_produksi: string | null;
  proses_produksi_label: string | null;
  reference_image_pria_url: string | null;
  reference_image_wanita_url: string | null;
  last_synced_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
}

export interface TrackingStageRow {
  id: string;
  order_id: string;
  current_stage: string;
  stage_status: string;
  assigned_to: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

// ── Status mapping ────────────────────────────────────────────────────────────

// main-erp order status vocabulary: in_progress | waiting_approval | rework |
// completed. Legacy tracking only distinguishes in_progress vs completed, so we
// derive a best-effort status from the tracking pointer.
export function mapLegacyStatus(
  stageStatus: string | null | undefined,
  currentStage: string | null | undefined,
): string {
  if (currentStage === "selesai" || stageStatus === "completed") return "completed";
  if (currentStage?.startsWith("approval_")) return "waiting_approval";
  return "in_progress";
}

// Resolve the effective current stage: prefer the tracking pointer, otherwise
// derive from the Yii2 id_status, otherwise the pipeline entry point.
export function resolveCurrentStage(
  order: LegacyOrderRow,
  tracking?: TrackingStageRow | null,
): string {
  if (tracking?.current_stage) return tracking.current_stage;
  if (order.id_status === 15) return "selesai";
  return mapStatusToStage(order.id_status ?? undefined);
}

// ── Order summary (workshop/orders, monitoring lists, supervisor lists) ───────

export interface OrderSummary {
  id: string;
  order_number: string;
  current_stage: string;
  status: string;
  deadline: string | null;
  updated_at: string | null;
  customer_name: string | null;
  customer_wa: string | null;
  proses_produksi: string | null;
}

export function legacyToOrderSummary(
  order: LegacyOrderRow,
  tracking?: TrackingStageRow | null,
): OrderSummary {
  const current_stage = resolveCurrentStage(order, tracking);
  return {
    id: order.id,
    order_number: order.kode_order,
    current_stage,
    status: mapLegacyStatus(tracking?.stage_status, current_stage),
    deadline: order.tgl_selesai ?? null,
    updated_at: tracking?.updated_at ?? order.last_synced_at ?? order.created_at ?? null,
    customer_name: order.nama ?? null,
    customer_wa: order.no_hp ?? null,
    proses_produksi: order.proses_produksi ?? null,
  };
}

// ── Order detail (order-detail route) ─────────────────────────────────────────
//
// Same key set the frontend consumes today. Every field that the
// legacy schema cannot supply is null; the UI already renders "—"/blank for null.

export function legacyToOrderDetail(
  order: LegacyOrderRow,
  tracking?: TrackingStageRow | null,
) {
  const current_stage = resolveCurrentStage(order, tracking);

  // Parse komponen array: split by gender into pria (1) / wanita (2).
  const komponenList = (order.komponen ?? []) as Array<Record<string, unknown>>;
  const pria = komponenList.find((k) => k.id_gender === 1);
  const wanita = komponenList.find((k) => k.id_gender === 2);

  // Per-ring notes for OrderDetailPopup's keterangan bullet list: product
  // category, quantity, and the komponen free-text note.
  const buildKeterangan = (k?: Record<string, unknown>) => {
    if (!k) return null;
    const items = [
      produkKategoriLabel(k.id_produk_kategori),
      k.jumlah ? `Jumlah: ${k.jumlah}` : null,
      typeof k.keterangan === "string" && k.keterangan.trim()
        ? k.keterangan.replace(/<[^>]*>/g, "").trim()
        : null,
    ].filter(Boolean) as string[];
    return items.length > 0 ? items : null;
  };

  const fonts = [
    fontLabel(pria?.id_ukiran),
    fontLabel(wanita?.id_ukiran),
  ].filter(Boolean) as string[];

  const labelArr = (id: unknown): string[] | null => {
    const label = komponenLabel(id);
    return label ? [label] : null;
  };

  // Price breakdown (Yii2 arithmetic, verified against the kgj DB):
  //   harga_final = total_harga - nilai_promo + biaya_pengiriman
  //   sisa_bayar  = harga_final - jumlah_bayar
  // harga_final from Yii2 is authoritative; compute only when absent.
  const hargaFinal =
    order.harga_final ??
    (order.total_harga != null
      ? order.total_harga -
        (order.nilai_promo ?? 0) +
        (order.biaya_pengiriman ?? 0)
      : null);

  const sisaBayar =
    order.sisa_bayar ??
    (hargaFinal != null && order.jumlah_bayar != null
      ? hargaFinal - order.jumlah_bayar
      : null);

  // Order source: product checkout (id_produk set) vs custom. By-produk
  // orders carry no bahan/finishing/permata in komponen — production specs
  // live in the produk catalog.
  const produk = produkInfo(order.id_produk);

  return {
    id: order.id,
    order_number: order.kode_order,
    no_nota: order.no_nota ?? null,
    produk_nama: produk?.nama ?? null,
    produk_sku: produk?.sku ?? null,
    produk_spesifikasi: produk?.spesifikasi ?? null,
    jenis_order: jenisOrderLabel(order.id_jenis_order),
    customer_name: order.nama ?? null,
    customer_wa: order.no_hp ?? null,
    customer_email: order.email ?? null,
    customer_instagram: null,
    customer_hobby: order.customer_hobby ?? null,
    customer_job: order.customer_job ?? null,
    tgl_chat: null,
    tgl_order: order.tgl_order ?? null,
    tgl_acara: order.tgl_acara ?? null,
    deadline: order.tgl_selesai ?? null,
    deadline_tukang: order.tgl_deadline_tukang ?? null,
    acara: order.jenis_acara ?? null,
    kebutuhan_acara: null,
    alat_ukur: null,
    gramasi_pria: order.berat_cincin_pria ?? null,
    gramasi_wanita: order.berat_cincin_wanita ?? null,
    ukiran_cincin_pria: null,
    ukiran_cincin_wanita: null,
    ukuran_pria: pria?.ukuran as string ?? null,
    ukiran_pria: pria?.teks as string ?? null,
    jenis_cincin_pria: komponenLabel(pria?.id_jenis_bahan),
    model_bentuk_pria: null,
    microsetting_pria: labelArr(pria?.id_microsetting),
    detail_laser_pria: labelArr(pria?.id_laser),
    detail_finishing_pria: labelArr(pria?.id_finishing),
    keterangan_pria: buildKeterangan(pria),
    ukuran_wanita: wanita?.ukuran as string ?? null,
    ukiran_wanita: wanita?.teks as string ?? null,
    jenis_cincin_wanita: komponenLabel(wanita?.id_jenis_bahan),
    model_bentuk_wanita: null,
    microsetting_wanita: labelArr(wanita?.id_microsetting),
    detail_laser_wanita: labelArr(wanita?.id_laser),
    detail_finishing_wanita: labelArr(wanita?.id_finishing),
    keterangan_wanita: buildKeterangan(wanita),
    font: fonts.length > 0 ? [...new Set(fonts)].join(" / ") : null,
    laser_position: null,
    harga: hargaFinal,
    subtotal: order.total_harga ?? null,
    diskon: order.nilai_promo ?? null,
    ongkir: order.biaya_pengiriman ?? null,
    dp_amount: order.order_down_payment ?? null,
    jenis_pembayaran: order.jenis_pembayaran ?? null,
    jumlah_bayar: order.jumlah_bayar ?? null,
    sisa_bayar: sisaBayar,
    order_via: null,
    sumber_media: order.sumber_closing ?? null,
    kategori: order.proses_produksi ?? null,
    proses_produksi: order.proses_produksi ?? null,
    proses_produksi_label: order.proses_produksi_label ?? null,
    transfer_ke_bank: null,
    // Build jenis_cincin_features from komponen gemstone labels
    jenis_cincin_features: [
      komponenLabel(pria?.id_permata),
      komponenLabel(wanita?.id_permata),
    ].filter(Boolean) as string[] | null,
    dari_artis_detail: null,
    pengiriman: null,
    box: null,
    alamat_pengiriman: order.alamat_lengkap ?? order.alamat ?? null,
    kelurahan: null,
    kecamatan: null,
    kabupaten_kota: null,
    provinsi: null,
    kodepos: null,
    reference_image_pria_url: order.reference_image_pria_url ?? null,
    reference_image_wanita_url: order.reference_image_wanita_url ?? null,
    current_stage,
    status: mapLegacyStatus(tracking?.stage_status, current_stage),
    form_status: null,
    created_at: order.created_at ?? order.tgl_order ?? null,
    updated_at: tracking?.updated_at ?? order.last_synced_at ?? null,
    created_by_name: null,
    catatan: order.catatan ?? null,
  };
}
