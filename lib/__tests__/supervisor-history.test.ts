import { describe, expect, it } from "vitest";
import { getHistoryPagination, getPersonalApprovalAction } from "@/lib/supervisor/history";

describe("history pagination", () => {
  it("uses a 25-row page and derives its offset from the requested page", () => {
    expect(getHistoryPagination(new URLSearchParams("page=3&limit=25"))).toEqual({
      limit: 25,
      offset: 50,
      page: 3,
    });
  });

  it("keeps legacy offset callers within the allowed range", () => {
    expect(getHistoryPagination(new URLSearchParams("limit=999&offset=-5"))).toEqual({
      limit: 100,
      offset: 0,
      page: 1,
    });
  });
});

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
