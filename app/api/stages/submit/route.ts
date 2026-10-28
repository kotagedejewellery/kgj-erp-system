// app/api/stages/submit/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";
import { notifySupervisors, getSupervisorRoleForApproval } from "@/lib/notifications";
import { STAGE_SEQUENCE, STAGE_GROUP, effectiveNext } from "@/lib/stages";
import { pushStageToYii2 } from "@/lib/legacy/push-status";

// ── Role access ────────────────────────────────────────────────────────────────

const ROLE_STAGES: Record<string, Set<string>> = {
  customer_care: new Set(["konfirmasi"]),
};

function hasAccess(
  roleName: string,
  roleGroup: string,
  allowedStages: string[],
  stage: string,
): boolean {
  if (roleName === "superadmin") return true;
  if (allowedStages.includes(stage)) return true;
  if (ROLE_STAGES[roleName]?.has(stage)) return true;
  if (STAGE_GROUP[stage] === roleGroup) return true;
  return false;
}

const WORKER_STAGES = new Set<string>(STAGE_SEQUENCE.filter(s => !s.startsWith("approval_") && s !== "penerimaan_order"));

const APPROVAL_GATE_MAP: Record<string, string> = {};
STAGE_SEQUENCE.forEach((stage, i) => {
  const next = STAGE_SEQUENCE[i + 1];
  if (next && next.startsWith("approval_")) {
    APPROVAL_GATE_MAP[stage] = next;
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getAttemptNumber(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  stage: string,
): Promise<number> {
  const { data } = await admin
    .from("stage_history")
    .select("attempt_number, data")
    .eq("order_id", orderId)
    .eq("stage", stage)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { attempt_number?: number; data?: Record<string, unknown> } | null;
  const hasData = row?.data && typeof row.data === "object" && Object.keys(row.data).length > 0;
  return (hasData ? (row?.attempt_number ?? 1) : 0) + 1;
}

// Advance the legacy tracking pointer. The completion of `fromStage` is logged
// separately as a stage_history submission row; this only moves the pointer.
async function advanceOrder(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  fromStage: string,
  toStage: string,
  userId: string,
  waitingApproval: boolean,
  _reason?: string,
) {
  const now = new Date().toISOString();

  await admin
    .from("tracking_stages")
    .update({
      current_stage: toStage,
      stage_status: waitingApproval ? "waiting_approval" : "in_progress",
      updated_at: now,
      updated_by: userId,
    })
    .eq("order_id", orderId);
}

// Record a completed-stage submission into stage_history (legacy's combined
// submission + transition log). Returns the new row id (for QC checklist link).
async function recordSubmission(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
  userId: string,
  stage: string,
  attemptNumber: number,
  data: Record<string, unknown>,
  note: string | null,
): Promise<string | null> {
  const { data: row } = await admin
    .from("stage_history")
    .insert({
      order_id: orderId,
      stage,
      status: "completed",
      note,
      changed_by: userId,
      attempt_number: attemptNumber,
      data,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  return (row as { id?: string } | null)?.id ?? null;
}

// Fire-and-forget push to Yii2 LIVE_SYSTEM — see lib/legacy/push-status.ts.
// Full 20-stage sync: every transition pushes the stage the order ENTERS.

// ── POST ───────────────────────────────────────────────────────────────────────

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

    const { data: userData } = await admin
      .from("users")
      .select(
        "id, full_name, role:roles!users_role_id_fkey(name, role_group, allowed_stages)",
      )
      .eq("id", authUser.id)
      .is("deleted_at", null)
      .single();

    if (!userData)
      return NextResponse.json(
        { error: "User tidak ditemukan" },
        { status: 404 },
      );

    const roleName: string = getRoleProps(userData).name;
    const roleGroup: string = getRoleProps(userData).role_group;
    const allowedStages: string[] = getRoleProps(userData).allowed_stages;

    const body = await request.json();
    const {
      order_id: orderId,
      stage,
      data = {},
    } = body as {
      order_id: string;
      stage: string;
      data: Record<string, unknown>;
    };

    if (!orderId || !stage)
      return NextResponse.json(
        { error: "order_id dan stage wajib diisi" },
        { status: 400 },
      );

    if (!WORKER_STAGES.has(stage))
      return NextResponse.json(
        { error: `Tahap '${stage}' tidak dapat disubmit melalui endpoint ini` },
        { status: 400 },
      );

    if (!hasAccess(roleName, roleGroup, allowedStages, stage))
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke tahap ini" },
        { status: 403 },
      );

    const { data: legacyOrder, error: orderError } = await admin
      .from("legacy_orders")
      .select("id, kode_order, legacy_id")
      .eq("id", orderId)
      .single();

    if (orderError || !legacyOrder)
      return NextResponse.json(
        { error: "Order tidak ditemukan" },
        { status: 404 },
      );

    const { data: tracking } = await admin
      .from("tracking_stages")
      .select("current_stage, stage_status")
      .eq("order_id", orderId)
      .maybeSingle();

    const order = {
      id: legacyOrder.id,
      order_number: legacyOrder.kode_order,
      current_stage: tracking?.current_stage ?? "penerimaan_order",
      status: tracking?.stage_status ?? "in_progress",
    };

    const legacyId = (legacyOrder as { legacy_id?: number }).legacy_id ?? null;

    if (order.current_stage !== stage)
      return NextResponse.json(
        {
          error: `Order saat ini di tahap '${order.current_stage}', bukan '${stage}'. Refresh dan coba lagi.`,
        },
        { status: 409 },
      );

    const now = new Date().toISOString();
    const userId = authUser.id;
    const attemptNumber = await getAttemptNumber(admin, orderId, stage);

    // ── cek_kadar: fail → loop back to lebur_bahan ────────────────────────────
    if (stage === "cek_kadar") {
      const result = data.result as string;
      if (!result)
        return NextResponse.json(
          { error: "result wajib diisi untuk cek_kadar" },
          { status: 400 },
        );

      await recordSubmission(admin, orderId, userId, "cek_kadar", attemptNumber,
        { result, notes: data.notes ?? null }, (data.notes as string) ?? null);

      if (result === "tidak_lolos") {
        await admin.from("legacy_rework_logs").insert({
          order_id: orderId,
          from_stage: "cek_kadar",
          to_stage: "lebur_bahan",
          reason:
            (data.notes as string) ??
            "Kadar tidak memenuhi standar — perlu lebur ulang",
          severity: "major",
          logged_by: userId,
          logged_at: now,
        });

        await admin
          .from("tracking_stages")
          .update({
            current_stage: "lebur_bahan",
            stage_status: "rework",
            updated_at: now,
            updated_by: userId,
          })
          .eq("order_id", orderId);

        await admin.from("stage_history").insert({
          order_id: orderId,
          stage: "lebur_bahan",
          status: "rework",
          note:
            `Cek kadar tidak lolos — dikembalikan ke lebur bahan. ${(data.notes as string) ?? ""}`.trim(),
          changed_by: userId,
          created_at: now,
        });

        // Notify production supervisor about rework
        notifySupervisors(
          "production_supervisor",
          "Rework — Cek Kadar",
          `Order ${order.order_number} gagal cek kadar, dikembalikan ke Lebur Bahan.`,
          "warning",
          `/workshop/input?order_id=${orderId}`,
        );

        await pushStageToYii2(orderId, legacyId, "lebur_bahan");

        return NextResponse.json({
          success: true,
          rework: true,
          message:
            "Cek kadar tidak lolos. Order dikembalikan ke tahap Lebur Bahan.",
          data: {
            order_id: orderId,
            order_number: order.order_number,
            next_stage: "lebur_bahan",
          },
        });
      }

      const next = effectiveNext("cek_kadar");
      if (next) {
        await advanceOrder(
          admin,
          orderId,
          "cek_kadar",
          next,
          userId,
          false,
          "Cek kadar lolos",
        );
        await pushStageToYii2(orderId, legacyId, next);
      }

      return NextResponse.json({
        success: true,
        message: "Cek kadar lolos. Order maju ke tahap berikutnya.",
        data: {
          order_id: orderId,
          order_number: order.order_number,
          next_stage: next,
        },
      });
    }

    // ── konfirmasi: not_approved → rework to qc_2 ─────────────────
    if (stage === "konfirmasi") {
      const result = data.result as string;
      if (!result)
        return NextResponse.json(
          { error: "result wajib diisi untuk konfirmasi" },
          { status: 400 },
        );

      await recordSubmission(admin, orderId, userId, "konfirmasi", attemptNumber,
        { ...data }, (data.notes as string) ?? null);

      if (result === "not_approved") {
        const prevStage = "qc_2";

        await admin.from("legacy_rework_logs").insert({
          order_id: orderId,
          from_stage: "konfirmasi",
          to_stage: prevStage,
          reason:
            (data.notes as string) ??
            "Tidak disetujui customer care — perlu QC ulang",
          severity: "minor",
          logged_by: userId,
          logged_at: now,
        });

        await admin
          .from("tracking_stages")
          .update({
            current_stage: prevStage,
            stage_status: "rework",
            updated_at: now,
            updated_by: userId,
          })
          .eq("order_id", orderId);

        await admin.from("stage_history").insert({
          order_id: orderId,
          stage: prevStage,
          status: "rework",
          note:
            `Konfirmasi customer care tidak disetujui — dikembalikan ke QC akhir. ${(data.notes as string) ?? ""}`.trim(),
          changed_by: userId,
          created_at: now,
        });

        // Notify production supervisor about rework
        notifySupervisors(
          "production_supervisor",
          "Rework — Konfirmasi Customer",
          `Order ${order.order_number} tidak disetujui customer care, dikembalikan ke QC Akhir.`,
          "warning",
          `/workshop/input?order_id=${orderId}`,
        );

        await pushStageToYii2(orderId, legacyId, prevStage);

        return NextResponse.json({
          success: true,
          rework: true,
          message: "Tidak disetujui. Order dikembalikan ke tahap QC Akhir.",
          data: {
            order_id: orderId,
            order_number: order.order_number,
            next_stage: prevStage,
          },
        });
      }

      // Approved → packing
      const next = effectiveNext("konfirmasi");
      if (next) {
        await advanceOrder(
          admin,
          orderId,
          "konfirmasi",
          next,
          userId,
          false,
          "Konfirmasi customer care disetujui",
        );
        await pushStageToYii2(orderId, legacyId, next);
      }

      return NextResponse.json({
        success: true,
        message: "Disetujui. Order maju ke tahap Packing.",
        data: {
          order_id: orderId,
          order_number: order.order_number,
          next_stage: next,
        },
      });
    }

    // ── QC stages: save checklist ──────────────────────────────────────────────
    if (stage === "qc_1" || stage === "qc_2") {
      const checklist = (data.quality_checklist ?? []) as Array<{
        key: string;
        passed: boolean;
      }>;

      const srId = await recordSubmission(admin, orderId, userId, stage, attemptNumber,
        { quality_checklist: checklist, notes: data.notes ?? null }, (data.notes as string) ?? null);

      if (srId && checklist.length > 0) {
        await admin.from("legacy_quality_checklist_results").insert(
          checklist.map((item) => ({
            order_id: orderId,
            stage_history_id: srId,
            check_key: item.key,
            passed: item.passed,
            recorded_by: userId,
            created_at: now,
          })),
        );
      }

      const approvalStage = APPROVAL_GATE_MAP[stage];
      if (approvalStage) {
        await advanceOrder(admin, orderId, stage, approvalStage, userId, true);
        await pushStageToYii2(orderId, legacyId, approvalStage);
        // Notify the right supervisor
        const supRole = getSupervisorRoleForApproval(approvalStage);
        if (supRole) {
          notifySupervisors(
            supRole,
            "Menunggu Persetujuan",
            `Order ${order.order_number} selesai tahap ${stage} dan menunggu approval.`,
            "info",
            `/dashboard/supervisor/approval`,
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: approvalStage
          ? `${stage} selesai. Menunggu persetujuan supervisor.`
          : `${stage} selesai.`,
        data: {
          order_id: orderId,
          order_number: order.order_number,
          next_stage: approvalStage ?? effectiveNext(stage),
          waiting_approval: !!approvalStage,
        },
      });
    }

    // ── packing: confirm order readiness ─────────────────────────────────────
    if (stage === "packing") {
      const result = data.result as string;

      await recordSubmission(admin, orderId, userId, "packing", attemptNumber,
        { result, notes: data.notes ?? null }, (data.notes as string) ?? null);

      if (result === "belum") {
        await admin
          .from("tracking_stages")
          .update({ stage_status: "rework", updated_at: now, updated_by: userId })
          .eq("order_id", orderId);

        return NextResponse.json({
          success: true,
          rework: true,
          message: "Packing dicatat sebagai belum selesai. Perbaiki dan submit ulang.",
          data: { order_id: orderId, order_number: order.order_number, next_stage: "packing" },
        });
      }

      const next = effectiveNext("packing");
      if (next) {
        await advanceOrder(
          admin,
          orderId,
          "packing",
          next,
          userId,
          false,
          "Packing selesai — siap kirim",
        );
        await pushStageToYii2(orderId, legacyId, next);

        // Order memasuki pengiriman → siapkan baris delivery pending (di-update
        // saat stage pengiriman selesai). Idempoten: jangan buat duplikat.
        if (next === "pengiriman") {
          const { data: existingDelivery } = await admin
            .from("legacy_deliveries")
            .select("id")
            .eq("order_id", orderId)
            .maybeSingle();
          if (!existingDelivery) {
            await admin.from("legacy_deliveries").insert({
              order_id: orderId,
              status: "pending",
              created_at: now,
            });
          }
        }
      }

      notifySupervisors(
        "operational_supervisor",
        "Siap Dikirim",
        `Order ${order.order_number} sudah di-packing dan siap dikirim.`,
        "info",
        `/workshop/input`,
      );

      return NextResponse.json({
        success: true,
        message: "Packing selesai. Order siap dikirim.",
        data: {
          order_id: orderId,
          order_number: order.order_number,
          next_stage: next,
        },
      });
    }

    // ── pengiriman: mark delivered/dispatched → selesai ────────────────────────
    if (stage === "pengiriman") {
      const isCompleted = data.is_delivered === "sampai_store" || data.is_delivered === "sampai_expedisi";
      const isFailed = data.is_delivered === "gagal";
      const isDelivered = data.is_delivered === "sampai_store";

      await recordSubmission(admin, orderId, userId, "pengiriman", attemptNumber,
        { ...data }, (data.notes as string) ?? null);

      const deliveryUpdate: Record<string, unknown> = {
        status: isDelivered ? "delivered" : isFailed ? "failed" : "dispatched",
        courier_name: (data.courier_name as string | null) ?? null,
        tracking_number: (data.tracking_number as string | null) ?? null,
        confirmed_by: userId,
        updated_at: now,
        ...(isDelivered ? { delivered_at: now } : {}),
        ...(isFailed
          ? {
              failed_at: now,
              failure_reason: (data.notes as string | null) ?? null,
            }
          : {}),
      };

      await admin
        .from("legacy_deliveries")
        .update(deliveryUpdate)
        .eq("order_id", orderId)
        .eq("status", "pending");

      if (isCompleted) {
        const reason = isDelivered
          ? "Produk berhasil diterima pelanggan — order selesai"
          : "Produk sudah sampai di expedisi — order selesai";

        await admin
          .from("tracking_stages")
          .update({
            current_stage: "selesai",
            stage_status: "completed",
            updated_at: now,
            updated_by: userId,
          })
          .eq("order_id", orderId);

        await admin.from("stage_history").insert({
          order_id: orderId,
          stage: "selesai",
          status: "completed",
          note: reason,
          changed_by: userId,
          created_at: now,
        });

        // Pengiriman berhasil → order masuk tahap selesai.
        await pushStageToYii2(orderId, legacyId, "selesai");

        return NextResponse.json({
          success: true,
          message: "Pengiriman berhasil. Order selesai.",
          data: {
            order_id: orderId,
            order_number: order.order_number,
            next_stage: "selesai",
          },
        });
      }

      return NextResponse.json({
        success: true,
        message: isFailed
          ? "Pengiriman gagal dicatat. Coba ulang pengiriman."
          : "Status pengiriman diperbarui.",
        data: {
          order_id: orderId,
          order_number: order.order_number,
          next_stage: "pengiriman",
        },
      });
    }

    // ── pembentukan_cincin: optional microsetting skip ───────────────────────
    // Tidak semua order perlu micro setting (id_microsetting 8 = "Sesuai Model").
    // Tukang memilih lanjut ke pemasangan_permata atau langsung ke pemolesan.
    if (stage === "pembentukan_cincin") {
      const perlu = data.perlu_microsetting as string | undefined;
      if (!perlu)
        return NextResponse.json(
          { error: "perlu_microsetting wajib diisi untuk pembentukan_cincin" },
          { status: 400 },
        );

      await recordSubmission(admin, orderId, userId, "pembentukan_cincin", attemptNumber,
        { ...data }, (data.notes as string) ?? null);

      const nextStage = perlu === "skip" ? "pemolesan" : "pemasangan_permata";

      await advanceOrder(
        admin,
        orderId,
        "pembentukan_cincin",
        nextStage,
        userId,
        false,
      );
      await pushStageToYii2(orderId, legacyId, nextStage);

      return NextResponse.json({
        success: true,
        message:
          perlu === "skip"
            ? "Pembentukan selesai. Tanpa micro setting — lanjut ke pemolesan."
            : "Pembentukan selesai. Lanjut ke micro setting.",
        data: {
          order_id: orderId,
          order_number: order.order_number,
          next_stage: nextStage,
        },
      });
    }

    // ── Standard "Done" stages ─────────────────────────────────────────────────
    await recordSubmission(admin, orderId, userId, stage, attemptNumber,
      { ...data }, (data as Record<string, unknown>).notes as string | null ?? null);

    const approvalStage = APPROVAL_GATE_MAP[stage];
    const resolvedNext = approvalStage ?? effectiveNext(stage);
    const isWaiting = !!approvalStage;

    if (resolvedNext && resolvedNext !== "selesai") {
      await advanceOrder(
        admin,
        orderId,
        stage,
        resolvedNext,
        userId,
        isWaiting,
      );
      // Push the stage the order has ENTERED so Yii2 mirrors the ERP.
      await pushStageToYii2(orderId, legacyId, resolvedNext);
    }

    if (isWaiting && approvalStage) {
      const supRole = getSupervisorRoleForApproval(approvalStage);
      if (supRole) {
        notifySupervisors(
          supRole,
          "Menunggu Persetujuan",
          `Order ${order.order_number} selesai tahap ${stage} dan menunggu approval.`,
          "info",
          `/dashboard/supervisor/approval`,
        );
      }
    }

    // (Push ke Yii2 sudah dilakukan di atas dengan stage terkini.)

    return NextResponse.json({
      success: true,
      message: isWaiting
        ? `${stage} selesai. Menunggu persetujuan supervisor.`
        : `${stage} selesai. Order maju ke tahap berikutnya.`,
      data: {
        order_id: orderId,
        order_number: order.order_number,
        next_stage: resolvedNext,
        waiting_approval: isWaiting,
      },
    });
  } catch (error) {
    console.error("[POST /api/stages/submit] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
