import { describe, expect, it } from "vitest";
import { buildReadyStockGallerySummaries, buildReadyStockModelSummaries } from "@/lib/inventory/ready-stock-summary";

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
        brand_id: null,
        source_material_id: null,
        location_id: null,
        material_description: null,
        size: null,
        condition: null,
        label: "S-02 \u2014 Cincin Perak S-02",
        cover_image_url: "https://yii.example.test/s-02.jpg",
        available_units: 1,
        allocated_units: 1,
        inspection_units: 0,
        total_units: 2,
        allocation_count: 3,
      },
      {
        source_product_id: 456,
        brand_id: null,
        source_material_id: null,
        location_id: null,
        material_description: null,
        size: null,
        condition: null,
        label: "G-03 \u2014 Cincin Perak G-03",
        cover_image_url: null,
        available_units: 1,
        allocated_units: 0,
        inspection_units: 0,
        total_units: 1,
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
      brand_id: null,
      source_material_id: null,
      location_id: null,
      material_description: null,
      size: null,
      condition: null,
      label: "S-09 \u2014 Cincin Perak S-09",
      cover_image_url: "https://yii.example.test/s-09.jpg",
      available_units: 1,
      allocated_units: 0,
      inspection_units: 0,
      total_units: 1,
      allocation_count: 0,
    }]);
  });

  it("separates stock counts by the physical model variation", () => {
    expect(buildReadyStockModelSummaries(
      [
        { id: "unit-1", source_product_id: 123, brand_id: 1, source_material_id: 10, size: "16", material_description: "Emas 12K", status: "available" },
        { id: "unit-2", source_product_id: 123, brand_id: 1, source_material_id: 10, size: "16", material_description: "Emas 12K", status: "available" },
        { id: "unit-3", source_product_id: 123, brand_id: 1, source_material_id: 10, size: "17", material_description: "Emas 12K", status: "inspection" },
      ],
      [{ source_product_id: 123, sku: "S-02", name: "Cincin S-02", cover_image_url: null }],
      [],
    )).toEqual([
      {
        source_product_id: 123,
        brand_id: 1,
        source_material_id: 10,
        location_id: null,
        material_description: "Emas 12K",
        size: "16",
        condition: null,
        label: "S-02 \u2014 Cincin S-02",
        cover_image_url: null,
        available_units: 2,
        allocated_units: 0,
        inspection_units: 0,
        total_units: 2,
        allocation_count: 0,
      },
      {
        source_product_id: 123,
        brand_id: 1,
        source_material_id: 10,
        location_id: null,
        material_description: "Emas 12K",
        size: "17",
        condition: null,
        label: "S-02 \u2014 Cincin S-02",
        cover_image_url: null,
        available_units: 0,
        allocated_units: 0,
        inspection_units: 1,
        total_units: 1,
        allocation_count: 0,
      },
    ]);
  });

  it("separates otherwise identical units kept in different warehouses or conditions", () => {
    const summaries = buildReadyStockModelSummaries(
      [
        { id: "unit-1", source_product_id: 123, brand_id: 1, source_material_id: 10, location_id: "warehouse-a", size: "16", condition: "good", status: "available" },
        { id: "unit-2", source_product_id: 123, brand_id: 1, source_material_id: 10, location_id: "warehouse-b", size: "16", condition: "good", status: "available" },
        { id: "unit-3", source_product_id: 123, brand_id: 1, source_material_id: 10, location_id: "warehouse-a", size: "16", condition: "inspection", status: "inspection" },
      ],
      [{ source_product_id: 123, sku: "S-02", name: "Cincin S-02", cover_image_url: null }],
      [],
    );

    expect(summaries).toHaveLength(3);
    expect(summaries).toEqual(expect.arrayContaining([
      expect.objectContaining({ location_id: "warehouse-a", condition: "good", available_units: 1 }),
      expect.objectContaining({ location_id: "warehouse-b", condition: "good", available_units: 1 }),
      expect.objectContaining({ location_id: "warehouse-a", condition: "inspection", inspection_units: 1 }),
    ]));
  });

  it("keeps dynamic size and condition text from colliding in one variation", () => {
    const summaries = buildReadyStockModelSummaries(
      [
        { id: "unit-1", source_product_id: 123, brand_id: 1, source_material_id: 10, location_id: "warehouse-a", size: "16:good", condition: "new", status: "available" },
        { id: "unit-2", source_product_id: 123, brand_id: 1, source_material_id: 10, location_id: "warehouse-a", size: "16", condition: "good:new", status: "available" },
      ],
      [{ source_product_id: 123, sku: "S-02", name: "Cincin S-02", cover_image_url: null }],
      [],
    );

    expect(summaries).toHaveLength(2);
  });

  it("does not split the same physical variation because of its free-text description", () => {
    expect(buildReadyStockModelSummaries(
      [
        { id: "unit-1", source_product_id: 123, brand_id: 1, source_material_id: 10, size: "16", material_description: "Emas 12K", status: "available" },
        { id: "unit-2", source_product_id: 123, brand_id: 1, source_material_id: 10, size: "16", material_description: "Emas 12 Karat", status: "available" },
      ],
      [{ source_product_id: 123, sku: "S-02", name: "Cincin S-02", cover_image_url: null }],
      [],
    )).toMatchObject([{ available_units: 2, total_units: 2, size: "16" }]);
  });
});

describe("buildReadyStockGallerySummaries", () => {
  it("shows one catalog card per model and brand while retaining its physical variations", () => {
    expect(buildReadyStockGallerySummaries([
      {
        source_product_id: 123, brand_id: 1, source_material_id: 10, location_id: "warehouse-a", material_description: "Emas 12K", size: "16", condition: "good",
        label: "S-02 â€” Cincin S-02", cover_image_url: "https://yii.example.test/s-02.jpg",
        available_units: 2, allocated_units: 0, inspection_units: 0, total_units: 2, allocation_count: 0,
      },
      {
        source_product_id: 123, brand_id: 1, source_material_id: 10, location_id: "warehouse-a", material_description: "Emas 12K", size: "17", condition: "good",
        label: "S-02 â€” Cincin S-02", cover_image_url: "https://yii.example.test/s-02.jpg",
        available_units: 1, allocated_units: 1, inspection_units: 0, total_units: 2, allocation_count: 1,
      },
    ])).toEqual([{
      source_product_id: 123,
      brand_id: 1,
      label: "S-02 â€” Cincin S-02",
      cover_image_url: "https://yii.example.test/s-02.jpg",
      available_units: 3,
      allocated_units: 1,
      inspection_units: 0,
      total_units: 4,
      allocation_count: 1,
      variations: [
        expect.objectContaining({ size: "16", available_units: 2 }),
        expect.objectContaining({ size: "17", available_units: 1 }),
      ],
    }]);
  });
});
