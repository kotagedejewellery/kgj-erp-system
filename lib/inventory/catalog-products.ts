import { PRODUK_LABELS } from "@/lib/legacy/produk-labels";

export type CatalogProductOption = {
  id: number;
  label: string;
};

export function searchCatalogProducts(query: string, limit = 20): CatalogProductOption[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return [];

  return Object.entries(PRODUK_LABELS)
    .map(([id, product]) => ({
      id: Number(id),
      label: product.sku ? `${product.sku} — ${product.nama}` : product.nama,
    }))
    .filter((product) => product.label.toLowerCase().includes(normalizedQuery))
    .slice(0, limit);
}
