import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { parsePositiveGrams } from "@/lib/inventory/grams";
import { produkInfo } from "@/lib/legacy/produk-labels";

export async function GET() {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const [units, locations, materials] = await Promise.all([
    auth.admin.from("inventory_stock_units").select("id, unit_code, brand_id, source_product_id, source_material_id, size, material_description, actual_weight_grams, condition, status, created_at").order("created_at", { ascending: false }),
    auth.admin.from("inventory_locations").select("id, code, name, location_type").eq("location_type", "warehouse").eq("is_active", true),
    auth.admin.from("inventory_materials").select("code, name, source_material_id").eq("is_active", true).not("source_material_id", "is", null).order("code"),
  ]);
  const failed = [units, locations, materials].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: "Inventory belum diinisialisasi" }, { status: 409 });
  const materialBySourceId = new Map((materials.data ?? []).map((material) => [material.source_material_id, material.name]));
  return NextResponse.json({
    units: (units.data ?? []).map((unit) => {
      const product = produkInfo(unit.source_product_id);
      return {
        ...unit,
        product_label: product?.sku ?? product?.nama ?? "Produk tidak dikenal",
        material_label: materialBySourceId.get(unit.source_material_id) ?? unit.material_description,
      };
    }),
    locations: locations.data ?? [],
    materials: materials.data ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const brandId = Number(body.brand_id); const productId = Number(body.source_product_id); const materialId = Number(body.source_material_id); const weight = parsePositiveGrams(body.actual_weight_grams);
  if (typeof body.unit_code !== "string" || !body.unit_code.trim() || typeof body.location_id !== "string" || typeof body.size !== "string" || !body.size.trim() || typeof body.material_description !== "string" || !body.material_description.trim() || !Number.isInteger(brandId) || brandId <= 0 || !Number.isInteger(productId) || productId <= 0 || !Number.isInteger(materialId) || materialId <= 0 || weight === null) {
    return NextResponse.json({ error: "Data unit ready-stock tidak valid" }, { status: 400 });
  }
  const { data: location } = await auth.admin.from("inventory_locations").select("location_type").eq("id", body.location_id).single();
  if (location?.location_type !== "warehouse") return NextResponse.json({ error: "Unit ready-stock harus ditempatkan di gudang" }, { status: 400 });
  const { error } = await auth.admin.from("inventory_stock_units").insert({ unit_code: body.unit_code.trim().toUpperCase(), brand_id: brandId, source_product_id: productId, source_material_id: materialId, location_id: body.location_id, size: body.size.trim(), material_description: body.material_description.trim(), actual_weight_grams: weight });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Kode unit sudah digunakan" : "Gagal menambah ready-stock" }, { status: 409 });
  return NextResponse.json({ success: true }, { status: 201 });
}

