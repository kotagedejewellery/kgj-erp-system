import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { hasSourceMaterialId } from "@/lib/inventory/source-materials";
import { canRequireUnitWeight } from "@/lib/inventory/ready-stock-weight";

function parseMaterial(body: Record<string, unknown>) {
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const sourceMaterialId = body.source_material_id === "" || body.source_material_id === undefined ? null : Number(body.source_material_id);
  const wastePercent = body.waste_percent === "" || body.waste_percent === undefined ? 0 : Number(body.waste_percent);
  const requiresUnitWeight = body.requires_unit_weight === undefined ? true : body.requires_unit_weight === true || body.requires_unit_weight === "true" || body.requires_unit_weight === "on";
  if (!code || !name || (sourceMaterialId !== null && (!Number.isInteger(sourceMaterialId) || sourceMaterialId <= 0)) || !Number.isFinite(wastePercent) || wastePercent < 0) return null;
  return { code, name, sourceMaterialId, wastePercent, requiresUnitWeight };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const { materialId } = await params;
  const body = await request.json();
  const material = parseMaterial(body);
  if (!material) return NextResponse.json({ error: "Data material tidak valid" }, { status: 400 });

  const { data: current, error: currentError } = await auth.admin
    .from("inventory_materials").select("id, source_material_id, requires_unit_weight").eq("id", materialId).maybeSingle();
  if (currentError || !current) return NextResponse.json({ error: "Material tidak ditemukan" }, { status: 404 });

  if (material.sourceMaterialId !== current.source_material_id) {
    const [{ data: balances, error: balancesError }, { data: units, error: unitsError }] = await Promise.all([
      auth.admin.from("inventory_material_balances").select("material_id").eq("material_id", materialId).gt("quantity_grams", 0),
      current.source_material_id === null
        ? Promise.resolve({ data: [], error: null })
        : auth.admin.from("inventory_stock_units").select("id").eq("source_material_id", current.source_material_id).in("status", ["available", "inspection"]),
    ]);
    if (balancesError || unitsError) return NextResponse.json({ error: "Pemakaian material belum dapat diverifikasi" }, { status: 409 });
    if ((balances?.length ?? 0) > 0 || (units?.length ?? 0) > 0) {
      return NextResponse.json({ error: "Hubungan order tidak dapat diubah selama material masih memiliki stok atau unit aktif" }, { status: 409 });
    }
    if (material.sourceMaterialId !== null) {
      const { data: orders, error: ordersError } = await auth.admin.from("legacy_orders").select("komponen").is("deleted_at", null);
      if (ordersError || !hasSourceMaterialId(orders ?? [], material.sourceMaterialId)) {
        return NextResponse.json({ error: "Bahan pada order tidak ditemukan" }, { status: 400 });
      }
      const { data: mapping, error: mappingError } = await auth.admin
        .from("inventory_materials").select("id").eq("source_material_id", material.sourceMaterialId).neq("id", materialId).maybeSingle();
      if (mappingError) return NextResponse.json({ error: "Mapping bahan belum dapat diverifikasi" }, { status: 409 });
      if (mapping) return NextResponse.json({ error: "Bahan pada order sudah terhubung ke material lain" }, { status: 409 });
    }
  }

  if (material.requiresUnitWeight && !current.requires_unit_weight && current.source_material_id !== null) {
    const { data: unweighedUnits, error: unweighedUnitsError } = await auth.admin
      .from("inventory_stock_units")
      .select("id")
      .eq("source_material_id", current.source_material_id)
      .in("status", ["available", "inspection"])
      .is("actual_weight_grams", null);
    if (unweighedUnitsError) return NextResponse.json({ error: "Unit tanpa timbang belum dapat diverifikasi" }, { status: 409 });
    if (!canRequireUnitWeight(unweighedUnits?.length ?? 0)) {
      return NextResponse.json({ error: "Berat per cincin belum dapat diwajibkan karena masih ada unit aktif tanpa timbang" }, { status: 409 });
    }
  }

  const { error } = await auth.admin.from("inventory_materials").update({
    code: material.code,
    name: material.name,
    source_material_id: material.sourceMaterialId,
    waste_percent: material.wastePercent,
    requires_unit_weight: material.requiresUnitWeight,
    updated_at: new Date().toISOString(),
  }).eq("id", materialId);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Kode atau mapping bahan sudah digunakan" : "Gagal memperbarui material" }, { status: 409 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ materialId: string }> }) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const { materialId } = await params;
  const { data: material } = await auth.admin
    .from("inventory_materials").select("id, source_material_id").eq("id", materialId).maybeSingle();
  if (!material) return NextResponse.json({ error: "Material tidak ditemukan" }, { status: 404 });
  const [{ data: balances, error: balancesError }, { data: units, error: unitsError }] = await Promise.all([
    auth.admin.from("inventory_material_balances").select("quantity_grams").eq("material_id", materialId).gt("quantity_grams", 0),
    material.source_material_id === null
      ? Promise.resolve({ data: [], error: null })
      : auth.admin.from("inventory_stock_units").select("id").eq("source_material_id", material.source_material_id).in("status", ["available", "inspection"]),
  ]);
  if (balancesError || unitsError) return NextResponse.json({ error: "Pemakaian material belum dapat diverifikasi" }, { status: 409 });
  if ((balances?.length ?? 0) > 0 || (units?.length ?? 0) > 0) {
    return NextResponse.json({ error: "Material yang masih memiliki stok atau unit aktif tidak dapat dinonaktifkan" }, { status: 409 });
  }
  const { error } = await auth.admin.from("inventory_materials").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", materialId);
  if (error) return NextResponse.json({ error: "Gagal menonaktifkan material" }, { status: 409 });
  return NextResponse.json({ success: true });
}
