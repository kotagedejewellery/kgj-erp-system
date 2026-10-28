import Holidays from "date-holidays";

const indonesiaHolidays = new Holidays("ID");

export function getIndonesianHolidays(year: number): string[] {
  return indonesiaHolidays
    .getHolidays(year)
    .filter((h) => h.type === "public")
    .map((h) => h.date.split(" ")[0]);
}

export function countWorkingDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (s >= e) return 0;

  const holidays = getIndonesianHolidays(s.getFullYear());
  let count = 0;
  const cur = new Date(s);

  while (cur < e) {
    const day = cur.getDay();
    const dateStr = cur.toISOString().split("T")[0];
    if (day !== 0 && !holidays.includes(dateStr)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return count;
}

export const KATEGORI_THRESHOLDS = [
  { value: "reguler", label: "Reguler 25-30 hari kerja", minDays: 25 },
  { value: "cepat", label: "Cepat 14 hari kerja", minDays: 14 },
  { value: "kilat", label: "Kilat 7 hari kerja", minDays: 7 },
  { value: "kilat_laser_batik", label: "Kilat Laser Batik 10 hari kerja", minDays: 10 },
  { value: "vvip", label: "VVIP 3 hari kerja", minDays: 3 },
  { value: "revisi", label: "Revisi 14 hari kerja", minDays: 14 },
  { value: "marketplace", label: "Marketplace 14 hari kerja", minDays: 14 },
] as const;

export function getRecommendedKategori(workingDays: number): string | null {
  for (const k of KATEGORI_THRESHOLDS) {
    if (workingDays >= k.minDays) return k.value;
  }
  return null;
}

export function addWorkingDays(start: string, workingDays: number): string {
  const date = new Date(start);
  let count = 0;
  while (count < workingDays) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    const holidays = getIndonesianHolidays(date.getFullYear());
    const dateStr = date.toISOString().split("T")[0];
    if (day !== 0 && !holidays.includes(dateStr)) {
      count++;
    }
  }
  return date.toISOString().split("T")[0];
}

export function getWorkingDaysMessage(workingDays: number): string | null {
  if (workingDays < 3) return `Hanya ${workingDays} hari kerja tersedia — tidak cukup untuk paket manapun (min. 3 hari)`;
  return null;
}
