import { describe, expect, it } from "vitest";
import { parseReadyStockVariationRows } from "@/lib/inventory/ready-stock-variations";

describe("parseReadyStockVariationRows", () => {
  it("accepts multiple dynamic ring sizes with positive stock quantities", () => {
    expect(parseReadyStockVariationRows([
      { size: "16", quantity: "3" },
      { size: "18", quantity: 2 },
    ])).toEqual([
      { size: "16", quantity: 3 },
      { size: "18", quantity: 2 },
    ]);
  });

  it("keeps differently written dynamic sizes distinct", () => {
    expect(parseReadyStockVariationRows([{ size: "16", quantity: 1 }, { size: "16.0", quantity: 1 }])).toEqual([
      { size: "16", quantity: 1 },
      { size: "16.0", quantity: 1 },
    ]);
  });

  it("rejects duplicate sizes and invalid quantities before inventory changes", () => {
    expect(parseReadyStockVariationRows([{ size: "16", quantity: 1 }, { size: "16", quantity: 2 }])).toBeNull();
    expect(parseReadyStockVariationRows([{ size: "16", quantity: 0 }])).toBeNull();
  });
});
