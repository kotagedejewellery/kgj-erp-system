export type OrderDetailView = "tracking" | "intake";

export function getOrderDetailTabs(view: OrderDetailView) {
  return view === "intake"
    ? ["info"] as const
    : ["info", "stages", "approvals"] as const;
}
