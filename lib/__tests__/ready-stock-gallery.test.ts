import { describe, expect, it } from "vitest";
import { parseReadyStockGalleryQuery } from "@/lib/inventory/ready-stock-gallery";

describe("ready-stock model gallery", () => {
  it("keeps gallery pagination bounded while preserving a model search", () => {
    expect(parseReadyStockGalleryQuery(new URLSearchParams("page=0&page_size=99&q=  S-02  "))).toEqual({
      page: 1,
      pageSize: 24,
      query: "S-02",
    });
  });
});
