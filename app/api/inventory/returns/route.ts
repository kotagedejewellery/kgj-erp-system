import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { filterReturnableIssues } from "@/lib/inventory/returns";

export async function GET() {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;

  const { data, error } = await auth.admin
    .from("inventory_order_issues")
    .select("order_id, issue_type, issued_at, legacy_orders!inventory_order_issues_order_id_fkey(kode_order)")
    .is("returned_at", null)
    .order("issued_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Gagal memuat issue inventory" }, { status: 409 });

  const issues = data ?? [];
  if (issues.length === 0) return NextResponse.json({ issues });

  const { data: tracking, error: trackingError } = await auth.admin
    .from("tracking_stages")
    .select("order_id, current_stage, stage_status")
    .in("order_id", issues.map((issue) => issue.order_id));

  if (trackingError) return NextResponse.json({ error: "Gagal memuat status order untuk retur inventory" }, { status: 409 });
  return NextResponse.json({ issues: filterReturnableIssues(issues, tracking ?? []) });
}

export async function POST(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!orderId || !reason) return NextResponse.json({ error: "Order dan alasan retur wajib diisi" }, { status: 400 });

  const { error } = await auth.admin.rpc("inventory_return_to_stock", {
    p_order_id: orderId,
    p_actor_id: auth.actorId,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ success: true });
}
