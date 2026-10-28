// app/api/production/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";

// Role yang termasuk "Jewelry Expert"
const EXPERT_ROLES = [
  "jewelry_expert_lebur_bahan",
  "jewelry_expert_pembentukan_awal",
  "jewelry_expert_finishing",
  "micro_setting",
] as const;

// Mapping role → stage default (yang dikerjakan role tersebut)
const ROLE_DEFAULT_STAGE: Record<string, string> = {
  jewelry_expert_lebur_bahan: "lebur_bahan",
  jewelry_expert_pembentukan_awal: "pembentukan_cincin",
  jewelry_expert_finishing: "finishing",
  micro_setting: "pemasangan_permata",
};

export async function GET(request?: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    // ========== AUTH ==========
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Parse date params from query
    const url = request?.url ? new URL(request.url) : null;
    const fromParam = url?.searchParams.get("from");
    const toParam = url?.searchParams.get("to");

    // Helper tanggal
    const now = new Date();

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoISO = fromParam ? new Date(fromParam).toISOString() : sevenDaysAgo.toISOString();

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = fromParam ? new Date(fromParam).toISOString() : thirtyDaysAgo.toISOString();
    const _toDateISO = toParam ? new Date(toParam + "T23:59:59").toISOString() : now.toISOString();

    // ========== 1. DAFTAR EXPERT USERS ==========
    const { data: expertUsers, error: expertUsersError } = await admin
      .from("users")
      .select(
        `
        id,
        full_name,
        status,
        role:roles!users_role_id_fkey ( name )
      `,
      )
      .eq("status", "active")
      .is("deleted_at", null);

    if (expertUsersError) {
      console.error(
        "[GET /api/production] expert users:",
        expertUsersError.message,
      );
      return NextResponse.json(
        { error: "Gagal mengambil data expert" },
        { status: 500 },
      );
    }

    const expertUserList = (expertUsers || [])
      .filter((u) => EXPERT_ROLES.includes(getRoleProps(u).name as typeof EXPERT_ROLES[number]))
      .map((u) => ({
        id: u.id,
        fullName: u.full_name,
        roleName: getRoleProps(u).name,
      }));
    const expertUserIds = expertUserList.map((u) => u.id);

    // ========== 2. SCAN EVENTS HARI INI ==========
    // Scan-based metrics are unavailable for legacy orders.
    const todayScans: Array<{ user_id: string; order_id: string | null }> = [];

    const scanStats = new Map<
      string,
      { totalScans: number; orderSet: Set<string> }
    >();
    todayScans.forEach((s) => {
      const stat = scanStats.get(s.user_id) ?? {
        totalScans: 0,
        orderSet: new Set(),
      };
      stat.totalScans += 1;
      if (s.order_id) stat.orderSet.add(s.order_id);
      scanStats.set(s.user_id, stat);
    });

    // ========== 3. ACTIVE ORDERS PER EXPERT ==========
    // Legacy stage_history only records COMPLETED submissions (no in-progress
    // rows), so "active work per expert" cannot be derived. Left empty.
    const activeByUser = new Map<
      string,
      { orderNumber: string; startedAt: string; stage: string }
    >();

    // ========== 4. METRIK SUSUT/DEVIASI PER EXPERT ==========
    const { data: recentResults, error: recentResultsError } =
      expertUserIds.length > 0
        ? await admin
            .from("stage_history")
            .select("changed_by, stage, data")
            .in("changed_by", expertUserIds)
            .in("stage", ["lebur_bahan", "pembentukan_cincin", "pemolesan"])
            .eq("status", "completed")
            .gte("created_at", thirtyDaysAgoISO)
        : { data: [], error: null };

    if (recentResultsError) {
      console.error(
        "[GET /api/production] recent results:",
        recentResultsError.message,
      );
      return NextResponse.json(
        { error: "Gagal mengambil metrik susut" },
        { status: 500 },
      );
    }

    const susutByUser = new Map<string, { sum: number; count: number }>();
    (recentResults || []).forEach((row) => {
      const userId = (row as { changed_by: string }).changed_by;
      const stat = susutByUser.get(userId) ?? { sum: 0, count: 0 };
      let deviation: number | null = null;

      if (row.stage === "lebur_bahan") {
        const sp = parseFloat(row.data?.shrinkage_percent);
        if (!isNaN(sp)) deviation = sp;
      } else if (row.stage === "pembentukan_cincin") {
        const lost = parseFloat(row.data?.weight_lost);
        const input = parseFloat(row.data?.weight_input);
        if (!isNaN(lost) && !isNaN(input) && input > 0) {
          deviation = (lost / input) * 100;
        }
      } else if (row.stage === "pemolesan") {
        const lost = parseFloat(row.data?.weight_lost);
        const before = parseFloat(row.data?.weight_before_polish);
        if (!isNaN(lost) && !isNaN(before) && before > 0) {
          deviation = (lost / before) * 100;
        }
      }

      if (deviation != null) {
        stat.sum += deviation;
        stat.count += 1;
        susutByUser.set(userId, stat);
      }
    });

    // ========== 5. SUSUN FINAL EXPERTS ARRAY ==========
    const experts = expertUserList
      .map((expert) => {
        const stats = scanStats.get(expert.id) ?? {
          totalScans: 0,
          orderSet: new Set(),
        };
        const active = activeByUser.get(expert.id);
        const susut = susutByUser.get(expert.id);

        const activeStage =
          active?.stage ?? ROLE_DEFAULT_STAGE[expert.roleName];
        const rataSusut =
          susut && susut.count > 0 ? susut.sum / susut.count : null;
        const targetSusut = null;

        return {
          userId: expert.id,
          fullName: expert.fullName,
          roleName: expert.roleName,
          stage: activeStage,
          totalScans: stats.totalScans,
          ordersHandled: stats.orderSet.size,
          activeOrder: active
            ? { orderNumber: active.orderNumber, startedAt: active.startedAt }
            : null,
          rataSusut,
          targetSusut,
        };
      })
      .sort((a, b) => b.ordersHandled - a.ordersHandled);

    // ========== 7. MICRO SETTING ==========
    const { data: microTracking, error: microOrdersError } = await admin
      .from("tracking_stages")
      .select("order_id, current_stage, stage_status, legacy_orders!tracking_stages_order_id_fkey(id, kode_order)")
      .in("current_stage", ["pemasangan_permata", "pemolesan", "qc_1"])
      .limit(10);

    if (microOrdersError) {
      console.error(
        "[GET /api/production] micro orders:",
        microOrdersError.message,
      );
      return NextResponse.json(
        { error: "Gagal mengambil data micro setting" },
        { status: 500 },
      );
    }

    type MicroLegacy = { id: string; kode_order: string };
    const microOrders = (microTracking || []).map((t) => {
      const lo = (Array.isArray(t.legacy_orders) ? t.legacy_orders[0] : t.legacy_orders) as MicroLegacy | undefined;
      return {
        id: lo?.id ?? t.order_id,
        order_number: lo?.kode_order ?? "—",
        current_stage: t.current_stage,
        status: t.stage_status,
      };
    });

    const microOrderIds = microOrders.map((o) => o.id);

    const { data: microResults } =
      microOrderIds.length > 0
        ? await admin
            .from("stage_history")
            .select(
              `
              order_id,
              created_at,
              attempt_number,
              data,
              users!stage_history_changed_by_fkey ( full_name )
            `,
            )
            .eq("stage", "pemasangan_permata")
            .eq("status", "completed")
            .in("order_id", microOrderIds)
            .order("attempt_number", { ascending: false })
        : { data: [] };

    const latestMicroByOrder = new Map<string, Record<string, unknown>>();
    (microResults || []).forEach((row) => {
      if (!latestMicroByOrder.has(row.order_id)) {
        latestMicroByOrder.set(row.order_id, row as unknown as Record<string, unknown>);
      }
    });

    const microSetting = microOrders
      .map((o) => {
        const result = latestMicroByOrder.get(o.id);
        const data = result?.data as Record<string, unknown> | undefined;
        const weightBefore = result
          ? parseFloat(String(data?.weight_before_setting ?? ""))
          : null;
        const weightAfter = result
          ? parseFloat(String(data?.weight_after_setting ?? ""))
          : null;

        // stage_history rows are always completed submissions.
        const status: "waiting" | "in_progress" | "completed" = result
          ? "completed"
          : "waiting";

        return {
          order_id: o.id,
          order_number: o.order_number,
          gemstone_info: null,
          current_stage: o.current_stage,
          staff_name: (result as any)?.users?.full_name ?? null,
          started_at: (result as any)?.created_at ?? null,
          finished_at: (result as any)?.created_at ?? null,
          weight_before: isNaN(weightBefore as number) ? null : weightBefore,
          weight_after: isNaN(weightAfter as number) ? null : weightAfter,
          status,
        };
      })
      .sort((a, b) => {
        const order = { in_progress: 0, waiting: 1, completed: 2 };
        const ao = order[a.status as keyof typeof order];
        const bo = order[b.status as keyof typeof order];
        if (ao !== bo) return ao - bo;
        const at = a.started_at ? new Date(a.started_at).getTime() : 0;
        const bt = b.started_at ? new Date(b.started_at).getTime() : 0;
        return bt - at;
      })
      .slice(0, 20);

    // ========== 8. YIELD MATERIAL ==========
    const { data: completedTracking, error: completedError } = await admin
      .from("tracking_stages")
      .select("order_id, updated_at, legacy_orders!tracking_stages_order_id_fkey(id, kode_order, created_at)")
      .eq("current_stage", "selesai")
      .gte("updated_at", sevenDaysAgoISO)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (completedError) {
      console.error(
        "[GET /api/production] completed orders:",
        completedError.message,
      );
      return NextResponse.json(
        { error: "Gagal mengambil data yield" },
        { status: 500 },
      );
    }

    type YieldLegacy = { id: string; kode_order: string; created_at: string | null };
    const completedOrders = (completedTracking || []).map((t) => {
      const lo = (Array.isArray(t.legacy_orders) ? t.legacy_orders[0] : t.legacy_orders) as YieldLegacy | undefined;
      return {
        id: lo?.id ?? t.order_id,
        order_number: lo?.kode_order ?? "—",
        created_at: lo?.created_at ?? null,
        completed_at: t.updated_at,
      };
    });

    const completedOrderIds = completedOrders.map((o) => o.id);

    const { data: qc2Results } =
      completedOrderIds.length > 0
        ? await admin
            .from("stage_history")
            .select("order_id, data")
            .eq("stage", "qc_2")
            .eq("status", "completed")
            .in("order_id", completedOrderIds)
            .order("attempt_number", { ascending: false })
        : { data: [] };

    const qc2ByOrder = new Map<string, number>();
    (qc2Results || []).forEach((row) => {
      if (!qc2ByOrder.has(row.order_id)) {
        const weight = parseFloat(row.data?.weight_final_label);
        if (!isNaN(weight)) qc2ByOrder.set(row.order_id, weight);
      }
    });

    const yieldData = (completedOrders || [])
      .map((o) => {
        const actual = qc2ByOrder.get(o.id) ?? null;

        return {
          order_date: o.created_at,
          order_number: o.order_number,
          target: null,
          actual,
          susut: null,
        };
      })
      .slice(0, 10);

    // ========== RESPONSE ==========
    return NextResponse.json({
      data: {
        experts,
        microSetting,
        yieldData,
      },
    });
  } catch (error) {
    console.error("[GET /api/production] unexpected:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
