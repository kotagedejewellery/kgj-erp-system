import { describe, expect, it } from "vitest";
import { getDeletableOrderIds } from "@/lib/legacy/sync-service";

describe("getDeletableOrderIds", () => {
  it("never deletes an order after inventory has been issued", () => {
    expect(
      getDeletableOrderIds(
        ["before-issue", "after-issue", "pending-intake"],
        new Set(["pending-intake"]),
        new Set(["after-issue"]),
      ),
    ).toEqual(["before-issue"]);
  });
});
