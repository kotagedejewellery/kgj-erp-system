import { describe, expect, it } from "vitest";
import { canRequireUnitWeight, parseReadyStockWeight } from "@/lib/inventory/ready-stock-weight";

describe("parseReadyStockWeight", () => {
  it("allows an empty weight only when the selected material does not require it", () => {
    expect(parseReadyStockWeight("", false)).toEqual({ value: null });
    expect(parseReadyStockWeight(undefined, false)).toEqual({ value: null });
  });

  it("requires a positive gram value for materials that must be weighed", () => {
    expect(parseReadyStockWeight("", true)).toEqual({ error: "Berat aktual wajib diisi untuk bahan ini" });
    expect(parseReadyStockWeight("0", true)).toEqual({ error: "Berat aktual harus berupa gram positif dengan maksimal tiga desimal" });
  });

  it("rejects an invalid entered weight even when weight is optional", () => {
    expect(parseReadyStockWeight("2.1234", false)).toEqual({ error: "Berat aktual harus berupa gram positif dengan maksimal tiga desimal" });
    expect(parseReadyStockWeight("8.250", false)).toEqual({ value: 8.25 });
  });

  it("does not make weighing mandatory while active units are still unweighed", () => {
    expect(canRequireUnitWeight(0)).toBe(true);
    expect(canRequireUnitWeight(1)).toBe(false);
  });
});
