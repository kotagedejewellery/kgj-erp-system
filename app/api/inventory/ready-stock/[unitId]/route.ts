import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { parsePositiveGrams } from "@/lib/inventory/grams";

export async function PATCH(request: Request, { params }: { params: Promise<{ unitId: string }> }) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const { unitId } = await params;
  const body = await request.json();
  const brandId = Number(body.brand_id);
  const productId = Number(body.source_product_id);
  const materialId = Number(body.source_material_id);
  const weight = parsePositiveGrams(body.actual_weight_grams);
  const condition = typeof body.condition === "string" ? body.condition.trim() : "";
  if (typeof body.unit_code !== "string" || !body.unit_code.trim() || typeof body.location_id !== "string" || typeof body.size !== "string" || !body.size.trim() || typeof body.material_description !== "string" || !body.material_description.trim() || !Number.isInteger(brandId) || brandId <= 0 || !Number.isInteger(productId) || productId <= 0 || !Number.isInteger(materialId) || materialId <= 0 || weight === null || !condition) {
    return NextResponse.json({ error: "Data unit ready-stock tidak valid" }, { status: 400 });
  }
  const { error } = await auth.admin.rpc("inventory_update_ready_stock_unit", {
    p_unit_id: unitId,
    p_unit_code: body.unit_code,
    p_brand_id: brandId,
    p_source_product_id: productId,
    p_source_material_id: materialId,
    p_location_id: body.location_id,
    p_size: body.size,
    p_material_description: body.material_description,
    p_actual_weight_grams: weight,
    p_condition: condition,
    p_actor_id: auth.actorId,
  });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Kode unit sudah digunakan" : error.message }, { status: 409 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ unitId: string }> }) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const { unitId } = await params;
  const { error } = await auth.admin.rpc("inventory_retire_ready_stock_unit", { p_unit_id: unitId, p_actor_id: auth.actorId });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ success: true });
}
