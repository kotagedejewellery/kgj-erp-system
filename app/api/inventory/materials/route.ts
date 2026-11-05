import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";

export async function GET() {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const [materials, locations, balances] = await Promise.all([
    auth.admin.from("inventory_materials").select("id, code, name, source_material_id, waste_percent, is_active").order("code"),
    auth.admin.from("inventory_locations").select("id, code, name, location_type, is_default, is_active").order("code"),
    auth.admin.from("inventory_material_balances").select("location_id, material_id, quantity_grams"),
  ]);
  const failed = [materials, locations, balances].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: "Inventory belum diinisialisasi" }, { status: 409 });
  return NextResponse.json({ materials: materials.data ?? [], locations: locations.data ?? [], balances: balances.data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const sourceMaterialId = body.source_material_id === "" || body.source_material_id === undefined ? null : Number(body.source_material_id);
  const wastePercent = body.waste_percent === "" || body.waste_percent === undefined ? 0 : Number(body.waste_percent);
  if (!code || !name || (sourceMaterialId !== null && (!Number.isInteger(sourceMaterialId) || sourceMaterialId <= 0)) || !Number.isFinite(wastePercent) || wastePercent < 0) {
    return NextResponse.json({ error: "Data material tidak valid" }, { status: 400 });
  }
  const { data, error } = await auth.admin.from("inventory_materials")
    .insert({ code, name, source_material_id: sourceMaterialId, waste_percent: wastePercent }).select("id, code, name").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Kode atau mapping bahan sudah digunakan" : "Gagal menambah material" }, { status: 409 });
  return NextResponse.json({ data }, { status: 201 });
}

