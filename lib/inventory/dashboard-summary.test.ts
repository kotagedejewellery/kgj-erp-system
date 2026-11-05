import { describe, expect, it } from "vitest";
import { buildInventoryDashboardSummary } from "@/lib/inventory/dashboard-summary";

describe("buildInventoryDashboardSummary", () => {
  it("separates warehouse and WIP material balances", () => {
    expect(buildInventoryDashboardSummary(
      [
        { id: "warehouse", location_type: "warehouse" },
        { id: "wip", location_type: "wip" },
      ],
      [
        { location_id: "warehouse", quantity_grams: "12.250" },
        { location_id: "wip", quantity_grams: "3.500" },
      ],
      4,
      2,
    )).toEqual({
      warehouse_grams: 12.25,
      wip_grams: 3.5,
      available_stock_units: 4,
      material_count: 2,
    });
  });
});
