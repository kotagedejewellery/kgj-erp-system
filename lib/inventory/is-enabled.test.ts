import { describe, expect, it } from "vitest";
import { isInventoryEnabled } from "@/lib/inventory/is-enabled";

describe("isInventoryEnabled", () => {
  it("requires explicit activation plus an active default warehouse and WIP location", () => {
    const locations = [
      { location_type: "warehouse", is_default: true, is_active: true },
      { location_type: "wip", is_default: true, is_active: true },
    ];

    expect(isInventoryEnabled(false, locations)).toBe(false);
    expect(isInventoryEnabled(true, locations)).toBe(true);
    expect(isInventoryEnabled(true, [
      { location_type: "warehouse", is_default: true, is_active: true },
    ])).toBe(false);
  });
});
