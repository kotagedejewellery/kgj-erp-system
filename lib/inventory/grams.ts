export function parsePositiveGrams(value: unknown): number | null {
  const raw = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  if (!/^\d+(?:\.\d{1,3})?$/.test(raw)) return null;
  const grams = Number(raw);
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

