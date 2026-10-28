// app/api/supervisor/approve/route.ts — approve or reject a stage submission

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";
import { sendNotification } from "@/lib/notifications";
import { STAGE_SEQUENCE, effectiveNext } from "@/lib/stages";
import { pushStageToYii2 } from "@/lib/legacy/push-status";

const PRODUCTION_TO_APPROVAL_STAGE: Record<string, string> = {};
const APPROVAL_STAGES: string[] = [];
STAGE_SEQUENCE.forEach((stage, i) => {
  if (stage.startsWith("approval_")) {
    APPROVAL_STAGES.push(stage);
    const prevStage = STAGE_SEQUENCE[i - 1];
    if (prevStage) {
      PRODUCTION_TO_APPROVAL_STAGE[prevStage] = stage;
    }
  }
});

const SUPERVISOR_ALLOWED_STAGES: Record<string, Set<string>> = {
  operational_supervisor: new Set(APPROVAL_STAGES.filter(s => s !== "approval_produksi")),
  production_supervisor: new Set(["approval_produksi"]),
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !authUser)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from("users")
      .select(
        "full_name, role:roles!users_role_id_fkey(name, role_group, allowed_stages)",
      )
      .eq("id", authUser.id)
      .is("deleted_at", null)
      .single();

    if (!profile)
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

    const roleName: string = getRoleProps(profile).name;
    const roleGroup: string = getRoleProps(profile).role_group;
    const allowedStages: string[] = getRoleProps(profile).allowed_stages;

    if (roleName === "customer_service_supervisor") {
      return NextResponse.json(
        { error: "SPV CS hanya dapat memvalidasi intake order" },
        { status: 403 },
      );
    }

    const isSupervisor =
      roleName === "superadmin" ||
      roleGroup === "management" ||
      allowedStages.some((s) => s.startsWith("approval_"));

    if (!isSupervisor)
      return NextResponse.json(
        { error: "Forbidden: hanya supervisor yang dapat melakukan approval" },
        { status: 403 },
      );

    const body = await request.json();
    const { order_id, stage, action, remarks, rework_stage } = body;
    const stage_result_id: string | null = body.stage_result_id ?? null;

    if (!order_id || !stage || !action)
      return NextResponse.json(
        { error: "order_id, stage, dan action wajib diisi" },
        { status: 400 },
      );

  if (action !== "approve" && action !== "reject" && action !== "cancel")
    return NextResponse.json(
      { error: "action harus 'approve', 'reject', atau 'cancel'" },
      { status: 400 },
    );

    if (!stage.startsWith("approval_"))
      return NextResponse.json(
        { error: `Tahap '${stage}' bukan tahap approval.` },
        { status: 400 },
      );

    if (roleName === "operational_supervisor" && !SUPERVISOR_ALLOWED_STAGES.operational_supervisor.has(stage)) {
      return NextResponse.json({ error: "Anda tidak memiliki akses untuk approval tahap ini" }, { status: 403 });
    }
    if (roleName === "production_supervisor" && !SUPERVISOR_ALLOWED_STAGES.production_supervisor.has(stage)) {
      return NextResponse.json({ error: "Anda tidak memiliki akses untuk approval tahap ini" }, { status: 403 });
    }

    const { data: order, error: orderError } = await admin
      .from("tracking_stages")
      .select("order_id, current_stage, stage_status")
      .eq("order_id", order_id)
      .maybeSingle();

    if (orderError || !order)
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

    if (order.current_stage !== stage)
      return NextResponse.json(
        { error: "Order sudah berpindah tahap. Refresh dan coba lagi." },
        { status: 409 },
      );

    // An order is approvable as long as it is sitting at this approval stage and
    // not yet finished. We gate on current_stage (reliable) rather than
    // stage_status, which the Yii2 sync seeds as 'completed' for the current
    // stage and is therefore not a trustworthy signal of approvability.
    if (order.current_stage === "selesai")
      return NextResponse.json(
        { error: "Order sudah selesai — tidak dapat diproses." },
        { status: 409 },
      );

    if (stage_result_id) {
      const { data: sr, error: srError } = await admin
        .from("stage_history")
        .select("id")
        .eq("id", stage_result_id)
        .eq("order_id", order_id)
        .single();
      if (srError || !sr)
        return NextResponse.json(
          { error: "stage_result tidak ditemukan" },
          { status: 404 },
        );
    }

    const productionStage = rework_stage ||
      (Object.entries(PRODUCTION_TO_APPROVAL_STAGE).find(
        ([, approvalStage]) => approvalStage === stage,
      )?.[0] ?? stage.replace("approval_", ""));

    const { data: legacyRow } = await admin
      .from("legacy_orders")
      .select("legacy_id")
      .eq("id", order_id)
      .maybeSingle();
    const legacyId = (legacyRow as { legacy_id?: number } | null)?.legacy_id ?? null;

    const now = new Date().toISOString();
      const supervisorName: string = (profile as { full_name?: string })?.full_name ?? "Supervisor";

    let nextStage: string | null = null;
    if (action === "approve") {
      nextStage = effectiveNext(stage);
    }

    // ── 1. Update tracking pointer + log the decision ────────────────────────
    if (action === "cancel") {
      await admin
        .from("tracking_stages")
        .update({ current_stage: "selesai", stage_status: "cancelled", updated_at: now, updated_by: authUser.id })
        .eq("order_id", order_id);

      await admin.from("stage_history").insert({
        order_id,
        stage: "selesai",
        status: "cancelled",
        note: `Dibatalkan oleh ${supervisorName}${remarks ? ` — ${remarks}` : ""}`,
        changed_by: authUser.id,
        created_at: now,
      });

      await pushStageToYii2(order_id, legacyId, "dibatalkan");
    } else if (action === "approve") {
      await admin
        .from("tracking_stages")
        .update(
          nextStage && nextStage !== "selesai"
            ? { current_stage: nextStage, stage_status: "in_progress", updated_at: now, updated_by: authUser.id }
            : { current_stage: "selesai", stage_status: "completed", updated_at: now, updated_by: authUser.id },
        )
        .eq("order_id", order_id);

      await admin.from("stage_history").insert({
        order_id,
        stage: nextStage ?? "selesai",
        status: "completed",
        note: `Approved by ${supervisorName}${remarks ? ` — ${remarks}` : ""}`,
        changed_by: authUser.id,
        created_at: now,
      });

      // Sinkronkan stage terkini ke Yii2.
      await pushStageToYii2(order_id, legacyId, nextStage ?? "selesai");
    } else {
      await admin
        .from("tracking_stages")
        .update({ current_stage: productionStage, stage_status: "rework", updated_at: now, updated_by: authUser.id })
        .eq("order_id", order_id);

      await admin.from("stage_history").insert({
        order_id,
        stage: productionStage,
        status: "rework",
        note: `Rejected by ${supervisorName}${remarks ? ` — ${remarks}` : ""}`,
        changed_by: authUser.id,
        created_at: now,
      });

      await admin.from("legacy_rework_logs").insert({
        order_id,
        from_stage: stage,
        to_stage: productionStage,
        reason: remarks ?? "Ditolak supervisor — perlu perbaikan",
        severity: "minor",
        logged_by: authUser.id,
        logged_at: now,
      });

      // Order kembali ke stage produksi — sinkronkan ke Yii2.
      await pushStageToYii2(order_id, legacyId, productionStage);
    }

    // ── 2. Notify worker ────────────────────────────────────────────────────────
    const workerId = stage_result_id
      ? (await admin.from("stage_history").select("changed_by").eq("id", stage_result_id).single()).data
          ?.changed_by
      : null;

    if (workerId) {
      const { data: workerOrder } = await admin
        .from("legacy_orders")
        .select("kode_order")
        .eq("id", order_id)
        .single();

      const orderNum = workerOrder?.kode_order ?? "—";
      if (action === "approve") {
        sendNotification({
          userId: workerId,
          title: "Disetujui",
          message: `Order ${orderNum} — tahap ${productionStage} telah disetujui. Lanjut ke tahap berikutnya.`,
          type: "success",
          link: `/workshop/input`,
        });
      } else {
        sendNotification({
          userId: workerId,
          title: "Ditolak — Rework",
          message: `Order ${orderNum} — tahap ${productionStage} ditolak. ${remarks ? `Alasan: ${remarks}` : "Harap perbaiki dan submit ulang."}`,
          type: "error",
          link: `/workshop/input`,
        });
      }
    }

    // ── 3. Tag the submission row with supervisor action ───────────────────────
    if (stage_result_id) {
      const { data: sr } = await admin
        .from("stage_history")
        .select("data")
        .eq("id", stage_result_id)
        .single();

      await admin
        .from("stage_history")
        .update({
          data: {
            ...((sr as { data?: Record<string, unknown> } | null)?.data ?? {}),
            _sv_action: action,
            _sv_by: supervisorName,
            _sv_by_id: authUser.id,
            _sv_at: now,
            ...(remarks ? { _sv_notes: remarks } : {}),
          },
        })
        .eq("id", stage_result_id);
    }

    // ── 5. Activity log ────────────────────────────────────────────────────────
    await admin.from("activity_logs").insert({
      user_id: authUser.id,
      action: action === "approve" ? "APPROVE_STAGE" : action === "reject" ? "REJECT_STAGE" : "CANCEL_ORDER",
      entity_type: "approvals",
      entity_id: order_id,
      new_data: {
        order_id,
        stage,
        production_stage: productionStage,
        action,
        remarks: remarks ?? null,
        next_stage: action === "cancel" ? "selesai" : action === "approve" ? nextStage : productionStage,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        action === "cancel"
          ? "Order dibatalkan."
          : action === "approve"
            ? nextStage
              ? `Disetujui. Order maju ke: ${nextStage}`
              : "Disetujui. Order selesai."
            : `Ditolak. Order dikembalikan ke ${productionStage} untuk perbaikan.`,
      data: {
        order_id,
        stage,
        action,
        production_stage: productionStage,
        next_stage: action === "cancel" ? "selesai" : action === "approve" ? nextStage : productionStage,
      },
    });
  } catch (error) {
    console.error("[POST /api/supervisor/approve] Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
