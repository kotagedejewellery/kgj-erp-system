export const PERSONAL_HISTORY_ACTIONS = [
  "APPROVE_STAGE",
  "REJECT_STAGE",
  "CANCEL_ORDER",
  "INTAKE_VALIDATION",
] as const;

export function getHistoryPagination(searchParams: URLSearchParams) {
  const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "25", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 25;
  const requestedOffset = Number.parseInt(searchParams.get("offset") ?? "", 10);

  if (Number.isFinite(requestedOffset)) {
    const offset = Math.max(requestedOffset, 0);
    return { limit, offset, page: Math.floor(offset / limit) + 1 };
  }

  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  return { limit, offset: (page - 1) * limit, page };
}

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
