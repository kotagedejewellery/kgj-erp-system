const READY_STOCK_GENDERS = [
  { value: "pria", label: "Pria" },
  { value: "wanita", label: "Wanita" },
  { value: "unisex", label: "Unisex" },
] as const;

export type ReadyStockGender = typeof READY_STOCK_GENDERS[number]["value"];

export function parseReadyStockGender(value: unknown): ReadyStockGender | null {
  return typeof value === "string" && READY_STOCK_GENDERS.some((gender) => gender.value === value)
    ? value as ReadyStockGender
    : null;
}

export function parseStoredReadyStockGender(value: unknown): ReadyStockGender | "unspecified" | null {
  return value === "unspecified" ? value : parseReadyStockGender(value);
}

export function readyStockGenderLabel(value: string | null | undefined): string {
  return READY_STOCK_GENDERS.find((gender) => gender.value === value)?.label
    ?? (value === "unspecified" || !value ? "Belum diklasifikasikan" : value);
}

export function getReadyStockGenderOptions(current?: string | null) {
  const legacy = current === "unspecified" ? [{ value: "unspecified", label: "Belum diklasifikasikan" }] : [];
  return [...legacy, ...READY_STOCK_GENDERS];
}
