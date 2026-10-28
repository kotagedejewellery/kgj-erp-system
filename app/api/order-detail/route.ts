// app/api/supervisor/order-detail/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAGE_SEQUENCE } from "@/lib/stages";
import {
  legacyToOrderDetail,
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

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");
    if (!orderId)
      return NextResponse.json({ error: "order_id wajib diisi" }, { status: 400 });

    // ── 1. legacy_order — the single source of truth ───────────────────────────
    const { data: legacyOrder, error: orderError } = await admin
      .from("legacy_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !legacyOrder)
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });

    // ── 2. Tracking pointer ────────────────────────────────────────────────────
    const { data: tracking } = await admin
      .from("tracking_stages")
      .select("id, order_id, current_stage, stage_status, assigned_to, updated_at, updated_by")
      .eq("order_id", orderId)
      .maybeSingle();

    // ── 2b. Deliveries (shipping) ──────────────────────────────────────────────
    const { data: deliveryRows } = await admin
      .from("legacy_deliveries")
      .select("id, delivery_method, status, courier_name, tracking_number, dispatched_at, delivered_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    // ── 3. Stage history → mapped into the transitions shape ───────────────────
    const { data: history, error: histErr } = await admin
      .from("stage_history")
      .select(`stage, status, note, created_at, data, attempt_number,
        users!stage_history_changed_by_fkey ( full_name )`)
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (histErr) console.error("[OrderDetail] stage_history error:", histErr);

    const prodToGate: Record<string, string> = {};
    STAGE_SEQUENCE.forEach((s, i) => {
      if (s.startsWith("approval_") && i > 0) {
        prodToGate[STAGE_SEQUENCE[i - 1]] = s;
      }
    });

    const approvals = (history ?? [])
      .filter((h) => {
        const d = (h as { data?: Record<string, unknown> }).data;
        return d && typeof d._sv_action === "string";
      })
      .map((h) => {
        const d = (h as { data?: Record<string, unknown> }).data!;
        const action = d._sv_action as string;
        const gate = prodToGate[h.stage] ?? h.stage;
        return {
          id: `${orderId}-approval-${h.stage}-${h.created_at}`,
          stage: action === "cancel" ? "selesai" : gate,
          decision: action === "approve" ? "approved" : "rejected",
          remarks: (d._sv_notes as string) ?? null,
          decided_at: (d._sv_at as string) ?? h.created_at,
          users: { full_name: (d._sv_by as string) ?? "Supervisor" },
        };
      });

    const transitions = (history ?? [])
      .filter((h) => (h as { status?: string }).status !== "rework")
      .map((h) => ({
        from_stage: null,
        to_stage: h.stage,
        reason: h.note ?? null,
        transitioned_at: h.created_at,
        users: (h as { users?: { full_name?: string } }).users ?? null,
      }));

    // Derived scan events (legacy has no QR-scan table): surface supervisor
    // rejections (status "rework") as proper "Tolak" scan events instead of the
    // misleading "Dimulai" transition they would otherwise become.
    const scanEvents = (history ?? [])
      .filter((h) => (h as { status?: string }).status === "rework")
      .map((h) => ({
        id: `${orderId}-scan-${h.stage}-${h.created_at}`,
        stage: h.stage,
        action: "reject",
        scanned_at: h.created_at,
        users: (h as { users?: { full_name?: string } }).users ?? null,
      }));

    const stageResults = (history ?? [])
      .filter((h) => {
        const d = (h as { data?: Record<string, unknown> }).data;
        return d && typeof d === "object" && Object.keys(d).length > 0;
      })
      .map((h, i) => ({
        id: `${orderId}-${i}`,
        stage: h.stage,
        attempt_number: (h as { attempt_number?: number }).attempt_number ?? 1,
        data: (h as { data?: unknown }).data ?? {},
        notes: h.note ?? null,
        started_at: h.created_at,
        finished_at: h.created_at,
        users: (h as { users?: { full_name?: string } }).users ?? null,
      }));

    return NextResponse.json({
      success: true,
      data: {
        order: legacyToOrderDetail(
          legacyOrder as LegacyOrderRow,
          tracking as TrackingStageRow | null,
        ),
        transitions,
        stageResults,
        deliveries: (deliveryRows ?? []).map((d) => ({
          id: (d as { id: string }).id,
          delivery_method: (d as { delivery_method?: string }).delivery_method ?? "Pengiriman",
          status: (d as { status?: string }).status ?? "pending",
          courier_name: (d as { courier_name?: string }).courier_name ?? null,
          tracking_number: (d as { tracking_number?: string }).tracking_number ?? null,
          dispatched_at: (d as { dispatched_at?: string }).dispatched_at ?? null,
          delivered_at: (d as { delivered_at?: string }).delivered_at ?? null,
        })),
        scanEvents,
        approvals,
      },
    });
  } catch (error) {
    console.error("[Order Detail] Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
