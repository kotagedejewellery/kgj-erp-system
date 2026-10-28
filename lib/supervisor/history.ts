export const PERSONAL_HISTORY_ACTIONS = [
  "APPROVE_STAGE",
  "REJECT_STAGE",
  "CANCEL_ORDER",
  "INTAKE_VALIDATION",
] as const;

export type PersonalApprovalAction = "approve" | "reject" | "return";

export function getPersonalApprovalAction(
  activity: string,
  data: Record<string, unknown>,
): PersonalApprovalAction | null {
  if (activity === "APPROVE_STAGE") return "approve";
  if (activity === "REJECT_STAGE") return "reject";
  if (activity !== "INTAKE_VALIDATION") return null;
  if (data.action === "approve" || data.action === "reject" || data.action === "return") {
    return data.action;
  }
  return null;
}
