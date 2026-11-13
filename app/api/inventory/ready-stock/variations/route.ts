import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { isStandardReadyStockCondition } from "@/lib/inventory/ready-stock-condition";
import { parseReadyStockGender } from "@/lib/inventory/ready-stock-gender";
import { parseReadyStockVariationRows } from "@/lib/inventory/ready-stock-variations";
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
  const locationId = text(body.location_id);
  const condition = text(body.condition);
  const ringGender = parseReadyStockGender(body.ring_gender);
  const reason = text(body.reason);
  const variations = parseReadyStockVariationRows(body.variations);
  if (!BRANDS[brandId] || !Number.isInteger(productId) || productId <= 0 || !Number.isInteger(materialId) || materialId <= 0 || !locationId || !isStandardReadyStockCondition(condition) || !ringGender || !reason || !variations) {
    return NextResponse.json({ error: "Data variasi stok tidak valid" }, { status: 400 });
  }

  const { data: changed, error } = await auth.admin.rpc("inventory_add_ready_stock_variations", {
    p_brand_id: brandId,
    p_source_product_id: productId,
    p_source_material_id: materialId,
    p_location_id: locationId,
    p_condition: condition,
    p_ring_gender: ringGender,
    p_variations: variations,
    p_reason: reason,
    p_actor_id: auth.actorId,
  });
  if (error) {
    const message = error.message.includes("quantity_weight_required")
      ? "Bahan yang wajib ditimbang harus dicatat per unit"
      : error.message.includes("catalog_product_missing")
        ? "Model katalog tidak lagi aktif"
        : "Gagal mencatat variasi stok";
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return NextResponse.json({ data: { changed } }, { status: 201 });
}
