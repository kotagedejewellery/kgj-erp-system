import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { parseReadyStockWeight } from "@/lib/inventory/ready-stock-weight";
import { parseStoredReadyStockGender } from "@/lib/inventory/ready-stock-gender";

export async function PATCH(request: Request, { params }: { params: Promise<{ unitId: string }> }) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const { unitId } = await params;
  const body = await request.json();
  const brandId = Number(body.brand_id);
  const productId = Number(body.source_product_id);
  const materialId = Number(body.source_material_id);
  const condition = typeof body.condition === "string" ? body.condition.trim() : "";
  const ringGender = parseStoredReadyStockGender(body.ring_gender);
  if (typeof body.unit_code !== "string" || !body.unit_code.trim() || typeof body.location_id !== "string" || typeof body.size !== "string" || !body.size.trim() || typeof body.material_description !== "string" || !body.material_description.trim() || !Number.isInteger(brandId) || brandId <= 0 || !Number.isInteger(productId) || productId <= 0 || !Number.isInteger(materialId) || materialId <= 0 || !condition || !ringGender) {
    return NextResponse.json({ error: "Data unit ready-stock tidak valid" }, { status: 400 });
  }
  const { data: material } = await auth.admin.from("inventory_materials").select("requires_unit_weight").eq("source_material_id", materialId).eq("is_active", true).maybeSingle();
  if (!material) return NextResponse.json({ error: "Bahan ready-stock tidak tersedia" }, { status: 409 });
  const weight = parseReadyStockWeight(body.actual_weight_grams, material.requires_unit_weight);
  if ("error" in weight) return NextResponse.json({ error: weight.error }, { status: 400 });
  const { error } = await auth.admin.rpc("inventory_update_ready_stock_unit", {
    p_unit_id: unitId,
    p_unit_code: body.unit_code,
    p_brand_id: brandId,
    p_source_product_id: productId,
    p_source_material_id: materialId,
    p_location_id: body.location_id,
    p_size: body.size,
    p_material_description: body.material_description,
    p_actual_weight_grams: weight.value,
    p_condition: condition,
    p_ring_gender: ringGender,
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
