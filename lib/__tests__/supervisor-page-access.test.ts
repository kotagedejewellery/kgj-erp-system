import { describe, expect, it } from "vitest";
import { getSupervisorPageAccess } from "@/lib/auth/supervisor-page-access";

describe("getSupervisorPageAccess", () => {
  it("opens the SPV CS approval view directly in intake validation", () => {
    const access = getSupervisorPageAccess({
      name: "customer_service_supervisor",
      role_group: "management",
      permissions: { can_validate_intake: true },
      allowed_stages: [],
    });

    expect(access).toMatchObject({
      isCustomerServiceSupervisor: true,
      canValidateIntake: true,
      canAccessPending: false,
      supervisorGroup: "all",
      defaultApprovalFilter: "intake_validation",
    });
  });

  it("keeps operational and production supervisors in their own scope", () => {
    const operational = getSupervisorPageAccess({
      name: "operational_supervisor",
      role_group: "management",
      permissions: {},
      allowed_stages: ["approval_penerimaan_order"],
    });
    const production = getSupervisorPageAccess({
      name: "production_supervisor",
      role_group: "management",
      permissions: {},
      allowed_stages: ["approval_produksi"],
    });

    expect(operational).toMatchObject({
      supervisorGroup: "operational",
      defaultApprovalFilter: "operational",
      canAccessPending: true,
    });
    expect(production).toMatchObject({
      supervisorGroup: "production",
      defaultApprovalFilter: "production",
      canAccessPending: true,
    });
  });
});
