import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { parseReadyStockQuantityChange } from "@/lib/inventory/ready-stock-quantity";
import { BRANDS } from "@/lib/legacy/brands";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const brandId = Number(body.brand_id);
  const productId = Number(body.source_product_id);
  const materialId = Number(body.source_material_id);
  const quantityChange = parseReadyStockQuantityChange(body.quantity_change);
  const locationId = text(body.location_id);
  const size = text(body.size);
  const condition = text(body.condition);
  const reason = text(body.reason);
  if (!BRANDS[brandId] || !Number.isInteger(productId) || productId <= 0 || !Number.isInteger(materialId) || materialId <= 0 || quantityChange === null || !locationId || !size || !condition || !reason) {
    return NextResponse.json({ error: "Data perubahan jumlah stok tidak valid" }, { status: 400 });
  }

  const { data: changed, error } = await auth.admin.rpc("inventory_adjust_ready_stock_quantity", {
    p_brand_id: brandId,
    p_source_product_id: productId,
    p_source_material_id: materialId,
    p_location_id: locationId,
    p_size: size,
    p_condition: condition,
    p_quantity_change: quantityChange,
    p_reason: reason,
    p_actor_id: auth.actorId,
  });
  if (error) {
    const message = error.message.includes("quantity_insufficient")
      ? "Jumlah stok tersedia tidak mencukupi"
      : error.message.includes("quantity_weight_required")
        ? "Bahan yang wajib ditimbang harus dikelola per unit"
        : error.message.includes("catalog_product_missing")
          ? "Model katalog tidak lagi aktif. Stok lama tetap dapat dikurangi atau dikelola per unit."
        : "Gagal mengubah jumlah stok";
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return NextResponse.json({ data: { changed } });
}
