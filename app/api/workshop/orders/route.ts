// app/api/workshop/orders/route.ts
// Returns a page of legacy Yii2 orders (legacy_orders + tracking_stages) at the
// authenticated worker's allowed stage(s).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRoleProps } from "@/lib/auth/session";


import { createAdminClient } from "@/lib/supabase/admin";
import {
  legacyToOrderSummary,
  type LegacyOrderRow,
  type TrackingStageRow,
} from "@/lib/legacy/adapter";

export async function GET(request: Request) {
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
        "id, role:roles!users_role_id_fkey(name, role_group, allowed_stages)",
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
    const dbAllowedStages: string[] = getRoleProps(userData).allowed_stages;

    // Resolve which stages this worker can process
    let workerStages: string[];
    if (roleName === "superadmin") {
      workerStages = [];
    } else if (dbAllowedStages.length > 0) {
      workerStages = dbAllowedStages;
    } else if (["production", "operational", "management"].includes(roleGroup)) {
      workerStages = [];
    } else {
      return NextResponse.json(
        { error: "Role tidak memiliki akses ke tahap manapun" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q")?.trim() ?? "";
    const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const requestedOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 50;
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(requestedOffset, 0)
      : 0;

    let matchingOrderIds: string[] | null = null;
    if (search) {
      const { data: matchingOrders, error: matchingOrdersError } = await admin
        .from("legacy_orders")
        .select("id")
        .or(`kode_order.ilike.%${search}%,nama.ilike.%${search}%`);

      if (matchingOrdersError) {
        console.error(
          "[GET /api/workshop/orders] search query error:",
          matchingOrdersError,
        );
        return NextResponse.json(
          { error: "Gagal mengambil data order" },
          { status: 500 },
        );
      }

      matchingOrderIds = (matchingOrders ?? []).map((order) => order.id);
      if (matchingOrderIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
          next_offset: null,
        });
      }
    }

    // Legacy orders live in legacy_orders; their current stage lives in
    // tracking_stages. Join in-app: filter tracking rows by stage, then hydrate.
    // Active = current_stage not yet 'selesai' (stage_status alone is unreliable:
    // sync seeds it as 'completed' for the current stage).
    let trackingQuery = admin
      .from("tracking_stages")
      .select(
        "id, order_id, current_stage, stage_status, assigned_to, updated_at, updated_by",
        { count: "exact" },
      )
      .neq("current_stage", "selesai")
      .order("updated_at", { ascending: false });

    if (workerStages.length > 0) {
      trackingQuery = trackingQuery.in("current_stage", workerStages);
    }

    if (matchingOrderIds) {
      trackingQuery = trackingQuery.in("order_id", matchingOrderIds);
    }

    const {
      data: trackingRows,
      error: trackingError,
      count: total,
    } = await trackingQuery.range(offset, offset + limit - 1);

    if (trackingError) {
      console.error("[GET /api/workshop/orders] tracking query error:", trackingError);
      return NextResponse.json(
        { error: "Gagal mengambil data order" },
        { status: 500 },
      );
    }

    const orderIds = (trackingRows ?? []).map((t) => t.order_id);

    let orders: LegacyOrderRow[] = [];
    if (orderIds.length > 0) {
      const orderQuery = admin
        .from("legacy_orders")
        .select("*")
        .in("id", orderIds);

      const { data: orderRows, error } = await orderQuery;
      if (error) {
        console.error("[GET /api/workshop/orders] legacy_orders query error:", error);
        return NextResponse.json(
          { error: "Gagal mengambil data order" },
          { status: 500 },
        );
      }
      orders = (orderRows ?? []) as LegacyOrderRow[];
    }

    const trackingById = new Map<string, TrackingStageRow>(
      (trackingRows ?? []).map((t) => [t.order_id, t as TrackingStageRow]),
    );

    // Preserve tracking's updated_at ordering
    const orderById = new Map<string, LegacyOrderRow>(orders.map((o) => [o.id, o]));
    const result = (trackingRows ?? [])
      .map((t) => {
        const order = orderById.get(t.order_id);
        if (!order) return null;
        return legacyToOrderSummary(order, trackingById.get(t.order_id));
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);

    return NextResponse.json({
      success: true,
      data: result,
      total: total ?? 0,
      next_offset:
        offset + (trackingRows?.length ?? 0) < (total ?? 0)
          ? offset + (trackingRows?.length ?? 0)
          : null,
    });
  } catch (err) {
    console.error("[GET /api/workshop/orders] Error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
