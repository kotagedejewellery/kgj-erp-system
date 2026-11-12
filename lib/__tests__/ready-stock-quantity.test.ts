import { describe, expect, it } from "vitest";
import { parseReadyStockQuantityChange } from "@/lib/inventory/ready-stock-quantity";

describe("parseReadyStockQuantityChange", () => {
  it("accepts a bounded whole-number addition or reduction", () => {
    expect(parseReadyStockQuantityChange("5")).toBe(5);
    expect(parseReadyStockQuantityChange(-2)).toBe(-2);
  });

  it("rejects zero, fractional, and excessive quantity changes", () => {
    expect(parseReadyStockQuantityChange(0)).toBeNull();
    expect(parseReadyStockQuantityChange("1.5")).toBeNull();
    expect(parseReadyStockQuantityChange(1001)).toBeNull();
  });
});
