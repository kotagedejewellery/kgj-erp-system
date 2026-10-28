import { countWorkingDays, getIndonesianHolidays } from "@/lib/working-days";

export const STAGE_H_DAYS: Record<string, { label: string; hDays: number }> = {
  racik_bahan: { label: "Racik & Lebur", hDays: 20 },
  lebur_bahan: { label: "Racik & Lebur", hDays: 20 },
  pembentukan_cincin: { label: "Pembentukan Cincin", hDays: 19 },
  pemasangan_permata: { label: "Microsetting", hDays: 13 },
  cek_kadar: { label: "Cek Kadar", hDays: 11 },
  pemolesan: { label: "Poles", hDays: 11 },
  qc_1: { label: "QC Awal", hDays: 9 },
  laser: { label: "Laser", hDays: 7 },
  finishing: { label: "Finishing", hDays: 5 },
  qc_2: { label: "QC Akhir", hDays: 4 },
  konfirmasi: { label: "Konfirmasi", hDays: 3 },
  packing: { label: "Packing & Pengiriman", hDays: 3 },
  pengiriman: { label: "Packing & Pengiriman", hDays: 3 },
};

const MAX_BASELINE_H_DAYS = 20;

function subtractWorkingDays(endDate: string, workingDays: number): string {
  const date = new Date(endDate);
  let count = 0;
  while (count < workingDays) {
    date.setDate(date.getDate() - 1);
    const day = date.getDay();
    const holidays = getIndonesianHolidays(date.getFullYear());
    const dateStr = date.toISOString().split("T")[0];
    if (day !== 0 && !holidays.includes(dateStr)) {
      count++;
    }
  }
  return date.toISOString().split("T")[0];
}

function getScaleFactor(tglOrder: string | null | undefined, deadline: string): number {
  if (!tglOrder) return 1;
  const totalWD = countWorkingDays(tglOrder, deadline);
  if (totalWD <= 0) return 1;
  return Math.min(1, totalWD / MAX_BASELINE_H_DAYS);
}

export function getStageDeadline(
  tglOrder: string | null | undefined,
  deadline: string,
  stage: string,
): string | null {
  const rule = STAGE_H_DAYS[stage];
  if (!rule) return null;
  const scale = getScaleFactor(tglOrder, deadline);
  const scaledHDays = Math.round(rule.hDays * scale);
  return subtractWorkingDays(deadline, scaledHDays);
}

export interface StageDeadlineStatus {
  targetDate: string;
  isOverdue: boolean;
  daysRemaining: number;
  label: string;
}

export function getStageDeadlineStatus(
  tglOrder: string | null | undefined,
  deadline: string,
  stage: string,
): StageDeadlineStatus | null {
  const rule = STAGE_H_DAYS[stage];
  if (!rule) return null;

  const scale = getScaleFactor(tglOrder, deadline);
  const scaledHDays = Math.round(rule.hDays * scale);
  const targetDate = subtractWorkingDays(deadline, scaledHDays);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const targetStr = targetDate;

  const daysRemaining =
    targetStr >= todayStr
      ? countWorkingDays(todayStr, targetStr)
      : -countWorkingDays(targetStr, todayStr);

  return {
    targetDate,
    isOverdue: daysRemaining < 0,
    daysRemaining,
    label: rule.label,
  };
}
