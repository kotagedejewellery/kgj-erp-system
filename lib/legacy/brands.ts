// lib/legacy/brands.ts
// Multi-brand constants. Sync with Yii2 brand table.

export const BRANDS: Record<number, { code: string; name: string }> = {
  1: { code: "KGJ", name: "Kota Gede Jewellery" },
  2: { code: "HJZ", name: "Hijaz" },
  3: { code: "MP", name: "Marketplace" },
};

export const BRAND_FILTER_OPTIONS = [
  { value: "KGJ", label: "KGJ" },
  { value: "HJZ", label: "Hijaz" },
  { value: "MP", label: "MPM" },
] as const;

export function getBrandPrefix(kodeOrder: string): string | null {
  const match = kodeOrder.match(/^([A-Z]+)\d/);
  return match ? match[1] : null;
}

export function getBrandFilterCode(kodeOrder: string): string | null {
  const prefix = getBrandPrefix(kodeOrder);
  return prefix === "MPM" ? "MP" : prefix;
}

export function getBrandIdFromFilterCode(brandCode: string): number | null {
  const entry = Object.entries(BRANDS).find(([, brand]) => brand.code === brandCode);
  return entry ? Number(entry[0]) : null;
}

export function getBrandName(idBrand: number | null | undefined): string {
  if (idBrand == null) return "KGJ";
  return BRANDS[idBrand]?.name ?? `Brand #${idBrand}`;
}

export function getBrandCode(idBrand: number | null | undefined): string {
  return BRANDS[idBrand ?? 1]?.code ?? "KGJ";
}

export function getBrandDisplayName(idBrand: number | null | undefined): string {
  if (idBrand === 3) return "MPM";
  return getBrandCode(idBrand);
}
