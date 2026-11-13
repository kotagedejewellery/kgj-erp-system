import { describe, expect, it } from "vitest";
import { buildReadyStockAvailability } from "@/lib/inventory/availability";

describe("ready-stock availability", () => {
  it("keeps physical filter metadata attached to its own location and ring type", () => {
    const readyStock = buildReadyStockAvailability({
      units: [
        { brandId: 1, productId: 123, sourceMaterialId: 5, size: "16", ringGender: "pria", locationId: "hijaz" },
        { brandId: 1, productId: 123, sourceMaterialId: 5, size: "16", ringGender: "wanita", locationId: "hijaz" },
        { brandId: 1, productId: 123, sourceMaterialId: 5, size: "16", ringGender: "pria", locationId: "store" },
        { brandId: 1, productId: null, sourceMaterialId: 5, size: "16", ringGender: "pria", locationId: "hijaz" },
      ],
      products: [{ sourceProductId: 123, sku: "S-02", name: "Cincin Perak S-02", coverImageUrl: null }],
      materials: [{ sourceMaterialId: 5, code: "PRK-950", name: "Perak 950", materialFamily: "perak" }],
      locations: [
        { id: "hijaz", name: "Gudang Hijaz" },
        { id: "store", name: "Store Palagan" },
      ],
    });

    expect(readyStock).toEqual(expect.arrayContaining([
      expect.objectContaining({
        brand_id: 1,
        source_product_id: 123,
        source_material_id: 5,
        size: "16",
        ring_type: "pria",
        material_family: "perak",
        location_label: "Gudang Hijaz",
        available_units: 1,
      }),
      expect.objectContaining({ ring_type: "wanita", location_label: "Gudang Hijaz", available_units: 1 }),
      expect.objectContaining({ ring_type: "pria", location_label: "Store Palagan", available_units: 1 }),
    ]));
    expect(readyStock).toHaveLength(3);
  });
});
