// app/api/daily-stats-2/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";
import { calculateWorkshopPulse } from "@/lib/workshop-pulse";

// ============================================================
// Config & Initialization
// ============================================================

const STAGE_ORDER = [
  "penerimaan_order",
  "approval_penerimaan_order",
  "racik_bahan",
  "lebur_bahan",
  "pembentukan_cincin",
  "pemasangan_permata",
  "pemolesan",
  "qc_1",
  "approval_qc_1",
  "finishing",
  "laser",
  "qc_2",
  "approval_qc_2",
  "kelengkapan",
  "qc_3",
  "approval_qc_3",
  "packing",
  "pelunasan",
  "approval_pelunasan",
  "pengiriman",
];

const PRODUCTION_ROLES = [
  "jewelry_expert_lebur_bahan",
  "jewelry_expert_pembentukan_awal",
  "jewelry_expert_poles",
  "jewelry_expert_finishing",
  "micro_setting",
  "laser",
];

const DEFAULT_TARGET_CYCLE_TIME = 14;

// ============================================================
// Types
// ============================================================

interface DailyStatsResponse {
  kpi: {
    totalOrdersAktif: number;
    potensiKeterlambatan: number;
    nilaiBarangWIP: {
      beratEmas: number;
      jumlahPermata: number;
      estimasiRupiah: number;
      avgKarat: number;
    };
    rataCycleTime: number;
    targetCycleTime: number;
    additional: {
      ordersHariIni: number;
      selesaiHariIni: number;
      totalRework: number;
      criticalRework: number;
      completedCount: number;
    };
    trend: {
      currentWeekOrders: number;
      lastWeekOrders: number;
      trendPercent: number;
    };
  };
  operasional: {
    afterSales: {
      totalKonfirmasi: number;
      totalPelunasan: number;
      totalDelivery: number;
      urgentCount: number;
    };
    adminTasks: { total: number; delayed: number; active: number };
    racik: {
      rataShrinkage: number;
      targetShrinkage: number;
      totalBerat: number;
    };
    laser: { antrian: number; mesinAktif: number };
    qc: { passRateAvg: number; totalChecks: number; failedToday: number };
  };
  produksi: {
    experts: { total: number; aktif: number; totalOrders: number };
    microSetting: { total: number; inProgress: number; waiting: number };
  };
  workshopPulse: {
    today: {
      ordersReceived: number;
      ordersCompleted: number;
      reworksLogged: number;
      activeUsers: number;
    };
    workInProgress: { activeOrders: number; overdueOrders: number };
    afterProduction: { customerCare: number; packing: number; shipping: number };
  };
  recentActivities: Array<{
    id: string;
    type: "scan" | "qc" | "approval" | "rework";
    orderNumber: string;
    stage: string;
    user: string;
    timestamp: string;
    status?: "success" | "warning" | "error";
    notes?: string;
  }>;
  topPerformers: Array<{
    name: string;
    role: string;
    ordersCompleted: number;
    avgTime: number;
  }>;
  stageDistribution: Array<{ stage: string; count: number }>;
}

// ============================================================
// Helpers
// ============================================================

async function calculateAverageCycleTime(
  admin: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Legacy: cycle time = tgl_selesai - tgl_order from orders that reached selesai
  const { data, error } = await admin
    .from("legacy_orders")
    .select("tgl_order, tgl_selesai")
    .is("deleted_at", null)
    .not("tgl_selesai", "is", null)
    .gte("tgl_selesai", thirtyDaysAgo.toISOString().split("T")[0]);

  if (error || !data || data.length === 0) return 0;

  const totalDays = data.reduce((sum: number, order: Record<string, unknown>) => {
    const start = new Date((order.tgl_order as string) ?? "");
    const end = new Date((order.tgl_selesai as string) ?? "");
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return sum;
    return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  }, 0);

  return totalDays / data.length;
}

function estimateWipValue(beratEmas: number, jumlahPermata: number): number {
  return beratEmas * 1200000 + jumlahPermata * 500000;
}

function mapStageToActivityType(
  stage: string,
): "scan" | "qc" | "approval" | "rework" {
  if (stage.startsWith("qc_")) return "qc";
  if (stage.startsWith("approval_") || stage === "pelunasan") return "approval";
  return "scan";
}

function getJakartaDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

