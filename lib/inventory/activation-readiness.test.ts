import { describe, expect, it } from "vitest";
import { buildInventoryActivationChecklist, isInventoryReadyForActivation } from "@/lib/inventory/activation-readiness";

const locations = [
  { id: "warehouse", location_type: "warehouse", is_default: true, is_active: true },
  { id: "wip", location_type: "wip", is_default: true, is_active: true },
];

describe("isInventoryReadyForActivation", () => {
  it("requires an active Yii2 material mapping with opening balance in the default warehouse", () => {
    expect(isInventoryReadyForActivation(locations, [], [])).toBe(false);

    expect(isInventoryReadyForActivation(
      locations,
      [{ id: "gold", source_material_id: 28, is_active: true }],
      [{ location_id: "warehouse", material_id: "gold", quantity_grams: "8.250" }],
    )).toBe(true);
  });

  it("does not accept balance outside the default warehouse", () => {
    expect(isInventoryReadyForActivation(
      locations,
      [{ id: "gold", source_material_id: 28, is_active: true }],
      [{ location_id: "wip", material_id: "gold", quantity_grams: 8.25 }],
    )).toBe(false);
  });

  it("separates activation requirements from optional ready-stock preparation", () => {
    expect(buildInventoryActivationChecklist(
      locations,
      [{ id: "gold", source_material_id: 28, is_active: true }],
      [{ location_id: "warehouse", material_id: "gold", quantity_grams: 8.25 }],
      12,
      0,
    )).toEqual({
      has_default_warehouse: true,
      has_default_wip: true,
      has_mapped_material_with_stock: true,
      catalog_model_count: 12,
      ready_stock_unit_count: 0,
      can_activate: true,
    });
  });
});
