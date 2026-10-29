import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { hasWarrantyPermission, WARRANTY_EXCEPTION_DECIDE_PERMISSION } from "@/lib/warranty/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function text(value: unknown, maximumLength = 5000) {
  return typeof value === "string" && value.trim() && value.trim().length <= maximumLength ? value.trim() : null;
}

async function spvActor() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("users")
    .select("id, full_name, email, status, role:roles!users_role_id_fkey(name, permissions)")
    .eq("id", user.id).is("deleted_at", null).single();
  if (!profile || profile.status !== "active") return null;
  const role = getRoleProps(profile);
  if (!hasWarrantyPermission(role.permissions, WARRANTY_EXCEPTION_DECIDE_PERMISSION)) return null;
  return { admin, user, profile };
}

export async function GET() {
  const actor = await spvActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await actor.admin.from("warranty_exception_requests")
    .select("exception_request_id, claim_reference, reason, requested_by, status, created_at, order:legacy_orders!warranty_exception_requests_order_id_fkey(kode_order)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Permintaan Exception tidak dapat dimuat" }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const actor = await spvActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const exceptionRequestId = text(body?.exception_request_id, 120);
  const decision = body?.decision === "approved" || body?.decision === "rejected" ? body.decision : null;
  const reason = text(body?.reason);
  if (!exceptionRequestId || !decision || !reason) return NextResponse.json({ error: "Keputusan, alasan, dan request Exception wajib diisi" }, { status: 400 });
  const { data, error } = await actor.admin.rpc("decide_warranty_exception", {
    p_exception_request_id: exceptionRequestId,
    p_actor_id: actor.user.id,
    p_actor_display_name: actor.profile.full_name || actor.profile.email || actor.user.email || actor.user.id,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ data });
}
