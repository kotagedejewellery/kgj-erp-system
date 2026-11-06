import { describe, expect, it } from "vitest";
import { buildReadyStockModelSummaries } from "@/lib/inventory/ready-stock-summary";

describe("buildReadyStockModelSummaries", () => {
  it("groups physical units by catalog model and counts allocations", () => {
    expect(buildReadyStockModelSummaries(
      [
        { id: "unit-1", source_product_id: 123, status: "available" },
        { id: "unit-2", source_product_id: 123, status: "allocated" },
        { id: "unit-3", source_product_id: 456, status: "available" },
      ],
      [
        { source_product_id: 123, sku: "S-02", name: "Cincin Perak S-02", cover_image_url: "https://yii.example.test/s-02.jpg" },
        { source_product_id: 456, sku: "G-03", name: "Cincin Perak G-03", cover_image_url: null },
      ],
      ["unit-1", "unit-2", "unit-2"],
    )).toEqual([
      {
        source_product_id: 123,
        label: "S-02 — Cincin Perak S-02",
        cover_image_url: "https://yii.example.test/s-02.jpg",
        available_units: 1,
        allocated_units: 1,
        allocation_count: 3,
      },
      {
        source_product_id: 456,
        label: "G-03 — Cincin Perak G-03",
        cover_image_url: null,
        available_units: 1,
        allocated_units: 0,
        allocation_count: 0,
      },
    ]);
  });

  it("keeps a model label available for audit when its catalog reference changes", () => {
    expect(buildReadyStockModelSummaries(
      [{
        id: "unit-legacy", source_product_id: 999, status: "available",
        catalog_product_sku: "S-09", catalog_product_name: "Cincin Perak S-09",
        catalog_cover_image_url: "https://yii.example.test/s-09.jpg",
      }],
      [],
      [],
    )).toEqual([{
      source_product_id: 999,
      label: "S-09 — Cincin Perak S-09",
      cover_image_url: "https://yii.example.test/s-09.jpg",
      available_units: 1,
      allocated_units: 0,
      allocation_count: 0,
    }]);
  });
});
