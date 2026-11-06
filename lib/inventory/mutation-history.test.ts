import { describe, expect, it } from "vitest";
import { filterMutationHistory } from "@/lib/inventory/mutation-history";

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
});
