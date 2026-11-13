function parsePositiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function parseReadyStockGalleryQuery(searchParams: URLSearchParams) {
  return {
    page: parsePositiveInteger(searchParams.get("page"), 1, 100_000),
    pageSize: parsePositiveInteger(searchParams.get("page_size"), 12, 24),
    query: (searchParams.get("q") ?? "").trim().slice(0, 100),
  };
}
