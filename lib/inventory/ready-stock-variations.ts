import { parseReadyStockQuantityChange } from "@/lib/inventory/ready-stock-quantity";

export const MAX_READY_STOCK_VARIATIONS = 50;

export type ReadyStockVariationRow = {
  size: string;
  quantity: number;
};

export function parseReadyStockVariationRows(value: unknown): ReadyStockVariationRow[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_READY_STOCK_VARIATIONS) return null;

  const sizes = new Set<string>();
  const rows: ReadyStockVariationRow[] = [];
  let totalQuantity = 0;
  for (const valueRow of value) {
    if (!valueRow || typeof valueRow !== "object") return null;
    const row = valueRow as { size?: unknown; quantity?: unknown };
    const size = typeof row.size === "string" ? row.size.trim() : "";
    const quantity = parseReadyStockQuantityChange(row.quantity);
    if (!size || quantity === null || quantity <= 0 || sizes.has(size)) return null;
    sizes.add(size);
    totalQuantity += quantity;
    if (totalQuantity > 1000) return null;
    rows.push({ size, quantity });
  }
  return rows;
}
