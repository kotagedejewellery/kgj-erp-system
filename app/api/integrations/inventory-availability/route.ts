import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadInventoryAvailability } from "@/lib/inventory/availability-data";

export async function GET(request: NextRequest) {
  const key = process.env.YII_INVENTORY_READ_KEY;
  if (!key || request.headers.get("X-Inventory-Read-Key") !== key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const legacyOrderId = request.nextUrl.searchParams.get("legacy_order_id");
  try {
    const admin = createAdminClient();
    let orderId: string | undefined;
    if (legacyOrderId) {
      const legacyId = Number(legacyOrderId);
      if (!Number.isInteger(legacyId) || legacyId <= 0) {
        return NextResponse.json({ error: "legacy_order_id tidak valid" }, { status: 400 });
      }
      const { data: order, error } = await admin.from("legacy_orders").select("id").eq("legacy_id", legacyId).maybeSingle();
      if (error) throw new Error("Gagal membaca referensi order Yii2");
      if (!order) return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
      orderId = order.id;
    }
    return NextResponse.json(await loadInventoryAvailability(admin, orderId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat ketersediaan stok";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
