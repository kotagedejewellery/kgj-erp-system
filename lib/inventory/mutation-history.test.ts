import { describe, expect, it } from "vitest";
import { filterMutationHistory, inventoryMutationLabel, isInventoryMutationType } from "@/lib/inventory/mutation-history";

const mutations = [
  { id: "one", mutation_type: "opening", material_label: "PRK-925 — Perak 925", stock_unit_label: null, order_code: null, actor_name: "Admin Inventory" },
  { id: "two", mutation_type: "allocate_finished_good", material_label: null, stock_unit_label: "HJZ-S02-001 — S-02", order_code: "HJZ10260001", actor_name: "SVP Operasional" },
];

describe("filterMutationHistory", () => {
  it("filters audit records by type and operational reference", () => {
    expect(filterMutationHistory(mutations, { type: "allocate_finished_good", query: "s-02" }))
      .toEqual([mutations[1]]);
  });

  it("returns all records when no filter is selected", () => {
    expect(filterMutationHistory(mutations, { type: "", query: "" })).toEqual(mutations);
  });

  it("recognizes audited ready-stock transfer and retirement", () => {
    expect(isInventoryMutationType("transfer")).toBe(true);
    expect(isInventoryMutationType("retire_finished_good")).toBe(true);
    expect(inventoryMutationLabel("transfer")).toBe("Pindah gudang");
    expect(inventoryMutationLabel("retire_finished_good")).toBe("Unit ready-stock dinonaktifkan");
  });
});
