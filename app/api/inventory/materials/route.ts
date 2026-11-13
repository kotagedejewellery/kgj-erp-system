import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import {
  hasSourceMaterialId,
  sourceMaterialOptions,
} from "@/lib/inventory/source-materials";
import { parseMaterialFamily } from "@/lib/inventory/material-family";

export async function GET() {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const [materials, locations, balances, orderComponents] = await Promise.all([
    auth.admin.from("inventory_materials").select("id, code, name, source_material_id, waste_percent, requires_unit_weight, material_family, is_active").order("code"),
    auth.admin.from("inventory_locations").select("id, code, name, location_type, is_default, is_active").order("code"),
    auth.admin.from("inventory_material_balances").select("location_id, material_id, quantity_grams"),
    auth.admin.from("legacy_orders").select("komponen").is("deleted_at", null),
  ]);
  const failed = [materials, locations, balances, orderComponents].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: "Inventory belum diinisialisasi" }, { status: 409 });
  const sourceMaterials = sourceMaterialOptions(orderComponents.data ?? []);
  const sourceMaterialNames = new Map(sourceMaterials.map((material) => [material.id, material.name]));
  return NextResponse.json({
    materials: (materials.data ?? []).map((material) => ({
      ...material,
      source_material_name: material.source_material_id === null
        ? null
        : sourceMaterialNames.get(material.source_material_id) ?? null,
    })),
    locations: locations.data ?? [],
    balances: balances.data ?? [],
    sourceMaterials,
  });
}

export async function POST(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const sourceMaterialId = body.source_material_id === "" || body.source_material_id === undefined ? null : Number(body.source_material_id);
  const wastePercent = body.waste_percent === "" || body.waste_percent === undefined ? 0 : Number(body.waste_percent);
  const requiresUnitWeight = body.requires_unit_weight === undefined ? true : body.requires_unit_weight === true || body.requires_unit_weight === "true" || body.requires_unit_weight === "on";
  const rawMaterialFamily = typeof body.material_family === "string" ? body.material_family : "";
  const materialFamily = rawMaterialFamily ? parseMaterialFamily(rawMaterialFamily) : null;
  if (!code || !name || (!materialFamily && rawMaterialFamily) || (sourceMaterialId !== null && (!Number.isInteger(sourceMaterialId) || sourceMaterialId <= 0)) || !Number.isFinite(wastePercent) || wastePercent < 0) {
    return NextResponse.json({ error: "Data material tidak valid" }, { status: 400 });
  }
  if (sourceMaterialId !== null) {
    const { data: orderComponents, error: orderComponentsError } = await auth.admin
      .from("legacy_orders")
      .select("komponen")
      .is("deleted_at", null);
    if (orderComponentsError) {
      return NextResponse.json({ error: "Daftar bahan order belum dapat diverifikasi" }, { status: 409 });
    }
    if (!hasSourceMaterialId(orderComponents ?? [], sourceMaterialId)) {
      return NextResponse.json({ error: "Bahan pada order tidak ditemukan" }, { status: 400 });
    }
    const { data: existingMapping, error: existingMappingError } = await auth.admin
      .from("inventory_materials")
      .select("id")
      .eq("source_material_id", sourceMaterialId)
      .maybeSingle();
    if (existingMappingError) {
      return NextResponse.json({ error: "Mapping bahan order belum dapat diverifikasi" }, { status: 409 });
    }
    if (existingMapping) {
      return NextResponse.json({ error: "Bahan pada order sudah terhubung ke material lain" }, { status: 409 });
    }
  }
  const { data, error } = await auth.admin.from("inventory_materials")
    .insert({ code, name, source_material_id: sourceMaterialId, waste_percent: wastePercent, requires_unit_weight: requiresUnitWeight, material_family: materialFamily }).select("id, code, name").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Kode atau mapping bahan sudah digunakan" : "Gagal menambah material" }, { status: 409 });
  return NextResponse.json({ data }, { status: 201 });
}

