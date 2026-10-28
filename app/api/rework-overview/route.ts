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

    const { data: profile } = await admin
      .from("users")
      .select("role:roles!users_role_id_fkey(name)")
      .eq("id", user.id)
      .is("deleted_at", null)
      .single();

    const roleName: string = getRoleProps(profile).name;
    const roleGroup: string = getRoleProps(profile).role_group;
    const isSupervisor = roleName === "production_supervisor" || roleName === "operational_supervisor" || roleGroup === "management";
    if (roleName !== "superadmin" && !isSupervisor)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = request?.url ? new URL(request.url) : null;
    const fromParam = url?.searchParams.get("from");
    const toParam = url?.searchParams.get("to");

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fromISO = fromParam
      ? new Date(fromParam).toISOString()
      : thirtyDaysAgo.toISOString();
    const toISO = toParam
      ? new Date(toParam + "T23:59:59").toISOString()
      : now.toISOString();

    const [reworkData, totalOrdersResult] = await Promise.allSettled([
      admin
        .from("legacy_rework_logs")
        .select(
          "id, order_id, from_stage, to_stage, reason, severity, logged_by, logged_at",
          { count: "exact" },
        )
        .gte("logged_at", fromISO)
        .lte("logged_at", toISO)
        .order("logged_at", { ascending: false }),

      admin
        .from("legacy_orders")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", fromISO)
        .lte("created_at", toISO),
    ]);

    const reworkRows =
      reworkData.status === "fulfilled" ? reworkData.value.data ?? [] : [];
    const reworkCount =
      reworkData.status === "fulfilled" ? reworkData.value.count ?? 0 : 0;
    const totalOrders =
      totalOrdersResult.status === "fulfilled"
        ? totalOrdersResult.value.count ?? 0
        : 0;

    const stageBreakdown: Record<string, number> = {};
    const severityBreakdown: Record<string, number> = {};
    for (const r of reworkRows) {
      const key = `${r.from_stage} → ${r.to_stage}`;
      stageBreakdown[key] = (stageBreakdown[key] ?? 0) + 1;
      const sev = r.severity ?? "unknown";
      severityBreakdown[sev] = (severityBreakdown[sev] ?? 0) + 1;
    }

    const topStageRework = Object.entries(stageBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ flow: key, count }));

    const recentRework = reworkRows.slice(0, 5).map((r) => ({
      order_id: r.order_id,
      from_stage: r.from_stage,
      to_stage: r.to_stage,
      reason: r.reason,
      severity: r.severity,
      logged_at: r.logged_at,
    }));

    return NextResponse.json({
      data: {
        reworkCount,
        totalOrders,
        reworkRate:
          totalOrders > 0
            ? Number(((reworkCount / totalOrders) * 100).toFixed(1))
            : 0,
        majorCount: severityBreakdown.major ?? 0,
        minorCount: severityBreakdown.minor ?? 0,
        topStageRework,
        recentRework,
      },
    });
  } catch (err) {
    console.error("[GET /api/rework-overview]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
