import { describe, expect, it } from "vitest";
import { getPersonalApprovalAction } from "@/lib/supervisor/history";

describe("supervisor personal history", () => {
  it("maps approval activity to the supervisor's own decision", () => {
    expect(getPersonalApprovalAction("APPROVE_STAGE", {})).toBe("approve");
    expect(getPersonalApprovalAction("REJECT_STAGE", {})).toBe("reject");
  });

  it("maps SPV CS intake activity without treating it as a production stage", () => {
    expect(getPersonalApprovalAction("INTAKE_VALIDATION", { action: "return" })).toBe("return");
    expect(getPersonalApprovalAction("INTAKE_VALIDATION", { action: "reject" })).toBe("reject");
  });
});
