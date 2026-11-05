// lib/legacy/status.ts
//
// 1:1 mapping between Yii2 id_status and ERP stage keys.
// Kept in sync with the live Yii2 system's `order_statuses` table.
// Last updated: 2026-07-13 — 20-stage 1:1 alignment.
//
// id_status=13 (Pelunasan) maps to the existing Customer Care stage so it
// does not add a workshop stage or input form.

export const YII2_STATUS_TO_STAGE: Record<number, string> = {
  9:  "penerimaan_order",
  35: "approval_penerimaan_order",
  10: "racik_bahan",
  36: "approval_racik_bahan",
  37: "lebur_bahan",
  12: "pembentukan_cincin",
  38: "pemasangan_permata",
  39: "pemolesan",
  40: "cek_kadar",
  41: "qc_1",
  42: "approval_qc_1",
  43: "laser",
  24: "finishing",
  44: "approval_produksi",
  45: "qc_2",
  46: "approval_qc_2",
  47: "konfirmasi",
  13: "konfirmasi",
  48: "packing",
  14: "pengiriman",
  15: "selesai",
};

// Yii2 status for Pelunasan. It shares the existing Customer Care stage with
// id_status=47 while outbound ERP sync remains canonical at 47.
export const YII2_STATUS_PELUNASAN = 13;

export function mapStatusToStage(idStatus: number | undefined): string {
  if (idStatus == null) return "penerimaan_order";
  return YII2_STATUS_TO_STAGE[idStatus] ?? "penerimaan_order";
}
