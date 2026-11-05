type InventoryIssue = { order_id: string };
type OrderTracking = {
  order_id: string;
  current_stage: string;
  stage_status: string;
};

export function filterReturnableIssues<T extends InventoryIssue>(issues: readonly T[], tracking: readonly OrderTracking[]) {
  const cancelledOrderIds = new Set(
    tracking
      .filter((order) => order.current_stage === "selesai" && order.stage_status === "cancelled")
      .map((order) => order.order_id),
  );

  return issues.filter((issue) => cancelledOrderIds.has(issue.order_id));
}
