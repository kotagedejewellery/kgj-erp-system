import { describe, expect, it } from "vitest";
import { parseInventoryCatalogSnapshot } from "@/lib/inventory/catalog-reference";

const snapshot = {
  contract_version: 1,
  source_system: "yii2",
  snapshot_at: "2026-11-06T10:00:00+07:00",
  categories: [
    { source_category_id: 7, name: "Cincin Perak", image_url: null },
  ],
  products: [
    {
      source_product_id: 123,
      sku: "S-02",
      name: "Cincin Perak S-02",
      is_published: true,
      legacy_primary_category_id: 7,
      category_ids: [7],
      cover_image_url: "https://yii.example.test/uploads/s-02.jpg",
    },
  ],
};

describe("parseInventoryCatalogSnapshot", () => {
  it("accepts the Yii2 catalog reference contract", () => {
    expect(parseInventoryCatalogSnapshot(snapshot)).toEqual(snapshot);
  });

  it("rejects duplicate catalog product identities", () => {
    expect(() => parseInventoryCatalogSnapshot({
      ...snapshot,
      products: [...snapshot.products, snapshot.products[0]],
    })).toThrow("ID produk katalog duplikat");
  });
});
