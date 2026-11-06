import { describe, expect, it } from "vitest";
import {
  hasSourceMaterialId,
  sourceMaterialOptions,
} from "@/lib/inventory/source-materials";

describe("sourceMaterialOptions", () => {
  const rows = [
    { komponen: [{ id_jenis_bahan: 30 }, { id_jenis_bahan: "2" }] },
    { komponen: [{ id_jenis_bahan: 2 }, { id_jenis_bahan: 99999 }] },
  ];

  it("lists the material names referenced by synced Yii2 orders", () => {
    expect(sourceMaterialOptions(rows)).toEqual([
      { id: 2, name: "Palladium 10%" },
      { id: 30, name: "Silver 950" },
    ]);
  });

  it("only accepts a material reference that appears in synced order components", () => {
    expect(hasSourceMaterialId(rows, 2)).toBe(true);
    expect(hasSourceMaterialId(rows, 99999)).toBe(false);
  });
});
