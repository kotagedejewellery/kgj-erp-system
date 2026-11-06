type StockUnit = {
  id: string;
  source_product_id: number | null;
  status: string;
  catalog_product_name?: string | null;
  catalog_product_sku?: string | null;
  catalog_cover_image_url?: string | null;
};

type CatalogProduct = {
  source_product_id: number;
  sku: string | null;
  name: string;
  cover_image_url: string | null;
};

export type ReadyStockModelSummary = {
  source_product_id: number;
  label: string;
  cover_image_url: string | null;
  available_units: number;
  allocated_units: number;
  allocation_count: number;
};

export function buildReadyStockModelSummaries(
  units: StockUnit[],
  products: CatalogProduct[],
  allocationStockUnitIds: string[],
): ReadyStockModelSummary[] {
  const productsById = new Map(products.map((product) => [product.source_product_id, product]));
  const allocationCounts = new Map<string, number>();
  for (const stockUnitId of allocationStockUnitIds) {
    allocationCounts.set(stockUnitId, (allocationCounts.get(stockUnitId) ?? 0) + 1);
  }

  const summaries = new Map<number, ReadyStockModelSummary>();
  for (const unit of units) {
    if (unit.source_product_id === null) continue;
    const product = productsById.get(unit.source_product_id);
    if (!product && !unit.catalog_product_name) continue;
    const productName = product?.name ?? unit.catalog_product_name as string;
    const productSku = product?.sku ?? unit.catalog_product_sku ?? null;
    const existing = summaries.get(unit.source_product_id) ?? {
      source_product_id: unit.source_product_id,
      label: productSku ? `${productSku} — ${productName}` : productName,
      cover_image_url: product?.cover_image_url ?? unit.catalog_cover_image_url ?? null,
      available_units: 0,
      allocated_units: 0,
      allocation_count: 0,
    };
    if (unit.status === "available") existing.available_units += 1;
    if (unit.status === "allocated") existing.allocated_units += 1;
    existing.allocation_count += allocationCounts.get(unit.id) ?? 0;
    summaries.set(unit.source_product_id, existing);
  }

  return [...summaries.values()].sort((left, right) =>
    right.allocation_count - left.allocation_count || left.label.localeCompare(right.label, "id"),
  );
}
