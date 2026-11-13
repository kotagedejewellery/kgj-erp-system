const STANDARD_READY_STOCK_CONDITIONS = [
  { value: "good", label: "Baik" },
  { value: "damaged", label: "Perlu perbaikan" },
] as const;

export function isStandardReadyStockCondition(value: string): boolean {
  return STANDARD_READY_STOCK_CONDITIONS.some((condition) => condition.value === value);
}

export function readyStockConditionLabel(value: string | null | undefined): string {
  return STANDARD_READY_STOCK_CONDITIONS.find((condition) => condition.value === value)?.label ?? value ?? "—";
}

export function getReadyStockConditionOptions(current?: string | null) {
  const legacy = current && !isStandardReadyStockCondition(current)
    ? [{ value: current, label: `Kondisi lama: ${current}` }]
    : [];
  return [...legacy, ...STANDARD_READY_STOCK_CONDITIONS];
}
