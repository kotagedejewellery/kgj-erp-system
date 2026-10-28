import type { SupervisorGroup } from "@/types/roles";

export interface SupervisorPageRole {
  name?: string | null;
  role_group?: string | null;
  permissions?: {
    can_validate_intake?: boolean;
  } | null;
  allowed_stages?: string[] | null;
}

export interface SupervisorPageAccess {
  roleName: string;
  supervisorGroup: SupervisorGroup;
  canValidateIntake: boolean;
  canAccessPending: boolean;
  isCustomerServiceSupervisor: boolean;
  defaultApprovalFilter: string;
}

export function getSupervisorPageAccess(
  role: SupervisorPageRole | null | undefined,
): SupervisorPageAccess | null {
  if (!role?.name || !role.role_group) return null;

  const allowedStages = role.allowed_stages ?? [];
  const isCustomerServiceSupervisor = role.name === "customer_service_supervisor";
  const canValidateIntake =
    role.name === "superadmin" || role.permissions?.can_validate_intake === true;
  const hasApprovalStage = allowedStages.some((stage) => stage.startsWith("approval_"));
  const canAccessPending =
    !isCustomerServiceSupervisor &&
    (role.role_group === "management" || hasApprovalStage);
  const canAccessSupervisor =
    canValidateIntake || role.role_group === "management" || hasApprovalStage;
  if (!canAccessSupervisor) return null;
  const supervisorGroup: SupervisorGroup = role.name === "production_supervisor"
    ? "production"
    : role.name === "operational_supervisor"
      ? "operational"
      : "all";

  return {
    roleName: role.name,
    supervisorGroup,
    canValidateIntake,
    canAccessPending,
    isCustomerServiceSupervisor,
    defaultApprovalFilter: isCustomerServiceSupervisor
      ? "intake_validation"
      : supervisorGroup,
  };
}
