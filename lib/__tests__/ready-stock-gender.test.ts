import { describe, expect, it } from "vitest";
import { getReadyStockGenderOptions, parseReadyStockGender, readyStockGenderLabel } from "@/lib/inventory/ready-stock-gender";

describe("ready-stock ring gender", () => {
  it("accepts the three classifications for newly recorded stock", () => {
    expect(parseReadyStockGender("pria")).toBe("pria");
    expect(parseReadyStockGender("wanita")).toBe("wanita");
    expect(parseReadyStockGender("unisex")).toBe("unisex");
    expect(parseReadyStockGender("unspecified")).toBeNull();
  });

  it("keeps legacy stock visibly unclassified without treating it as unisex", () => {
    expect(readyStockGenderLabel("unspecified")).toBe("Belum diklasifikasikan");
    expect(getReadyStockGenderOptions("unspecified")).toContainEqual({ value: "unspecified", label: "Belum diklasifikasikan" });
  });
});