// ============================================================
// Main API Handler
// ============================================================

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: currentUser } = await supabase
    .from("users")
    .select("role:roles!users_role_id_fkey(name)")
    .eq("id", user.id)
    .single();

  if (getRoleProps(currentUser).name !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const jakartaDate = getJakartaDate();
    const jakartaTodayStart = new Date(
      `${jakartaDate}T00:00:00+07:00`,
    ).toISOString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const todayDateStr =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    // ============================================================
    // Parallel Queries (all use admin client)
    // ============================================================
    const [
      activeOrdersQuery,
      potentiallyLateQuery,
      wipMaterialsQuery,
      todayOrdersQuery,
      completedTodayQuery,
      completed30DaysQuery,
      reworkStatsQuery,
      thisWeekOrdersQuery,
      lastWeekOrdersQuery,
      afterSalesOrdersQuery,
      racikStatsQuery,
      laserStatsQuery,
      qcStatsQuery,
      expertUsersQuery,
      microSettingQuery,
      adminTasksQuery,
      stageDistributionQuery,
      recentActivitiesQuery,
      workshopOrdersTodayQuery,
      workshopReworksTodayQuery,
      workshopUserActivityQuery,
      workshopStagesQuery,
    ] = await Promise.all([
      admin
        .from("tracking_stages")
        .select("order_id", { count: "exact", head: true })
        .neq("current_stage", "selesai"),
      admin
        .from("legacy_orders")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .not("tgl_selesai", "is", null)
        .lte("tgl_selesai", todayDateStr),
      admin
        .from("stage_history")
        .select("order_id, data, stage")
        .eq("status", "completed")
        .in("stage", ["racik_bahan", "pemasangan_permata", "finishing"])
        .order("created_at", { ascending: false }),
      admin
        .from("legacy_orders")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", todayISO),
      admin
        .from("tracking_stages")
        .select("order_id", { count: "exact", head: true })
        .eq("current_stage", "selesai")
        .gte("updated_at", todayISO),
      admin
        .from("tracking_stages")
        .select("order_id", { count: "exact", head: true })
        .eq("current_stage", "selesai")
        .gte("updated_at", thirtyDaysAgoISO),
      admin
        .from("legacy_rework_logs")
        .select("severity")
        .gte("logged_at", thirtyDaysAgoISO),
      admin
        .from("legacy_orders")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", startOfWeek.toISOString()),
      admin
        .from("legacy_orders")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", startOfLastWeek.toISOString())
        .lt("created_at", startOfWeek.toISOString()),
      admin
        .from("tracking_stages")
        .select("order_id, current_stage, legacy_orders!tracking_stages_order_id_fkey(kode_order, tgl_selesai)")
        .in("current_stage", [
          "approval_penerimaan_order",
          "approval_qc_1",
          "pelunasan",
          "pengiriman",
        ])
        .limit(100),
      admin
        .from("stage_history")
        .select("data, created_at")
        .eq("stage", "racik_bahan")
        .eq("status", "completed")
        .gte("created_at", thirtyDaysAgoISO),
      admin
        .from("stage_history")
        .select("id, data, created_at")
        .eq("stage", "laser")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("stage_history")
        .select("stage, data, created_at")
        .in("stage", ["qc_1", "qc_2", "qc_3"])
        .eq("status", "completed")
        .gte("created_at", todayISO),
      admin
        .from("users")
        .select(
          "id, full_name, status, role:roles!users_role_id_fkey(name, role_group)",
        )
        .is("deleted_at", null),
      admin
        .from("stage_history")
        .select("id, data, created_at, legacy_orders!stage_history_order_id_fkey(id, kode_order)")
        .eq("stage", "pemasangan_permata")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("stage_history")
        .select("id, stage, created_at")
        .eq("status", "completed")
        .in("stage", ["pelunasan", "kelengkapan", "packing", "pengiriman"])
        .limit(200),
      admin
        .from("tracking_stages")
        .select("current_stage")
        .neq("current_stage", "selesai"),
      // Recent activities come from latest stage_history.
      admin
        .from("stage_history")
        .select("id, stage, note, created_at, legacy_orders!stage_history_order_id_fkey(kode_order), users!stage_history_changed_by_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(30),
      admin
        .from("legacy_orders")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("tgl_order", jakartaDate),
      admin
        .from("legacy_rework_logs")
        .select("id", { count: "exact", head: true })
        .gte("logged_at", jakartaTodayStart),
      admin
        .from("stage_history")
        .select("changed_by")
        .gte("created_at", jakartaTodayStart)
        .not("changed_by", "is", null),
      admin
        .from("tracking_stages")
        .select("current_stage, updated_at, legacy_orders!tracking_stages_order_id_fkey(deleted_at, tgl_selesai)"),
    ]);

    // ============================================================
    // KPI Calculations
    // ============================================================
    const totalOrdersAktif = activeOrdersQuery.count || 0;
    const potensiKeterlambatan = potentiallyLateQuery.count || 0;

    const totalBeratEmas = 0,
      totalPermata = 0,
      totalKarat = 0,
      karatCount = 0;
    const processedOrders = new Set<string>();
    (wipMaterialsQuery.data || []).forEach((record) => {
      if (processedOrders.has(record.order_id)) return;
      processedOrders.add(record.order_id);
    });

    const avgKarat = karatCount > 0 ? totalKarat / karatCount : 0;
    const estimasiRupiah = estimateWipValue(totalBeratEmas, totalPermata);
    const rataCycleTime = await calculateAverageCycleTime(admin);

    const reworkData = reworkStatsQuery.data || [];
    const totalRework = reworkData.length;
    const criticalRework = reworkData.filter(
      (r) => r.severity === "critical",
    ).length;

    const currentWeekOrders = thisWeekOrdersQuery.count || 0;
    const lastWeekOrders = lastWeekOrdersQuery.count || 0;
    const trendPercent =
      lastWeekOrders > 0
        ? ((currentWeekOrders - lastWeekOrders) / lastWeekOrders) * 100
        : 0;

    // ============================================================
    // After Sales
    // ============================================================
    const afterSalesData = afterSalesOrdersQuery.data || [];
    let totalKonfirmasi = 0,
      totalPelunasan = 0,
      totalDelivery = 0,
      urgentCount = 0;
    afterSalesData.forEach((record) => {
      const lo = (record as any).legacy_orders as { kode_order?: string; tgl_selesai?: string | null } | undefined;
      if (
        record.current_stage === "approval_penerimaan_order" ||
        record.current_stage === "approval_qc_1"
      )
        totalKonfirmasi++;
      if (record.current_stage === "pelunasan") totalPelunasan++;
      if (record.current_stage === "pengiriman") totalDelivery++;
      if (lo?.tgl_selesai) {
        const daysLeft =
          (new Date(lo.tgl_selesai).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24);
        if (daysLeft <= 2 && daysLeft > 0) urgentCount++;
      }
    });

    // ============================================================
    // Racik
    // ============================================================
    let totalShrinkage = 0,
      shrinkCount = 0,
      totalRacikBerat = 0;
    (racikStatsQuery.data || []).forEach((record) => {
      const d = record.data;
      if (d?.actual_weight && d?.target_weight) {
        totalShrinkage +=
          ((d.target_weight - d.actual_weight) / d.target_weight) * 100;
        shrinkCount++;
        totalRacikBerat += d.actual_weight;
      }
    });
    const rataShrinkage = shrinkCount > 0 ? totalShrinkage / shrinkCount : 0;

    // ============================================================
    // Laser
    // ============================================================
    const laserData = laserStatsQuery.data || [];
    // stage_history rows are all completed submissions — no in-progress queue.
    const antrianLaser = 0;
    const mesinAktifLaser = laserData.length;

    // ============================================================
    // QC
    // ============================================================
    const qcData = qcStatsQuery.data || [];
    let totalPassRate = 0,
      passCount = 0,
      failedToday = 0;
    qcData.forEach((record) => {
      if (record.data?.overall_result) {
        passCount++;
        if (record.data.overall_result === "passed") totalPassRate++;
      }
      if (record.data?.overall_result === "failed") failedToday++;
    });
    const passRateAvg = passCount > 0 ? (totalPassRate / passCount) * 100 : 0;

    // ============================================================
    // Experts
    // ============================================================
    const allUsers = expertUsersQuery.data || [];
    const expertData = allUsers.filter((u) =>
      PRODUCTION_ROLES.includes(getRoleProps(u).name),
    );
    const totalExperts = expertData.length;
    const activeExperts = expertData.filter(
      (e) => e.status === "active",
    ).length;

    // Use stage_history to count expert orders.
    // for active experts as a rough proxy.
    const activeExpertIds = expertData
      .filter((e) => e.status === "active")
      .map((e) => e.id);
    const { count: totalExpertOrders } = activeExpertIds.length > 0
      ? await admin
          .from("stage_history")
          .select("order_id", { count: "exact", head: true })
          .eq("status", "completed")
          .in("changed_by", activeExpertIds)
          .gte("created_at", todayISO)
      : { count: 0 };

    // ============================================================
    // Micro Setting
    // ============================================================
    const microData = microSettingQuery.data || [];
    // Legacy: no has_gemstone field; all stage_history rows are completed.
    const microSettingTotal = microData.length;
    const microInProgress = 0;

    // ============================================================
    // Admin Tasks
    // ============================================================
    const adminTasksRaw = adminTasksQuery.data || [];
    // stage_history rows are completed; no in-progress tracking in legacy.
    const adminTotal = adminTasksRaw.length;
    const adminActive = 0;
    const adminDelayed = 0;

    // ============================================================
    // Stage Distribution
    // ============================================================
    const stageCounts: Record<string, number> = {};
    STAGE_ORDER.forEach((s) => {
      stageCounts[s] = 0;
    });
    (stageDistributionQuery.data || []).forEach((order) => {
      if (
        order.current_stage &&
        stageCounts.hasOwnProperty(order.current_stage)
      ) {
        stageCounts[order.current_stage]++;
      }
    });
    const stageDistribution = STAGE_ORDER.filter((s) => stageCounts[s] > 0).map(
      (s) => ({ stage: s, count: stageCounts[s] }),
    );

    // ============================================================
    // Recent Activities
    // ============================================================
    const recentActivities = (recentActivitiesQuery.data || []).map(
      (activity) => ({
        id: activity.id,
        type: mapStageToActivityType(activity.stage),
        orderNumber: (activity as any).legacy_orders?.kode_order || "-",
        stage: activity.stage,
        user: (activity as any).users?.full_name || "Unknown",
        timestamp: activity.created_at,
        status: activity.stage.startsWith("approval_")
          ? "success" as const
          : activity.stage.startsWith("qc_")
            ? "success" as const
            : undefined,
        notes: activity.stage.startsWith("approval_")
          ? `Disetujui — stage ${activity.stage}`
          : (activity as any).note ?? undefined,
      }),
    );

    // ============================================================
    // Top performers from the active tracking history.
    // ============================================================
    const { data: performerData } = await admin
      .from("stage_history")
      .select(
        "changed_by, users!stage_history_changed_by_fkey(full_name, role:roles!users_role_id_fkey(name))",
      )
      .eq("status", "completed")
      .gte("created_at", thirtyDaysAgoISO);

    const performerMap = new Map<
      string,
      { name: string; role: string; count: number }
    >();
    (performerData || []).forEach((r) => {
      const uid = (r as { changed_by: string }).changed_by;
      if (!performerMap.has(uid)) {
        performerMap.set(uid, {
          name: (r as any).users?.full_name || "Unknown",
          role: getRoleProps((r as any).users).name || "-",
          count: 0,
        });
      }
      performerMap.get(uid)!.count++;
    });

    const topPerformers = Array.from(performerMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((p) => ({
        name: p.name,
        role: p.role,
        ordersCompleted: p.count,
        avgTime: 2.5,
      }));

    const workshopPulse = calculateWorkshopPulse({
      today: jakartaDate,
      todayStart: jakartaTodayStart,
      ordersReceived: workshopOrdersTodayQuery.count || 0,
      reworksLogged: workshopReworksTodayQuery.count || 0,
      activeUserIds: (workshopUserActivityQuery.data || []).map(
        (activity) => activity.changed_by,
      ),
      stages: (workshopStagesQuery.data || []).map((stage) => ({
        current_stage: stage.current_stage,
        updated_at: stage.updated_at,
        order: (stage as any).legacy_orders ?? null,
      })),
    });

    // ============================================================
    // Response
    // ============================================================
    const response: DailyStatsResponse = {
      kpi: {
        totalOrdersAktif,
        potensiKeterlambatan,
        nilaiBarangWIP: {
          beratEmas: Math.round(totalBeratEmas * 100) / 100,
          jumlahPermata: totalPermata,
          estimasiRupiah,
          avgKarat: Math.round(avgKarat * 10) / 10,
        },
        rataCycleTime: Math.round(rataCycleTime * 10) / 10,
        targetCycleTime: DEFAULT_TARGET_CYCLE_TIME,
        additional: {
          ordersHariIni: todayOrdersQuery.count || 0,
          selesaiHariIni: completedTodayQuery.count || 0,
          totalRework,
          criticalRework,
          completedCount: completed30DaysQuery.count || 0,
        },
        trend: {
          currentWeekOrders,
          lastWeekOrders,
          trendPercent: Math.round(trendPercent),
        },
      },
      operasional: {
        afterSales: {
          totalKonfirmasi,
          totalPelunasan,
          totalDelivery,
          urgentCount,
        },
        adminTasks: {
          total: adminTotal,
          delayed: adminDelayed,
          active: adminActive,
        },
        racik: {
          rataShrinkage: Math.round(rataShrinkage * 100) / 100,
          targetShrinkage: 5.0,
          totalBerat: Math.round(totalRacikBerat * 100) / 100,
        },
        laser: { antrian: antrianLaser, mesinAktif: mesinAktifLaser },
        qc: {
          passRateAvg: Math.round(passRateAvg * 10) / 10,
          totalChecks: qcData.length,
          failedToday,
        },
      },
      produksi: {
        experts: {
          total: totalExperts,
          aktif: activeExperts,
          totalOrders: totalExpertOrders || 0,
        },
        microSetting: {
          total: microSettingTotal,
          inProgress: microInProgress,
          waiting: microSettingTotal - microInProgress,
        },
      },
      workshopPulse,
      recentActivities,
      topPerformers,
      stageDistribution,
    };

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Daily Stats API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;
