// app/api/orders/history/route.ts — unified order history list

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";
import { STAGE_LABELS } from "@/lib/stages";
import { mapLegacyStatus } from "@/lib/legacy/adapter";
import { getBrandPrefix } from "@/lib/legacy/brands";
import { PERSONAL_HISTORY_ACTIONS } from "@/lib/supervisor/history";

async function verifyAccess(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, role:roles!users_role_id_fkey(name, role_group, allowed_stages)")
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
  return { data, roleName, roleGroup, allowedStages };
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

    const access = await verifyAccess(authUser.id);
    if (!access)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "all";
    const stage = searchParams.get("stage") ?? "";
    const brand = searchParams.get("brand") ?? "all";
    const q = searchParams.get("q") ?? "";
    const scope = searchParams.get("scope") ?? "all";
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
    const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
    if (scope !== "all" && scope !== "mine") {
      return NextResponse.json({ error: "Scope riwayat tidak valid" }, { status: 400 });
    }

    const admin = createAdminClient();
    let handledOrderIds: string[] | null = null;

    if (scope === "mine") {
      const { data: activities, error: activitiesError } = await admin
        .from("activity_logs")
        .select("entity_id")
        .eq("user_id", authUser.id)
        .in("action", [...PERSONAL_HISTORY_ACTIONS])
        .order("created_at", { ascending: false })
        .limit(1000);
      if (activitiesError) {
        console.error("[GET /api/orders/history] activities error:", activitiesError.message);
        return NextResponse.json({ error: "Gagal mengambil riwayat supervisor" }, { status: 500 });
      }

      handledOrderIds = [...new Set((activities ?? []).map((activity) => activity.entity_id))];
      if (handledOrderIds.length === 0) {
        return NextResponse.json({ success: true, data: { orders: [], total: 0 } });
      }
    }

    let query = admin
      .from("tracking_stages")
      .select(
        `order_id, current_stage, stage_status, updated_at,
         legacy_orders!tracking_stages_order_id_fkey(id, kode_order, nama, tgl_order, tgl_selesai)`,
        { count: "exact" },
      );

    if (handledOrderIds) query = query.in("order_id", handledOrderIds);

    if (status === "active") query = query.neq("current_stage", "selesai");
    else if (status === "completed") query = query.eq("current_stage", "selesai");

    if (stage) query = query.eq("current_stage", stage);

    query = query.order("updated_at", { ascending: false });

    const { data: rows, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("[GET /api/orders/history] error:", error.message);
      return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
    }

    type LegacyEmbed = {
      id: string; kode_order: string; nama: string | null;
      tgl_order: string | null; tgl_selesai: string | null;
    };
    type TrackRow = {
      order_id: string; current_stage: string; stage_status: string; updated_at: string | null;
      legacy_orders?: LegacyEmbed | LegacyEmbed[] | null;
    };

    const orders = (rows as TrackRow[] ?? [])
      .map((t) => {
        const lo = Array.isArray(t.legacy_orders) ? t.legacy_orders[0] : t.legacy_orders;
        const orderNumber = lo?.kode_order ?? "—";
        return {
          id: t.order_id,
          order_number: orderNumber,
          customer_name: lo?.nama ?? null,
          current_stage: t.current_stage,
          stage_label: STAGE_LABELS[t.current_stage] ?? t.current_stage,
          status: mapLegacyStatus(t.stage_status, t.current_stage),
          brand: getBrandPrefix(orderNumber) ?? "—",
          deadline: lo?.tgl_selesai ?? null,
          tgl_order: lo?.tgl_order ?? null,
          updated_at: t.updated_at,
          completed_at: t.current_stage === "selesai" ? t.updated_at : null,
        };
      })
      .filter((o) => {
        const matchBrand = brand === "all" || o.brand === brand;
        const matchQ =
          !q ||
          o.order_number.toLowerCase().includes(q.toLowerCase()) ||
          (o.customer_name ?? "").toLowerCase().includes(q.toLowerCase());
        return matchBrand && matchQ;
      });

    return NextResponse.json({
      success: true,
      data: { orders, total: count ?? 0 },
    });
  } catch (err) {
    console.error("[GET /api/orders/history] Error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
