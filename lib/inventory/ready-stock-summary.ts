type StockUnit = {
  id: string;
  source_product_id: number | null;
  brand_id?: number;
  source_material_id?: number | null;
  location_id?: string | null;
  size?: string | null;
  material_description?: string | null;
  condition?: string | null;
  ring_gender?: string | null;
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
  brand_id: number | null;
  source_material_id: number | null;
  location_id: string | null;
  size: string | null;
  material_description: string | null;
  condition: string | null;
  ring_gender: string | null;
  label: string;
  cover_image_url: string | null;
  available_units: number;
  allocated_units: number;
  inspection_units: number;
  total_units: number;
  allocation_count: number;
};

export type ReadyStockGallerySummary = {
  source_product_id: number;
  brand_id: number | null;
  label: string;
  cover_image_url: string | null;
  available_units: number;
  allocated_units: number;
  inspection_units: number;
  total_units: number;
  allocation_count: number;
  variations: ReadyStockModelSummary[];
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

  const summaries = new Map<string, ReadyStockModelSummary>();
  for (const unit of units) {
    if (unit.source_product_id === null || unit.status === "retired") continue;
    const product = productsById.get(unit.source_product_id);
    if (!product && !unit.catalog_product_name) continue;
    const productName = product?.name ?? unit.catalog_product_name as string;
    const productSku = product?.sku ?? unit.catalog_product_sku ?? null;
    const key = JSON.stringify([unit.source_product_id, unit.brand_id ?? null, unit.source_material_id ?? null, unit.location_id ?? null, unit.size ?? null, unit.condition ?? null, unit.ring_gender ?? "unspecified"]);
    const existing = summaries.get(key) ?? {
      source_product_id: unit.source_product_id,
      brand_id: unit.brand_id ?? null,
      source_material_id: unit.source_material_id ?? null,
      location_id: unit.location_id ?? null,
      size: unit.size ?? null,
      material_description: unit.material_description ?? null,
      condition: unit.condition ?? null,
      ring_gender: unit.ring_gender ?? "unspecified",
      label: productSku ? `${productSku} — ${productName}` : productName,
      cover_image_url: product?.cover_image_url ?? unit.catalog_cover_image_url ?? null,
      available_units: 0,
      allocated_units: 0,
      inspection_units: 0,
      total_units: 0,
      allocation_count: 0,
    };
    if (unit.status === "available") existing.available_units += 1;
    if (unit.status === "allocated") existing.allocated_units += 1;
    if (unit.status === "inspection") existing.inspection_units += 1;
    existing.total_units += 1;
    existing.allocation_count += allocationCounts.get(unit.id) ?? 0;
    summaries.set(key, existing);
  }

  return [...summaries.values()].sort((left, right) =>
    right.allocation_count - left.allocation_count || left.label.localeCompare(right.label, "id"),
  );
}

export function buildReadyStockGallerySummaries(
  summaries: ReadyStockModelSummary[],
): ReadyStockGallerySummary[] {
  const cards = new Map<string, ReadyStockGallerySummary>();
  for (const summary of summaries) {
    const key = [summary.source_product_id, summary.brand_id ?? ""].join(":");
    const card = cards.get(key) ?? {
      source_product_id: summary.source_product_id,
      brand_id: summary.brand_id,
      label: summary.label,
      cover_image_url: summary.cover_image_url,
      available_units: 0,
      allocated_units: 0,
      inspection_units: 0,
      total_units: 0,
      allocation_count: 0,
      variations: [],
    };
    card.available_units += summary.available_units;
    card.allocated_units += summary.allocated_units;
    card.inspection_units += summary.inspection_units;
    card.total_units += summary.total_units;
    card.allocation_count += summary.allocation_count;
    card.variations.push(summary);
    cards.set(key, card);
  }

  return [...cards.values()].sort((left, right) =>
    right.allocation_count - left.allocation_count || left.label.localeCompare(right.label, "id"),
  );
}
