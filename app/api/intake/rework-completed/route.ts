import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLegacyOrder } from "@/lib/legacy/ingest";
import { type Yii2OrderPayload } from "@/lib/legacy/adapter";

const WEBHOOK_SECRET = process.env.INTEGRATED_SYSTEM_WEBHOOK_SECRET;

export async function POST(request: Request) {
  try {
    if (!WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Webhook belum dikonfigurasi" }, { status: 500 });
    }
    if (request.headers.get("x-webhook-signature") !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = await request.json();
    const requestId = typeof payload?.request_id === "string" ? payload.request_id : "";
    const order = payload?.order as Yii2OrderPayload | undefined;
    if (payload?.event !== "spv_cs_rework_completed" || !requestId || !order?.id || !order?.kode_order) {
      return NextResponse.json({ error: "Payload rework tidak valid" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: intake, error: intakeError } = await admin
      .from("legacy_order_intakes")
      .select("id, legacy_order_id, state, rework_request_id")
      .eq("rework_request_id", requestId)
      .maybeSingle();
    if (intakeError) throw intakeError;
    if (!intake) return NextResponse.json({ error: "Permintaan rework tidak ditemukan" }, { status: 404 });

    const { data: localOrder, error: orderError } = await admin
      .from("legacy_orders")
      .select("legacy_id, kode_order")
      .eq("id", intake.legacy_order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!localOrder || localOrder.legacy_id !== order.id || localOrder.kode_order !== order.kode_order) {
      return NextResponse.json({ error: "Order rework tidak cocok" }, { status: 409 });
    }
    if (intake.state === "pending_spv_cs_validation") {
      return NextResponse.json({ received: true, status: "already_completed" });
    }
    if (intake.state !== "returned_for_revision") {
      return NextResponse.json({ error: "Rework tidak dapat dibuka kembali" }, { status: 409 });
    }

    await ingestLegacyOrder(admin, order);
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("legacy_order_intakes")
      .update({
        state: "pending_spv_cs_validation",
        rework_completed_at: now,
        updated_at: now,
      })
      .eq("id", intake.id)
      .eq("rework_request_id", requestId);
    if (updateError) throw updateError;

    return NextResponse.json({ received: true, status: "pending_spv_cs_validation" });
  } catch (error) {
    console.error("[POST /api/intake/rework-completed]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
