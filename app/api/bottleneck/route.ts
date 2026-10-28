// app/api/bottleneck/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAGE_SEQUENCE, STAGE_GROUP, STAGE_LABELS } from "@/lib/stages";
import { getRoleProps } from "@/lib/auth/session";
import { mapLegacyStatus } from "@/lib/legacy/adapter";

const ACTIVE_STAGES = STAGE_SEQUENCE.filter(s => s !== "selesai") as readonly string[];

interface StageBottleneck {
  stage: string;
  stage_label: string;
  stage_group: string;
  order_count: number;
  waiting_orders: number;
  in_progress_orders: number;
  avg_hours: number | null;
  longest_hours: number | null;
  orders: {
    order_number: string;
    customer_name: string;
    hours_waiting: number | null;
    status: string;
  }[];
}

function toStageSummary({ orders: _orders, ...stage }: StageBottleneck) {
  return stage;
}

export async function GET(request?: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await admin
      .from("users")
      .select("role:roles!users_role_id_fkey(name, role_group, allowed_stages)")
      .eq("id", user.id)
      .is("deleted_at", null)
      .single();

    const roleName: string = getRoleProps(profile).name;
    const roleGroup: string = getRoleProps(profile).role_group;
    const allowedStages: string[] = getRoleProps(profile).allowed_stages;

    const canAccess =
      roleName === "superadmin" ||
      roleGroup === "management" ||
      allowedStages.some((s) => s.startsWith("approval_"));

    if (!canAccess)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = request?.url ? new URL(request.url) : null;
    const fromParam = url?.searchParams.get("from");
    const toParam = url?.searchParams.get("to");

    const now = new Date();

    const query = admin
      .from("tracking_stages")
      .select("order_id, current_stage, stage_status, updated_at, legacy_orders!tracking_stages_order_id_fkey(kode_order, nama, tgl_selesai, created_at, proses_produksi, proses_produksi_label)")
      .neq("current_stage", "selesai")
      .in("current_stage", ACTIVE_STAGES as unknown as string[]);

    const { data: trackingRows, error: ordersError } = await query.order("updated_at", { ascending: true });

    if (ordersError)
      return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });

    type LegacyEmbed = { kode_order: string; nama: string | null; tgl_selesai: string | null; created_at: string | null; proses_produksi: string | null; proses_produksi_label: string | null };
    type TrackRow = {
      order_id: string;
      current_stage: string;
      stage_status: string;
      updated_at: string | null;
      legacy_orders?: LegacyEmbed | LegacyEmbed[] | null;
    };

    // Apply optional created_at date filter (from legacy_orders.created_at)
    const fromMs = fromParam ? new Date(fromParam).getTime() : null;
    const toMs = toParam ? new Date(toParam + "T23:59:59").getTime() : null;

    const orders = ((trackingRows ?? []) as TrackRow[])
      .map((t) => {
        const lo = Array.isArray(t.legacy_orders) ? t.legacy_orders[0] : t.legacy_orders;
        return {
          id: t.order_id,
          order_number: lo?.kode_order ?? "—",
          customer_name: lo?.nama ?? null,
          current_stage: t.current_stage,
          status: mapLegacyStatus(t.stage_status, t.current_stage),
          updated_at: t.updated_at ?? "",
          deadline: lo?.tgl_selesai ?? null,
          created_at: lo?.created_at ?? null,
          proses_produksi: lo?.proses_produksi ?? null,
          proses_produksi_label: lo?.proses_produksi_label ?? null,
        };
      })
      .filter((o) => {
        if (!fromMs && !toMs) return true;
        const c = o.created_at ? new Date(o.created_at).getTime() : null;
        if (c === null) return true;
        if (fromMs && c < fromMs) return false;
        if (toMs && c > toMs) return false;
        return true;
      });

    const orderIds = orders.map((o) => o.id);
    let latestResults: unknown[] = [];
    const approvalsData: unknown[] = [];
    if (orderIds.length > 0) {
      const { data: results } = await admin
        .from("stage_history")
        .select(`order_id, stage, created_at,
          users!stage_history_changed_by_fkey ( full_name )`)
        .in("order_id", orderIds)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      latestResults = (results || []).map((r) => ({
        order_id: r.order_id,
        finished_at: r.created_at,
        users: Array.isArray(r.users) ? r.users[0] : r.users,
      }));
      // approvals table has no legacy equivalent — left empty.
    }

    type StageResultRec = { order_id: string; finished_at: string; users?: { full_name: string | null } | null };
    const latestByOrder = new Map<string, StageResultRec>();
    for (const r of latestResults as StageResultRec[]) {
      if (!latestByOrder.has(r.order_id)) {
        latestByOrder.set(r.order_id, r);
      }
    }

    type ApprovalRec = { order_id: string; decision: string | null; decided_at: string | null; users?: { full_name: string | null } | null };
    const approvalByOrder = new Map<string, ApprovalRec>();
    for (const a of approvalsData as ApprovalRec[]) {
      if (!approvalByOrder.has(a.order_id)) {
        approvalByOrder.set(a.order_id, a);
      }
    }

    // Group by stage
    type OrderRec = { id: string; current_stage: string; status: string; order_number: string; customer_name: string | null; updated_at: string; deadline: string | null; proses_produksi: string | null; proses_produksi_label: string | null };
    const stageMap = new Map<string, OrderRec[]>();
    for (const order of orders || []) {
      const stage = order.current_stage;
      if (!stageMap.has(stage)) stageMap.set(stage, []);
      stageMap.get(stage)!.push(order);
    }

    const bottlenecks: StageBottleneck[] = ACTIVE_STAGES.map((stage) => {
      const stageOrders = stageMap.get(stage) || [];
      const waitingOrders = stageOrders.filter(
        (o) => o.status === "waiting_approval",
      );
      const inProgressOrders = stageOrders.filter(
        (o) => o.status !== "waiting_approval",
      );

      const ordersWithHours = stageOrders.map((o) => {
        // Approval/waiting orders: arrival = when tracking pointer was set (updated_at)
        // In-progress orders: arrival = when last worker submitted (stage_history)
        const useTrackingArrival = o.status === "waiting_approval";
        const latest = useTrackingArrival ? null : latestByOrder.get(o.id);
        const arrivedAt = latest?.finished_at || o.updated_at;
        const hours = (now.getTime() - new Date(arrivedAt).getTime()) / 3_600_000;
        const approval = approvalByOrder.get(o.id);
        return {
          order_id: o.id,
          order_number: o.order_number,
          customer_name: o.customer_name ?? "—",
          hours_waiting: Math.round(hours * 10) / 10,
          status: o.status,
          current_stage: o.current_stage,
          deadline: o.deadline ?? null,
          proses_produksi: o.proses_produksi ?? null,
          proses_produksi_label: o.proses_produksi_label ?? null,
          last_worker: latest?.users?.full_name ?? null,
          last_submission: latest?.finished_at ?? null,
          approval_decision: approval?.decision ?? null,
          approved_by: approval?.users?.full_name ?? null,
          approved_at: approval?.decided_at ?? null,
        };
      });

      const hoursValues = ordersWithHours
        .map((o) => o.hours_waiting)
        .filter((h: number) => h > 0);
      const avgHours =
        hoursValues.length > 0
          ? hoursValues.reduce((a: number, b: number) => a + b, 0) / hoursValues.length
          : null;
      const longestHours = hoursValues.length > 0 ? Math.max(...hoursValues) : null;

      const sortedOrders = [...ordersWithHours].sort((a, b) => b.hours_waiting - a.hours_waiting);
      return {
        stage,
        stage_label: STAGE_LABELS[stage] || stage,
        stage_group: STAGE_GROUP[stage] || "operational",
        order_count: stageOrders.length,
        waiting_orders: waitingOrders.length,
        in_progress_orders: inProgressOrders.length,
        avg_hours: avgHours ? Math.round(avgHours * 10) / 10 : null,
        longest_hours: longestHours ? Math.round(longestHours * 10) / 10 : null,
        orders: sortedOrders,
      };
    }).filter((b) => b.order_count > 0);

    return NextResponse.json({
      success: true,
      data: {
        bottlenecks,
        summary: {
          total_stages_with_orders: bottlenecks.length,
          total_orders: (orders || []).length,
          busiest_stage:
            bottlenecks.length > 0
              ? toStageSummary(bottlenecks.reduce((a, b) => (a.order_count > b.order_count ? a : b)))
              : null,
          slowest_stage:
            bottlenecks.filter((b) => b.avg_hours).length > 0
              ? toStageSummary(bottlenecks
                  .filter((b) => b.avg_hours)
                  .reduce((a, b) => ((a.avg_hours || 0) > (b.avg_hours || 0) ? a : b)))
              : null,
        },
      },
    });
  } catch (error) {
    console.error("[GET /api/bottleneck] Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
