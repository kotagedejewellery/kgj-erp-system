// app/api/supervisor/route.ts — monitoring dashboard data

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";
import { STAGE_SEQUENCE, STAGE_GROUP, STAGE_LABELS } from "@/lib/stages";
import { mapLegacyStatus } from "@/lib/legacy/adapter";
import { getBrandIdFromFilterCode } from "@/lib/legacy/brands";

const APPROVAL_STAGES = STAGE_SEQUENCE.filter((s) => s.startsWith("approval_"));

const OPERATIONAL_APPROVAL_STAGES = new Set(
  APPROVAL_STAGES.filter((s) => {
    const prodStage = STAGE_SEQUENCE[STAGE_SEQUENCE.indexOf(s) - 1];
    return prodStage ? STAGE_GROUP[prodStage] === "operational" : false;
  }),
);

const PRODUCTION_APPROVAL_STAGES = new Set(
  APPROVAL_STAGES.filter((s) => {
    const prodStage = STAGE_SEQUENCE[STAGE_SEQUENCE.indexOf(s) - 1];
    return prodStage ? STAGE_GROUP[prodStage] === "production" : false;
  }),
);

const APPROVAL_TO_PRODUCTION_STAGE: Record<string, string> = {};
APPROVAL_STAGES.forEach((approvalStage) => {
  const idx = STAGE_SEQUENCE.indexOf(approvalStage);
  if (idx > 0) {
    APPROVAL_TO_PRODUCTION_STAGE[approvalStage] = STAGE_SEQUENCE[idx - 1];
  }
});

