import { describe, expect, it } from "vitest";
import { canManageInventory } from "@/lib/inventory/management-access";

describe("canManageInventory", () => {
  it("requires the dedicated management role and an active account", () => {
    expect(canManageInventory("active", "management")).toBe(true);
    expect(canManageInventory("inactive", "management")).toBe(false);
    expect(canManageInventory("active", "superadmin")).toBe(false);
  });
});
