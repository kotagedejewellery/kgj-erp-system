import { describe, expect, it } from "vitest";
import { parseReadyStockUnitQuery } from "@/lib/inventory/ready-stock-units";

describe("ready-stock physical unit list", () => {
  it("keeps unit-list pagination bounded and filters only valid values", () => {
    expect(parseReadyStockUnitQuery(new URLSearchParams("page=0&page_size=500&brand_id=2&source_product_id=123&location_id=store-a&ring_gender=pria&size=16&status=available&q=SMG-01"))).toEqual({
      page: 1,
      pageSize: 50,
      brandId: 2,
      sourceProductId: 123,
      locationId: "store-a",
      status: "available",
      ringGender: "pria",
      size: "16",
      query: "SMG-01",
    });
  });
});
