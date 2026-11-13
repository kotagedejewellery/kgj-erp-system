import { parseStoredReadyStockGender } from "@/lib/inventory/ready-stock-gender";

const UNIT_STATUSES = ["available", "allocated", "inspection", "retired"] as const;

export function parseReadyStockUnitQuery(searchParams: URLSearchParams) {
  const parsePositiveInteger = (value: string | null) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };
  const status = searchParams.get("status");
  const page = parsePositiveInteger(searchParams.get("page")) ?? 1;
  const pageSize = Math.min(parsePositiveInteger(searchParams.get("page_size")) ?? 25, 50);
  const query = (searchParams.get("q") ?? "").trim().slice(0, 100);
  const size = (searchParams.get("size") ?? "").trim().slice(0, 32);
  const ringGender = parseStoredReadyStockGender(searchParams.get("ring_gender"));

  return {
    page,
    pageSize,
    brandId: parsePositiveInteger(searchParams.get("brand_id")),
    sourceProductId: parsePositiveInteger(searchParams.get("source_product_id")),
    locationId: (searchParams.get("location_id") ?? "").trim() || null,
    status: UNIT_STATUSES.includes(status as typeof UNIT_STATUSES[number]) ? status : null,
    ringGender,
    size: size || null,
    query,
  };
}
