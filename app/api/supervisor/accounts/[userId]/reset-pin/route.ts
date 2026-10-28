import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";

async function verifySupervisorOrAdmin(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, role:roles!users_role_id_fkey(name, role_group)")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  return getRoleProps(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;

    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supervisorProfile = await verifySupervisorOrAdmin(authUser.id);
    if (!supervisorProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const roleName = supervisorProfile.name;
    const roleGroup = supervisorProfile.role_group;
    const isSupervisor =
      roleName === "superadmin" ||
      roleGroup === "management" ||
      roleName === "operational_supervisor" ||
      roleName === "production_supervisor";

    if (!isSupervisor) {
      return NextResponse.json(
        { error: "Hanya supervisor yang dapat mereset PIN" },
        { status: 403 },
      );
    }

    const admin = createAdminClient();

    const { data: target, error: targetError } = await admin
      .from("users")
      .select("id, full_name, pin_hash, role:roles!users_role_id_fkey(name, role_group)")
      .eq("id", userId)
      .is("deleted_at", null)
      .single();

    if (targetError || !target) {
      return NextResponse.json(
        { error: "User tidak ditemukan" },
        { status: 404 },
      );
    }

    const targetRoleGroup = getRoleProps(target).role_group;
    if (targetRoleGroup !== "production" && targetRoleGroup !== "operational") {
      return NextResponse.json(
        { error: "Hanya pekerja workshop yang memiliki PIN" },
        { status: 400 },
      );
    }

    if (!target.pin_hash) {
      return NextResponse.json(
        { error: "Worker belum memiliki PIN — tidak ada yang perlu di-reset" },
        { status: 400 },
      );
    }

    const { error: updateError } = await admin
      .from("users")
      .update({
        pin_hash: null,
        pin_attempts: 0,
        pin_locked_until: null,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[reset-pin] update error:", updateError.message);
      return NextResponse.json(
        { error: "Gagal mereset PIN" },
        { status: 500 },
      );
    }

    try {
      await supabase.from("activity_logs").insert({
        user_id: authUser.id,
        action: "RESET_WORKER_PIN",
        entity_type: "users",
        entity_id: userId,
        new_data: { reset_by: authUser.id, worker_name: target.full_name },
      });
    } catch (e) {
      console.warn("[reset-pin] activity_log failed:", e);
    }

    return NextResponse.json({
      success: true,
      message: `PIN ${target.full_name} berhasil di-reset`,
    });
  } catch (err) {
    console.error("[reset-pin] Error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
