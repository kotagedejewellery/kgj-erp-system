// app/api/supervisor/approval-history/route.ts — supervisor's own approve/reject history

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";
import { STAGE_LABELS } from "@/lib/stages";
import { getBrandFilterCode, getBrandPrefix } from "@/lib/legacy/brands";
import { getPersonalApprovalAction, PERSONAL_HISTORY_ACTIONS } from "@/lib/supervisor/history";

async function verifySupervisor(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, full_name, role:roles!users_role_id_fkey(name, role_group, allowed_stages)")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;
  const roleName: string = getRoleProps(data).name;
  const roleGroup: string = getRoleProps(data).role_group;
  const allowedStages: string[] = getRoleProps(data).allowed_stages;

  const isSupervisor =
    roleName === "superadmin" ||
    roleGroup === "management" ||
    allowedStages.some((s) => s.startsWith("approval_"));

  if (!isSupervisor) return null;
  return data;
}

export async function GET(request: Request) {
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

    const supervisorName: string = (supervisor as { full_name?: string })?.full_name ?? "";

    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("brand") ?? "all";
    const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const requestedOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
    const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

    const admin = createAdminClient();

    const { data: history, error, count: total } = await admin
      .from("activity_logs")
      .select("entity_id, action, new_data, created_at", { count: "exact" })
      .eq("user_id", authUser.id)
      .in("action", [...PERSONAL_HISTORY_ACTIONS])
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[approval-history] query error:", error.message);
      return NextResponse.json({ error: "Gagal mengambil riwayat persetujuan" }, { status: 500 });
    }

    type ActivityRow = {
      entity_id: string;
      action: string;
      new_data: Record<string, unknown> | null;
      created_at: string;
    };
    const decisions = (history as ActivityRow[] ?? [])
      .map((history) => {
        const data = history.new_data ?? {};
        const action = getPersonalApprovalAction(history.action, data);
        if (!action) return null;
        const isIntake = history.action === "INTAKE_VALIDATION";
        const stage = isIntake
          ? "intake_validation"
          : typeof data.stage === "string" ? data.stage : "";
        return {
          id: `${history.action}-${history.entity_id}-${history.created_at}`,
          order_id: history.entity_id,
          stage,
          stage_label: isIntake
            ? "Validasi SPV CS"
            : STAGE_LABELS[stage] ?? "Persetujuan Supervisor",
          action,
          remarks: isIntake
            ? typeof data.reason === "string" ? data.reason : null
            : typeof data.remarks === "string" ? data.remarks : null,
          decided_by: supervisorName || null,
          decided_at: history.created_at,
        };
      })
      .filter((decision): decision is NonNullable<typeof decision> => decision !== null);

    const orderIds = [...new Set(decisions.map((decision) => decision.order_id))];
    const { data: orders, error: ordersError } = orderIds.length > 0
      ? await admin
        .from("legacy_orders")
        .select("id, kode_order, nama")
        .in("id", orderIds)
      : { data: [], error: null };
    if (ordersError) {
      console.error("[approval-history] orders query error:", ordersError.message);
      return NextResponse.json({ error: "Gagal mengambil data order" }, { status: 500 });
    }

    const ordersById = new Map((orders ?? []).map((order) => [order.id, order]));
    const items = decisions
      .map((decision) => {
        const order = ordersById.get(decision.order_id);
        const orderNumber = order?.kode_order ?? "—";
        return {
          ...decision,
          order_number: orderNumber,
          customer_name: order?.nama ?? null,
          brand: getBrandPrefix(orderNumber) ?? "—",
        };
      })
      .filter((item) => brand === "all" || getBrandFilterCode(item.order_number) === brand)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        items,
        next_offset: history && offset + history.length < (total ?? 0)
          ? offset + history.length
          : null,
      },
      total: items.length,
    });
  } catch (err) {
    console.error("[approval-history] Error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
