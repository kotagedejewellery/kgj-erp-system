import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { hasWarrantyPermission, WARRANTY_WORK_UPDATE_PERMISSION } from "@/lib/warranty/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function workshopActor() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, status, role:roles!users_role_id_fkey(name, permissions)")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single();
  if (!profile || profile.status !== "active") return null;
  const role = getRoleProps(profile);
  if (!hasWarrantyPermission(role.permissions, WARRANTY_WORK_UPDATE_PERMISSION)) return null;
  return { admin, userId: user.id, roleName: role.name };
}

export async function GET() {
  const actor = await workshopActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await actor.admin
    .from("warranty_works")
    .select("id, work_reference, claim_reference, benefit_code, condition_notes, status, work_version, requires_qc, requires_final_weight, requires_attachment, pic_id, qc_passed, final_weight_gram, attachment_ids, updated_at, order:legacy_orders!warranty_works_order_id_fkey(kode_order)")
    .in("status", ["requested", "in_progress", "qc", "completion_pending", "cancellation_requested"])
    .order("updated_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Warranty Work tidak dapat dimuat" }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const actor = await workshopActor();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const workId = typeof body?.work_id === "string" ? body.work_id : "";
  const action = body?.action;
  if (!workId || !["start", "send_qc", "complete", "approve_cancel", "reject_cancel"].includes(String(action))) {
    return NextResponse.json({ error: "Aksi Warranty Work tidak valid" }, { status: 400 });
  }
  const { data: work, error } = await actor.admin.from("warranty_works")
    .select("id, status, pic_id, attachment_ids").eq("id", workId).single();
  if (error || !work) return NextResponse.json({ error: "Warranty Work tidak ditemukan" }, { status: 404 });

  const status = action === "start"
    ? "in_progress"
    : action === "send_qc"
      ? "qc"
      : action === "complete"
        ? "completion_pending"
        : action === "approve_cancel"
          ? "cancelled"
          : "cancellation_rejected";
  const isQc = ["qc_1", "qc_2"].includes(actor.roleName);
  const isCancellationDecision = action === "approve_cancel" || action === "reject_cancel";
  if ((action === "send_qc" && work.pic_id !== actor.userId)
    || (action === "complete" && !isQc)
    || (isCancellationDecision && work.pic_id !== actor.userId)) {
    return NextResponse.json({ error: "Anda tidak berhak melakukan aksi ini" }, { status: 403 });
  }
  const finalWeight = body?.final_weight_gram === undefined ? null : Number(body.final_weight_gram);
  if (finalWeight !== null && (!Number.isFinite(finalWeight) || finalWeight <= 0)) {
    return NextResponse.json({ error: "Berat akhir tidak valid" }, { status: 400 });
  }
  const { data, error: updateError } = await actor.admin.rpc("enqueue_warranty_work_update", {
    p_work_id: work.id,
    p_actor_id: actor.userId,
    p_status: status,
    p_pic_id: action === "start" ? actor.userId : null,
    p_qc_passed: action === "complete" ? true : null,
    p_final_weight_gram: finalWeight,
    p_attachment_ids: work.attachment_ids ?? [],
    p_notes: typeof body?.notes === "string" ? body.notes : null,
  });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 422 });
  return NextResponse.json({ data });
}
