import { describe, expect, it } from "vitest";
import { searchCatalogProducts } from "@/lib/inventory/catalog-products";

describe("searchCatalogProducts", () => {
  it("finds catalog products by SKU without exposing an unbounded catalog", () => {
    expect(searchCatalogProducts("PTD0740YG")).toEqual([
      expect.objectContaining({ id: 785, label: expect.stringContaining("PTD0740YG") }),
    ]);
    expect(searchCatalogProducts("P")).toEqual([]);
  });
});
