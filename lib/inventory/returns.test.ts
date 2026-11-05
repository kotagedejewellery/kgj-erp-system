import { describe, expect, it } from "vitest";
import { filterReturnableIssues } from "@/lib/inventory/returns";

describe("filterReturnableIssues", () => {
  it("only returns unreturned issues for orders completed as cancelled", () => {
    expect(
      filterReturnableIssues(
        [
          { order_id: "cancelled-order", issue_type: "custom" },
          { order_id: "active-order", issue_type: "ready_stock" },
          { order_id: "completed-order", issue_type: "custom" },
        ],
        [
          { order_id: "cancelled-order", current_stage: "selesai", stage_status: "cancelled" },
          { order_id: "active-order", current_stage: "racik_bahan", stage_status: "active" },
          { order_id: "completed-order", current_stage: "selesai", stage_status: "completed" },
        ],
      ),
    ).toEqual([{ order_id: "cancelled-order", issue_type: "custom" }]);
  });
});
