import { describe, expect, it } from "vitest";
import { buildCustomIssueLines } from "@/lib/inventory/custom-issue";

describe("buildCustomIssueLines", () => {
  it("maps each ring material and appraisal weight to an inventory issue line", () => {
    expect(buildCustomIssueLines({
      components: [
        { id_gender: 1, id_jenis_bahan: 28 },
        { id_gender: 2, id_jenis_bahan: 31 },
      ],
      berat_cincin_pria: "8.250",
      berat_cincin_wanita: "4.500",
      materials: [
        { sourceMaterialId: 28, materialId: "material-palladium" },
        { sourceMaterialId: 31, materialId: "material-gold" },
      ],
    })).toEqual([
      { materialId: "material-palladium", weightGrams: "8.250" },
      { materialId: "material-gold", weightGrams: "4.500" },
    ]);
  });

  it("rejects incomplete order facts or an unmapped material", () => {
    const order = {
      components: [{ id_gender: 1, id_jenis_bahan: 28 }],
      berat_cincin_pria: "8.250",
      berat_cincin_wanita: null,
      materials: [{ sourceMaterialId: 28, materialId: "material-palladium" }],
    };

    expect(() => buildCustomIssueLines({ ...order, berat_cincin_pria: null })).toThrow("Berat cincin pria belum tersedia");
    expect(() => buildCustomIssueLines({ ...order, materials: [] })).toThrow("Belum ada mapping inventory untuk bahan Yii2 28");
  });

  it("accepts a single-ring order without requiring a second gender", () => {
    expect(buildCustomIssueLines({
      components: [{ id_gender: 1, id_jenis_bahan: 28 }],
      berat_cincin_pria: "8.250",
      berat_cincin_wanita: null,
      materials: [{ sourceMaterialId: 28, materialId: "material-palladium" }],
    })).toEqual([{ materialId: "material-palladium", weightGrams: "8.250" }]);
  });
});