async function verifySupervisor(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select(
      "id, full_name, role:roles!users_role_id_fkey(name, role_group, allowed_stages)",
    )
    .eq("id", userId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;

  const roleName = getRoleProps(data).name;
  const roleGroup = getRoleProps(data).role_group;
  const allowedStages: string[] = getRoleProps(data).allowed_stages;

  if (
    roleName === "superadmin" ||
    roleGroup === "management" ||
    allowedStages.some((s) => s.startsWith("approval_"))
  ) {
    return data;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !authUser)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supervisor = await verifySupervisor(authUser.id);
    if (!supervisor)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const svRoleName: string = getRoleProps(supervisor).name;
    const svRoleGroup: string = getRoleProps(supervisor).role_group;
    const svAllowedStages: string[] = getRoleProps(supervisor).allowed_stages;

    let supervisorApprovalStages: Set<string>;
    if (svRoleName === "production_supervisor") {
      supervisorApprovalStages = PRODUCTION_APPROVAL_STAGES;
    } else if (svRoleName === "operational_supervisor") {
      supervisorApprovalStages = OPERATIONAL_APPROVAL_STAGES;
    } else if (svRoleGroup === "management") {
      supervisorApprovalStages = new Set(APPROVAL_STAGES);
    } else {
      const fromAllowed = new Set(
        svAllowedStages.filter((s) => s.startsWith("approval_")),
      );
      supervisorApprovalStages =
        fromAllowed.size > 0 ? fromAllowed : new Set(APPROVAL_STAGES);
    }

    const admin = createAdminClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const brand = url.searchParams.get("brand") ?? "all";
    const brandId = brand === "all" ? null : getBrandIdFromFilterCode(brand);
    if (brand !== "all" && brandId === null) {
      return NextResponse.json({ error: "Brand tidak valid" }, { status: 400 });
    }

    const fromISO = fromParam ? new Date(fromParam).toISOString() : todayStart.toISOString();
    const toISO = toParam ? new Date(toParam + "T23:59:59").toISOString() : now.toISOString();

    const [ordersResult, completedResult, completedCountResult, submissionsTodayResult, ordersCreatedTodayResult, ordersCompletedTodayResult] = await Promise.allSettled([
      admin
        .from("tracking_stages")
        .select(
          "order_id, current_stage, stage_status, updated_at, legacy_orders!tracking_stages_order_id_fkey(id, kode_order, nama, tgl_order, tgl_selesai)",
        )
        .neq("current_stage", "selesai")
        .order("updated_at", { ascending: false })
        .limit(200),

      (() => {
        let q = admin
          .from("tracking_stages")
          .select(
            `order_id, current_stage, stage_status, updated_at, legacy_orders!tracking_stages_order_id_fkey${brandId ? "!inner" : ""}(id, kode_order, nama, tgl_order, tgl_selesai)`,
          )
          .eq("current_stage", "selesai");
        if (fromParam || toParam) {
          q = q.gte("updated_at", fromISO).lte("updated_at", toISO);
        }
        if (brandId) q = q.eq("legacy_orders.id_brand", brandId);
        return q.order("updated_at", { ascending: false }).limit(50);
      })(),

      (() => {
        let q = admin
          .from("tracking_stages")
          .select(
            brandId
              ? "id, legacy_orders!tracking_stages_order_id_fkey!inner(id_brand)"
              : "id",
            { count: "exact" },
          )
          .eq("current_stage", "selesai");
        if (fromParam || toParam) {
          q = q.gte("updated_at", fromISO).lte("updated_at", toISO);
        }
        if (brandId) q = q.eq("legacy_orders.id_brand", brandId);
        return q.limit(1);
      })(),

      admin
        .from("stage_history")
        .select("id", { count: "exact" })
        .eq("status", "completed")
        .gte("created_at", fromISO)
        .lte("created_at", toISO)
        .limit(1),

      admin
        .from("legacy_orders")
        .select("id", { count: "exact" })
        .is("deleted_at", null)
        .gte("created_at", todayStart.toISOString())
        .limit(1),

      admin
        .from("tracking_stages")
        .select("id", { count: "exact" })
        .eq("current_stage", "selesai")
        .gte("updated_at", todayStart.toISOString())
        .limit(1),
    ]);

    type LegacyEmbed = { id: string; kode_order: string; nama: string | null; tgl_order: string | null; tgl_selesai: string | null };
    type TrackRow = {
      order_id: string;
      current_stage: string;
      stage_status: string;
      updated_at: string | null;
      legacy_orders?: LegacyEmbed | LegacyEmbed[] | null;
    };

    const flatten = (rows: unknown[]) =>
      (rows as TrackRow[]).map((t) => {
        const lo = Array.isArray(t.legacy_orders) ? t.legacy_orders[0] : t.legacy_orders;
        return {
          id: t.order_id,
          order_number: lo?.kode_order ?? "—",
          customer_name: lo?.nama ?? null,
          current_stage: t.current_stage,
          status: mapLegacyStatus(t.stage_status, t.current_stage),
          created_at: lo?.tgl_order ?? null,
          updated_at: t.updated_at,
          deadline: lo?.tgl_selesai ?? null,
          completed_at: t.current_stage === "selesai" ? t.updated_at : null,
        };
      });

    const orders =
      ordersResult.status === "fulfilled" ? flatten(ordersResult.value.data || []) : [];
    const completedOrdersRaw =
      completedResult.status === "fulfilled" ? flatten(completedResult.value.data || []) : [];
    const completedCount =
      completedCountResult.status === "fulfilled"
        ? completedCountResult.value.count || 0
        : 0;
    const submissionsToday =
      submissionsTodayResult.status === "fulfilled"
        ? submissionsTodayResult.value.count || 0
        : 0;
    const ordersCreatedToday =
      ordersCreatedTodayResult.status === "fulfilled"
        ? ordersCreatedTodayResult.value.count || 0
        : 0;
    const ordersCompletedToday =
      ordersCompletedTodayResult.status === "fulfilled"
        ? ordersCompletedTodayResult.value.count || 0
        : 0;

    // ── Cumulative processing time for completed orders ─────────────────────────
    const completedOrderIds = completedOrdersRaw.map((o) => o.id);
    const transitionsByOrder = new Map<string, { order_id: string; transitioned_at: string }[]>();
    if (completedOrderIds.length > 0) {
      const { data: transitions } = await admin
        .from("stage_history")
        .select("order_id, created_at")
        .in("order_id", completedOrderIds)
        .order("created_at", { ascending: true });
      for (const t of transitions || []) {
        const arr = transitionsByOrder.get(t.order_id) || [];
        arr.push({ order_id: t.order_id, transitioned_at: t.created_at });
        transitionsByOrder.set(t.order_id, arr);
      }
    }

    const completedOrders = completedOrdersRaw.map((o) => {
      const tx = transitionsByOrder.get(o.id) || [];
      let totalMs = 0;
      for (let i = 1; i < tx.length; i++) {
        const diff = new Date(tx[i].transitioned_at).getTime() - new Date(tx[i - 1].transitioned_at).getTime();
        if (diff > 0) totalMs += diff;
      }
      return { ...o, process_time_ms: totalMs > 0 ? totalMs : null };
    });

    // ── Pending approval count ─────────────────────────────────────────────────
    let pendingCount = 0;
    const { data: waitingOrders } = await admin
      .from("tracking_stages")
      .select("order_id, current_stage")
      .in("current_stage", [...supervisorApprovalStages])
      .limit(100);

    if (waitingOrders && waitingOrders.length > 0) {
      pendingCount += waitingOrders.filter(
        (o) => o.current_stage === "approval_penerimaan_order",
      ).length;

      const otherIds = waitingOrders
        .filter((o) => o.current_stage !== "approval_penerimaan_order")
        .map((o) => o.order_id);

      if (otherIds.length > 0) {
        const orderExpectedStage = new Map<string, string>();
        for (const o of waitingOrders) {
          const prodStage = APPROVAL_TO_PRODUCTION_STAGE[o.current_stage];
          if (prodStage && o.current_stage !== "approval_penerimaan_order") {
            orderExpectedStage.set(o.order_id, prodStage);
          }
        }

        const { data: srRows } = await admin
          .from("stage_history")
          .select("order_id, stage, attempt_number")
          .in("order_id", otherIds)
          .eq("status", "completed")
          .order("attempt_number", { ascending: false });

        const seen = new Set<string>();
        for (const r of srRows ?? []) {
          const expected = orderExpectedStage.get(r.order_id);
          if (!expected || r.stage !== expected) continue;
          if (seen.has(r.order_id)) continue;
          seen.add(r.order_id);
          pendingCount++;
        }
      }
    }

    // ── Latest stage_history per order ─────────────────────────────────────────
    const orderIds = orders.map((o) => o.id);
    let latestResults: unknown[] = [];
    if (orderIds.length > 0) {
      const { data: results } = await admin
        .from("stage_history")
        .select(
          "order_id, stage, created_at, users!stage_history_changed_by_fkey(full_name)",
        )
        .in("order_id", orderIds)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      latestResults = results || [];
    }

    type LatestRec = { order_id: string; stage: string; finished_at: string; users?: { full_name: string | null } | null };
    const latestByOrder = new Map<string, LatestRec>();
    for (const r of latestResults as Array<{ order_id: string; stage: string; created_at: string; users?: { full_name: string | null } | null }>) {
      if (!latestByOrder.has(r.order_id)) {
        latestByOrder.set(r.order_id, {
          order_id: r.order_id,
          stage: r.stage,
          finished_at: r.created_at,
          users: Array.isArray(r.users) ? r.users[0] : r.users,
        });
      }
    }

    // ── Enrich orders ──────────────────────────────────────────────────────────
    const enrichedOrders = orders.map((o) => {
      const latest = latestByOrder.get(o.id);

      let group: string;
      if (STAGE_GROUP[o.current_stage] === "production") group = "production";
      else if (STAGE_GROUP[o.current_stage] === "operational") group = "operational";
      else if ((APPROVAL_STAGES as string[]).includes(o.current_stage)) {
        const prodStage = APPROVAL_TO_PRODUCTION_STAGE[o.current_stage];
        group =
          prodStage && STAGE_GROUP[prodStage] === "production"
            ? "production"
            : "operational";
      } else group = "other";

      const arrivedAt = latest?.finished_at || o.updated_at || o.created_at;
      const hoursAtStage = arrivedAt
        ? Math.floor(
            (now.getTime() - new Date(arrivedAt).getTime()) / 3_600_000,
          )
        : null;

      return {
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name,
        current_stage: o.current_stage,
        stage_label: STAGE_LABELS[o.current_stage] || o.current_stage,
        stage_group: group,
        status: o.status,
        deadline: o.deadline,
        last_worker: latest?.users?.full_name || null,
        last_submission_at: latest?.finished_at || null,
        hours_at_stage: hoursAtStage,
        last_stage: latest ? STAGE_LABELS[latest.stage] || latest.stage : null,
      };
    });

    // Scope the order list to the supervisor's group
    let scopedOrders = enrichedOrders;
    if (svRoleName === "production_supervisor") {
      scopedOrders = enrichedOrders.filter(
        (o) => o.stage_group === "production",
      );
    } else if (svRoleName === "operational_supervisor") {
      scopedOrders = enrichedOrders.filter(
        (o) => o.stage_group === "operational",
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        supervisor: {
          role: svRoleName,
          role_group: svRoleGroup,
          approval_stages: [...supervisorApprovalStages],
        },
        stats: {
          totalActive: scopedOrders.length,
          productionCount: scopedOrders.filter(
            (o) => o.stage_group === "production",
          ).length,
          operationalCount: scopedOrders.filter(
            (o) => o.stage_group === "operational",
          ).length,
          approvalCount: scopedOrders.filter((o) =>
            supervisorApprovalStages.has(o.current_stage),
          ).length,
          submissionsToday,
          ordersCreatedToday,
          ordersCompletedToday,
          pendingApprovals: pendingCount,
        },
        orders: scopedOrders,
        completedOrders,
        completedCount,
      },
    });
  } catch (error) {
    console.error("[GET /api/supervisor] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
