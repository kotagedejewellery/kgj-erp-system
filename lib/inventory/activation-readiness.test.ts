import { describe, expect, it } from "vitest";
import { isInventoryReadyForActivation } from "@/lib/inventory/activation-readiness";

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
});
