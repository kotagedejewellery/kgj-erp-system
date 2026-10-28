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
  33: "approval_penerimaan_order",
  10: "racik_bahan",
  34: "approval_racik_bahan",
  35: "lebur_bahan",
  12: "pembentukan_cincin",
  36: "pemasangan_permata",
  37: "pemolesan",
  38: "cek_kadar",
  39: "qc_1",
  40: "approval_qc_1",
  41: "laser",
  24: "finishing",
  42: "approval_produksi",
  43: "qc_2",
  44: "approval_qc_2",
  45: "konfirmasi",
  13: "konfirmasi",
  46: "packing",
  14: "pengiriman",
  15: "selesai",
};

// Yii2 status for Pelunasan. It shares the existing Customer Care stage with
// id_status=45 while outbound ERP sync remains canonical at 45.
export const YII2_STATUS_PELUNASAN = 13;

export function mapStatusToStage(idStatus: number | undefined): string {
  if (idStatus == null) return "penerimaan_order";
  return YII2_STATUS_TO_STAGE[idStatus] ?? "penerimaan_order";
}
