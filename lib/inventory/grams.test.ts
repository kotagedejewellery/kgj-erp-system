import { describe, expect, it } from "vitest";
import { parsePositiveGrams } from "@/lib/inventory/grams";

describe("parsePositiveGrams", () => {
  it("accepts positive values with at most three decimal places", () => {
    expect(parsePositiveGrams("8.250")).toBe(8.25);
    expect(parsePositiveGrams(0.001)).toBe(0.001);
  });

  it("rejects zero, negative, and values that would be rounded by the database", () => {
    expect(parsePositiveGrams("0.000")).toBeNull();
    expect(parsePositiveGrams("8.2501")).toBeNull();
    expect(parsePositiveGrams("-1.000")).toBeNull();
  });
});
