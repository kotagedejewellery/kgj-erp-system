export const MAX_READY_STOCK_QUANTITY_CHANGE = 1000;

export function parseReadyStockQuantityChange(value: unknown): number | null {
  const quantity = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isInteger(quantity) && quantity !== 0 && Math.abs(quantity) <= MAX_READY_STOCK_QUANTITY_CHANGE
    ? quantity
    : null;
}
