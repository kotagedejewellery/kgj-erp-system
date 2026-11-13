export const MATERIAL_FAMILY_OPTIONS = [
  { value: "perak", label: "Perak" },
  { value: "palladium", label: "Palladium" },
  { value: "emas_kuning", label: "Emas kuning" },
  { value: "emas_putih", label: "Emas putih" },
  { value: "rosegold", label: "Rosegold" },
] as const;

export type MaterialFamily = (typeof MATERIAL_FAMILY_OPTIONS)[number]["value"];

export function parseMaterialFamily(value: unknown): MaterialFamily | null {
  return typeof value === "string" && MATERIAL_FAMILY_OPTIONS.some((family) => family.value === value)
    ? value as MaterialFamily
    : null;
}

export function materialFamilyLabel(value: string | null | undefined): string {
  return MATERIAL_FAMILY_OPTIONS.find((family) => family.value === value)?.label ?? "Belum diklasifikasikan";
}
