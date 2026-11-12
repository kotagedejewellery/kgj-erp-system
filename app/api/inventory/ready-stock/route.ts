import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { buildReadyStockModelSummaries } from "@/lib/inventory/ready-stock-summary";
import { parseReadyStockWeight } from "@/lib/inventory/ready-stock-weight";

export async function GET() {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const [units, locations, materials, allocations] = await Promise.all([
    auth.admin.from("inventory_stock_units").select("id, unit_code, brand_id, source_product_id, source_material_id, location_id, size, material_description, actual_weight_grams, condition, status, catalog_product_name, catalog_product_sku, catalog_cover_image_url, created_at").order("created_at", { ascending: false }),
    auth.admin.from("inventory_locations").select("id, code, name, location_type").eq("location_type", "warehouse").eq("is_active", true),
    auth.admin.from("inventory_materials").select("code, name, source_material_id, requires_unit_weight").eq("is_active", true).not("source_material_id", "is", null).order("code"),
    auth.admin.from("inventory_mutations").select("stock_unit_id").eq("mutation_type", "allocate_finished_good"),
  ]);
  const sourceProductIds = [...new Set((units.data ?? []).flatMap((unit) =>
    typeof unit.source_product_id === "number" ? [unit.source_product_id] : [],
  ))];
  const products = sourceProductIds.length > 0
    ? await auth.admin.from("inventory_catalog_products").select("source_product_id, sku, name, cover_image_url, source_available, is_published").eq("source_system", "yii2").in("source_product_id", sourceProductIds)
    : { data: [], error: null };
  const failed = [units, locations, materials, allocations, products].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: "Inventory belum diinisialisasi" }, { status: 409 });
  const materialBySourceId = new Map((materials.data ?? []).map((material) => [material.source_material_id, material.name]));
  const productBySourceId = new Map((products.data ?? []).map((product) => [product.source_product_id, product]));
  const unitData = units.data ?? [];
  return NextResponse.json({
    units: unitData.map((unit) => {
      const product = productBySourceId.get(unit.source_product_id);
      return {
        ...unit,
        product_label: product ? (product.sku ? `${product.sku} — ${product.name}` : product.name) : (unit.catalog_product_sku ? `${unit.catalog_product_sku} — ${unit.catalog_product_name}` : unit.catalog_product_name ?? "Model katalog belum tersedia"),
        cover_image_url: product?.cover_image_url ?? unit.catalog_cover_image_url ?? null,
        material_label: materialBySourceId.get(unit.source_material_id) ?? unit.material_description,
      };
    }),
    locations: locations.data ?? [],
    materials: materials.data ?? [],
    active_catalog_product_ids: (products.data ?? []).flatMap((product) => product.source_available && product.is_published ? [product.source_product_id] : []),
    models: buildReadyStockModelSummaries(
      unitData,
      products.data ?? [],
      (allocations.data ?? []).flatMap((mutation) => mutation.stock_unit_id ? [mutation.stock_unit_id] : []),
    ),
  });
}

export async function POST(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const brandId = Number(body.brand_id); const productId = Number(body.source_product_id); const materialId = Number(body.source_material_id);
  if (typeof body.unit_code !== "string" || !body.unit_code.trim() || typeof body.location_id !== "string" || typeof body.size !== "string" || !body.size.trim() || typeof body.material_description !== "string" || !body.material_description.trim() || !Number.isInteger(brandId) || brandId <= 0 || !Number.isInteger(productId) || productId <= 0 || !Number.isInteger(materialId) || materialId <= 0) {
    return NextResponse.json({ error: "Data unit ready-stock tidak valid" }, { status: 400 });
  }
  const { data: material } = await auth.admin.from("inventory_materials").select("requires_unit_weight").eq("source_material_id", materialId).eq("is_active", true).maybeSingle();
  if (!material) return NextResponse.json({ error: "Bahan ready-stock tidak tersedia" }, { status: 409 });
  const weight = parseReadyStockWeight(body.actual_weight_grams, material.requires_unit_weight);
  if ("error" in weight) return NextResponse.json({ error: weight.error }, { status: 400 });
  const { error } = await auth.admin.rpc("inventory_record_ready_stock_opening", {
    p_unit_code: body.unit_code,
    p_brand_id: brandId,
    p_source_product_id: productId,
    p_source_material_id: materialId,
    p_location_id: body.location_id,
    p_size: body.size,
    p_material_description: body.material_description,
    p_actual_weight_grams: weight.value,
    p_actor_id: auth.actorId,
  });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Kode unit sudah digunakan" : "Gagal mencatat ready-stock" }, { status: 409 });
  return NextResponse.json({ success: true }, { status: 201 });
}

