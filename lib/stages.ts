// Stage sequence — canonical ordered list
export const STAGE_SEQUENCE = [
  "penerimaan_order",
  "approval_penerimaan_order",
  "racik_bahan",
  "approval_racik_bahan",
  "lebur_bahan",
  "pembentukan_cincin",
  "pemasangan_permata",
  "pemolesan",
  "cek_kadar",
  "qc_1",
  "approval_qc_1",
  "laser",
  "finishing",
  "approval_produksi",
  "qc_2",
  "approval_qc_2",
  "konfirmasi",
  "packing",
  "pengiriman",
  "selesai",
] as const;

// Customer-facing sequence — excludes internal approval gates and penerimaan_order
export const CUSTOMER_STAGE_SEQUENCE = STAGE_SEQUENCE.filter(
  (s) => !s.startsWith("approval_") && s !== "penerimaan_order",
);

export type StageKey = (typeof STAGE_SEQUENCE)[number];

// Full display labels for timeline / detail views
export const STAGE_LABELS: Record<string, string> = {
  penerimaan_order: "Penerimaan Order",
  approval_penerimaan_order: "Approval Penerimaan Order",
  racik_bahan: "Persiapan Bahan",
  approval_racik_bahan: "Approval Persiapan Bahan",
  lebur_bahan: "Lebur Bahan",
  pembentukan_cincin: "Pembentukan Cincin",
  cek_kadar: "Cek Kadar",
  pemasangan_permata: "Micro Setting",
  pemolesan: "Pemolesan Awal",
  qc_1: "QC Awal",
  approval_qc_1: "Approval QC Awal",
  laser: "Laser Engraving",
  finishing: "Finishing",
  approval_produksi: "Approval Produksi",
  qc_2: "QC Akhir",
  approval_qc_2: "Approval QC Akhir",
  konfirmasi: "Konfirmasi Customer Care",
  packing: "Packing & Persiapan Kirim",
  pengiriman: "Pengiriman",
  selesai: "Selesai",
};

// Which role group each stage belongs to
export const STAGE_GROUP: Record<string, "production" | "operational" | "management"> = {
  penerimaan_order: "operational",
  approval_penerimaan_order: "management",
  racik_bahan: "operational",
  approval_racik_bahan: "management",
  lebur_bahan: "production",
  pembentukan_cincin: "production",
  pemasangan_permata: "production",
  pemolesan: "production",
  cek_kadar: "production",
  qc_1: "operational",
  approval_qc_1: "management",
  laser: "operational",
  finishing: "production",
  approval_produksi: "management",
  qc_2: "operational",
  approval_qc_2: "management",
  konfirmasi: "operational",
  packing: "operational",
  pengiriman: "operational",
  selesai: "operational",
};

// Color scheme for stage badges
export const STAGE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  penerimaan_order: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  approval_penerimaan_order: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  racik_bahan: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  approval_racik_bahan: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  lebur_bahan: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
  pembentukan_cincin: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500" },
  pemasangan_permata: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500" },
  pemolesan: { bg: "bg-stone-50", text: "text-stone-700", border: "border-stone-200", dot: "bg-stone-500" },
  cek_kadar: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", dot: "bg-cyan-500" },
  qc_1: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  approval_qc_1: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  laser: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  finishing: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
  approval_produksi: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  qc_2: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  approval_qc_2: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  konfirmasi: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", dot: "bg-teal-500" },
  packing: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500" },
  pengiriman: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", dot: "bg-slate-500" },
  selesai: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
};

export function getStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
}

export function getStageGroup(stage: string): string {
  return STAGE_GROUP[stage] ?? "other";
}

export function getStageIndex(stage: string): number {
  return STAGE_SEQUENCE.indexOf(stage as StageKey);
}

export function getProgressPercent(currentStage: string): number {
  const idx = getStageIndex(currentStage);
  if (idx < 0) return 0;
  return Math.round((idx / (STAGE_SEQUENCE.length - 1)) * 100);
}

export function isStageCompleted(stage: string, currentStage: string): boolean {
  return getStageIndex(stage) < getStageIndex(currentStage);
}

export function isStageActive(stage: string, currentStage: string): boolean {
  return stage === currentStage;
}

export function isStageUpcoming(stage: string, currentStage: string): boolean {
  return getStageIndex(stage) > getStageIndex(currentStage);
}

// Stages to skip during normal progression (not removed from sequence to
// preserve Yii2 1:1 mapping). effectiveNext() returns the next non-skipped
// stage; use it wherever nextInSequence / STAGE_SEQUENCE[idx+1] was used.
export const SKIP_STAGES = ["lebur_bahan", "cek_kadar"];

export function effectiveNext(stage: string): string | null {
  let idx = getStageIndex(stage);
  while (idx >= 0 && idx < STAGE_SEQUENCE.length - 1) {
    idx++;
    if (!SKIP_STAGES.includes(STAGE_SEQUENCE[idx])) return STAGE_SEQUENCE[idx];
  }
  return null;
}
