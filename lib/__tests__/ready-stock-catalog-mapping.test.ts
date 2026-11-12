import { describe, expect, it } from "vitest";
import { resolveReadyStockImportRows } from "@/lib/inventory/ready-stock-catalog-mapping";

const rows = [
  { row: 2, modelCode: "S-02", materialCode: "PERAK", size: "16", quantity: 2 },
];

describe("resolveReadyStockImportRows", () => {
  it("uses the only published catalog candidate automatically", () => {
    expect(resolveReadyStockImportRows(rows, [{ sourceProductId: 10, sku: "S-02", name: "Cincin S-02", coverImageUrl: null }], [])).toEqual({
      rows: [{ ...rows[0], sourceProductId: 10, modelName: "Cincin S-02" }],
      candidates: [{ modelCode: "S-02", candidates: [{ sourceProductId: 10, sku: "S-02", name: "Cincin S-02", coverImageUrl: null }], selectedSourceProductId: 10 }],
      errors: [],
    });
  });

  it("requires an explicit selection when a SKU has multiple published candidates", () => {
    const products = [
      { sourceProductId: 10, sku: "S-02", name: "Model lama", coverImageUrl: null },
      { sourceProductId: 11, sku: "S-02", name: "Model baru", coverImageUrl: "https://example.test/new.jpg" },
    ];
    expect(resolveReadyStockImportRows(rows, products, [])).toMatchObject({
      rows: [],
      errors: ["Kode S-02 memiliki lebih dari satu model katalog. Pilih model yang benar."],
    });
    expect(resolveReadyStockImportRows(rows, products, [{ modelCode: "S-02", sourceProductId: 11 }])).toMatchObject({
      rows: [{ ...rows[0], sourceProductId: 11, modelName: "Model baru" }],
      errors: [],
    });
  });

  it("rejects an unavailable catalog selection instead of trusting the browser", () => {
    expect(resolveReadyStockImportRows(rows, [{ sourceProductId: 10, sku: "S-02", name: "Cincin S-02", coverImageUrl: null }], [{ modelCode: "S-02", sourceProductId: 99 }])).toMatchObject({
      rows: [],
      errors: ["Pilihan model untuk S-02 tidak valid"],
    });
  });
});
