// app/api/operational/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";

export async function GET(request?: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, role:roles!users_role_id_fkey(name)")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil user tidak ditemukan" },
        { status: 404 },
      );
    }

    if (getRoleProps(profile).name !== "superadmin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = request?.url ? new URL(request.url) : null;
    const fromParam = url?.searchParams.get("from");
    const toParam = url?.searchParams.get("to");

    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const threeDaysAgoISO = fromParam ? new Date(fromParam).toISOString() : threeDaysAgo.toISOString();
    const sevenDaysAgoISO = fromParam ? new Date(fromParam).toISOString() : sevenDaysAgo.toISOString();
    const _toDateISO = toParam ? new Date(toParam + "T23:59:59").toISOString() : now.toISOString();

    // ========== FETCH ALL SECTIONS IN PARALLEL ==========
    // Legacy source: stage_history (submissions) + legacy_quality_checklist_results.
    // Sections with no legacy equivalent (pricing/pelunasan,
    // deliveries) return empty — the legacy schema does not carry that data.
    const [
      adminTasksResult,
      racikResult,
      laserResult,
      qcSummaryResult,
      qcActivityResult,
    ] = await Promise.allSettled([
      // ADMIN TASKS — stage_history (completed submissions only)
      admin
        .from("stage_history")
        .select(
          `
          order_id, stage, created_at,
          legacy_orders!stage_history_order_id_fkey (kode_order),
          users!stage_history_changed_by_fkey (full_name, role:roles!users_role_id_fkey(name))
        `,
        )
        .in("stage", ["pelunasan", "kelengkapan", "packing", "pengiriman"])
        .gte("created_at", threeDaysAgoISO)
        .order("created_at", { ascending: false })
        .limit(50),

      // RACIK BAHAN
      admin
        .from("stage_history")
        .select(
          `
          data, created_at,
          legacy_orders!stage_history_order_id_fkey (kode_order),
          users!stage_history_changed_by_fkey (full_name)
        `,
        )
        .eq("stage", "racik_bahan")
        .eq("status", "completed")
        .gte("created_at", sevenDaysAgoISO)
        .order("created_at", { ascending: false }),

      // LASER
      admin
        .from("stage_history")
        .select(
          `
          data, created_at,
          legacy_orders!stage_history_order_id_fkey (kode_order)
        `,
        )
        .eq("stage", "laser")
        .eq("status", "completed")
        .gte("created_at", sevenDaysAgoISO)
        .order("created_at", { ascending: false }),

      // QC SUMMARY
      admin
        .from("legacy_quality_checklist_results")
        .select(`check_key, passed, stage_history_id, created_at`)
        .order("created_at", { ascending: false })
        .limit(500),

      // QC ACTIVITY
      admin
        .from("stage_history")
        .select(
          `
          data, note, stage, created_at,
          legacy_orders!stage_history_order_id_fkey (kode_order),
          users!stage_history_changed_by_fkey (full_name)
        `,
        )
        .in("stage", ["qc_1", "qc_2", "qc_3"])
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    // Helper: log errors
    const logError = (label: string, result: PromiseSettledResult<unknown>) => {
      const res = result.status === "fulfilled" ? result.value as { error?: { message: string } | null } : null;
      if (res?.error) {
        console.error(
          `[GET /api/operational] ${label}:`,
          res.error.message,
        );
      }
    };

    logError("admin tasks", adminTasksResult);
    logError("racik", racikResult);
    logError("laser", laserResult);
    logError("qc summary", qcSummaryResult);
    logError("qc activity", qcActivityResult);

    // ========== KONFIRMASI ==========
    // Approval-stage orders awaiting review, from the legacy tracking pointer.
    const { data: waitingApprovalTracking, error: waitingError } = await admin
      .from("tracking_stages")
      .select("updated_at, current_stage, legacy_orders!tracking_stages_order_id_fkey(kode_order, nama, no_hp, created_at)")
      .in("current_stage", ["approval_penerimaan_order", "approval_qc_1"])
      .order("updated_at", { ascending: true })
      .limit(30);

    if (waitingError) {
      console.error(
        "[GET /api/operational] konfirmasi (orders):",
        waitingError.message,
      );
    }

    type KonfirmLegacy = { kode_order: string; nama: string | null; no_hp: string | null; created_at: string | null };
    const konfirmasi = (waitingApprovalTracking || [])
      .slice(0, 10)
      .map((row) => {
        const lo = (Array.isArray(row.legacy_orders) ? row.legacy_orders[0] : row.legacy_orders) as KonfirmLegacy | undefined;
        const createdAt = lo?.created_at ?? row.updated_at;
        const hoursElapsed = createdAt
          ? (now.getTime() - new Date(createdAt).getTime()) / 3_600_000
          : 0;
        return {
          order_number: lo?.kode_order ?? "—",
          customer_name: lo?.nama ?? null,
          wa_contact: lo?.no_hp ?? null,
          dp_requested_at: createdAt,
          dp_received_at: null,
          dp_amount: null,
          customer_decision: "pending",
          confirmation_started_at: createdAt,
          confirmation_finished_at: null,
          hours_elapsed: Math.round(hoursElapsed * 10) / 10,
        };
      });

    // ========== PELUNASAN ==========
    // Legacy orders carry no pricing (harga/dp_amount) — section is empty.
    const pelunasan: Array<Record<string, unknown>> = [];

    // ========== DELIVERY ==========
    // Legacy has no deliveries/stage delivery data surfaced here — empty.
    const delivery: Array<Record<string, unknown>> = [];

    // ========== ADMIN TASKS ==========
    const adminTasksRaw =
      adminTasksResult.status === "fulfilled" && !adminTasksResult.value.error
        ? adminTasksResult.value.data || []
        : [];

    // stage_history rows are completed submissions (no in-progress / duration).
    const adminTasks = adminTasksRaw
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 20)
      .map((row) => ({
        order_id: row.order_id,
        order_number: (row as any).legacy_orders?.kode_order ?? null,
        stage: row.stage,
        executed_by: (row as any).users?.full_name ?? null,
        executed_by_role: (row as any).users?.role?.name ?? null,
        duration_minutes: null,
        is_active: false,
        started_at: row.created_at,
        is_delayed: false,
      }));

    // ========== RACIK BAHAN ==========
    const racikRaw =
      racikResult.status === "fulfilled" && !racikResult.value.error
        ? racikResult.value.data || []
        : [];

    const racikFinished = racikRaw;

    // target_weight is not available for legacy orders → deviation always 0.
    const deviationSum = 0,
      deviationCount = 0;
    let bufferSum = 0,
      bufferCount = 0;

    racikFinished.forEach((row) => {
      const buffer = parseFloat(row.data?.shrinkage_buffer);
      if (!isNaN(buffer)) {
        bufferSum += buffer;
        bufferCount++;
      }
    });

    const racikLogs = racikFinished.slice(0, 5).map((row) => ({
      order_number: (row as any).legacy_orders?.kode_order ?? null,
      staff_name: (row as any).users?.full_name ?? null,
      target_weight: null,
      total_weight: row.data?.total_weight ?? null,
      shrinkage_buffer: row.data?.shrinkage_buffer ?? null,
      timestamp: row.created_at,
    }));

    const targetShrinkagePercent = 5.0;
    const totalBeratTeoritis = 0;

    // ========== LASER ==========
    const laserRaw =
      laserResult.status === "fulfilled" && !laserResult.value.error
        ? laserResult.value.data || []
        : [];

    // stage_history has only completed submissions → no in-progress queue.
    const antrianUkir = 0;

    let durationSum = 0,
      durationCount = 0;
    laserRaw.forEach((r) => {
      const dur = parseFloat(r.data?.engraving_duration_seconds);
      if (!isNaN(dur)) {
        durationSum += dur;
        durationCount++;
      }
    });

    const mesinSet = new Set<string>();

    const laserRecent = laserRaw
      .slice(0, 5)
      .map((r) => ({
        order_number: (r as any).legacy_orders?.kode_order ?? null,
        engraved_text: r.data?.engraved_text ?? null,
        ring_identity_number: r.data?.ring_identity_number ?? null,
        font_style: r.data?.font_style ?? null,
        laser_machine_id: r.data?.laser_machine_id ?? null,
        completed_at: r.created_at,
      }));

    // ========== QC SUMMARY ==========
    const qcSummaryRaw =
      qcSummaryResult.status === "fulfilled" && !qcSummaryResult.value.error
        ? qcSummaryResult.value.data || []
        : [];

    if (qcSummaryResult.status === "fulfilled" && qcSummaryResult.value.error) {
      console.error(
        "[GET /api/operational] qc summary:",
        qcSummaryResult.value.error.message,
      );
    }

    // Filter to last 7 days in JS
    const sevenDaysAgoMs = sevenDaysAgo.getTime();
    const _filteredQcRaw = qcSummaryRaw.filter((row) => {
      const rowDate = new Date(row.created_at).getTime();
      return rowDate >= sevenDaysAgoMs;
    });

    const srIds = [
      ...new Set(
        qcSummaryRaw
          .map((r) => r.stage_history_id)
          .filter(Boolean),
      ),
    ];

    const stageMap = new Map<string, { stage: string; finished_at: string }>();
    if (srIds.length > 0) {
      const { data: srData } = await admin
        .from("stage_history")
        .select("id, stage, created_at")
        .in("id", srIds);
      (srData || []).forEach((sr) => {
        stageMap.set(sr.id, { stage: sr.stage, finished_at: sr.created_at });
      });
    }

    const qcSummaryMap = new Map<
      string,
      { total: number; passed: number; failed: number; date: string }
    >();
    qcSummaryRaw.forEach((row) => {
      const sr = stageMap.get(row.stage_history_id);
      if (!sr) return;
      const stage = sr.stage;
      // Fallback to created_at if finished_at is null
      const date = (sr.finished_at || row.created_at)?.split("T")[0];
      if (!stage || !date) return;
      const key = `${date}_${stage}`;
      if (!qcSummaryMap.has(key))
        qcSummaryMap.set(key, { total: 0, passed: 0, failed: 0, date });
      const entry = qcSummaryMap.get(key)!;
      entry.total++;
      if (row.passed) entry.passed++;
      else entry.failed++;
    });

    const qcSummary = Array.from(qcSummaryMap.entries()).map(([key, val]) => ({
      qc_date: val.date,
      qc_type: key.split("_").slice(1).join("_"),
      total_checks: val.total,
      passed: val.passed,
      failed: val.failed,
      pass_rate: val.total > 0 ? (val.passed / val.total) * 100 : 0,
    }));

    // ========== QC ACTIVITY ==========
    const qcActivityRaw =
      qcActivityResult.status === "fulfilled" && !qcActivityResult.value.error
        ? qcActivityResult.value.data || []
        : [];

    const qcActivity = qcActivityRaw.map((row) => ({
      order_number: (row as any).legacy_orders?.kode_order ?? null,
      stage: row.stage,
      result: row.data?.overall_result ?? null,
      executed_by: (row as any).users?.full_name ?? null,
      finished_at: row.created_at,
      notes: (row as any).note,
      issues_found: row.data?.issues_found ?? null,
    }));

    // ========== RESPONSE ==========
    return NextResponse.json({
      data: {
        afterSales: { konfirmasi, pelunasan, delivery },
        adminTasks,
        racik: {
          totalBeratTeoritis,
          rataDeviasi: deviationCount > 0 ? deviationSum / deviationCount : 0,
          rataBuffer: bufferCount > 0 ? bufferSum / bufferCount : 0,
          targetShrinkagePercent,
          logs: racikLogs,
        },
        laser: {
          mesinAktif: Array.from(mesinSet),
          antrianUkir,
          rataWaktuPengerjaan:
            durationCount > 0 ? durationSum / durationCount : 120,
          recentResults: laserRecent,
        },
        qc: { summary: qcSummary, activity: qcActivity },
      },
    });
  } catch (error) {
    console.error("[GET /api/operational] unexpected:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
