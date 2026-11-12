import { parsePositiveGrams } from "@/lib/inventory/grams";

export function parseReadyStockWeight(value: unknown, isRequired: boolean): { value: number | null } | { error: string } {
  const isEmpty = value === undefined || value === null || (typeof value === "string" && !value.trim());
  if (isEmpty) return isRequired ? { error: "Berat aktual wajib diisi untuk bahan ini" } : { value: null };

  const grams = parsePositiveGrams(value);
  return grams === null
    ? { error: "Berat aktual harus berupa gram positif dengan maksimal tiga desimal" }
    : { value: grams };
}

export function canRequireUnitWeight(unweighedActiveUnitCount: number): boolean {
  return unweighedActiveUnitCount === 0;
}
