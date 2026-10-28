import { describe, expect, it } from "vitest";
import { canManageWarrantyPreparation } from "./permissions";

describe("canManageWarrantyPreparation", () => {
  it("hanya mengizinkan Warranty Administrator", () => {
    expect(canManageWarrantyPreparation({ warranty_administrator: true })).toBe(true);
    expect(canManageWarrantyPreparation({ warranty_administrator: false })).toBe(false);
    expect(canManageWarrantyPreparation({ can_validate_intake: true })).toBe(false);
  });
});
