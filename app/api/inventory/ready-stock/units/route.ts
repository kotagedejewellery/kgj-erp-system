import { NextRequest, NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { parseReadyStockUnitQuery } from "@/lib/inventory/ready-stock-units";

export async function GET(request: NextRequest) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const filters = parseReadyStockUnitQuery(request.nextUrl.searchParams);
  const start = (filters.page - 1) * filters.pageSize;
  let query = auth.admin
    .from("inventory_stock_units")
    .select("id, unit_code, brand_id, source_product_id, source_material_id, location_id, size, material_description, actual_weight_grams, condition, ring_gender, status, catalog_product_name, catalog_product_sku, catalog_cover_image_url, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.brandId) query = query.eq("brand_id", filters.brandId);
  if (filters.sourceProductId) query = query.eq("source_product_id", filters.sourceProductId);
  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.ringGender) query = query.eq("ring_gender", filters.ringGender);
  if (filters.size) query = query.eq("size", filters.size);
  if (filters.query) query = query.ilike("unit_code", `%${filters.query}%`);

  const [units, locations, materials] = await Promise.all([
    query.range(start, start + filters.pageSize - 1),
    auth.admin.from("inventory_locations").select("id, name, is_active, location_type").order("name"),
    auth.admin.from("inventory_materials").select("source_material_id, code, name").eq("is_active", true),
  ]);
  const failed = [units, locations, materials].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: "Gagal memuat unit ready-stock" }, { status: 409 });

  const sourceProductIds = [...new Set((units.data ?? []).flatMap((unit) => typeof unit.source_product_id === "number" ? [unit.source_product_id] : []))];
  const products = sourceProductIds.length
    ? await auth.admin.from("inventory_catalog_products").select("source_product_id, sku, name, cover_image_url").eq("source_system", "yii2").in("source_product_id", sourceProductIds)
    : { data: [], error: null };
  if (products.error) return NextResponse.json({ error: "Gagal memuat referensi katalog" }, { status: 409 });

  const productsBySourceId = new Map((products.data ?? []).map((product) => [product.source_product_id, product]));
  const locationsById = new Map((locations.data ?? []).map((location) => [location.id, location.name]));
  const materialsBySourceId = new Map((materials.data ?? []).map((material) => [material.source_material_id, material]));
  return NextResponse.json({
    units: (units.data ?? []).map((unit) => {
      const product = productsBySourceId.get(unit.source_product_id);
      const material = materialsBySourceId.get(unit.source_material_id);
      return {
        ...unit,
        product_label: product ? (product.sku ? `${product.sku} — ${product.name}` : product.name) : (unit.catalog_product_sku ? `${unit.catalog_product_sku} — ${unit.catalog_product_name}` : unit.catalog_product_name ?? "Model katalog belum tersedia"),
        cover_image_url: product?.cover_image_url ?? unit.catalog_cover_image_url ?? null,
        material_label: material ? `${material.code} — ${material.name}` : unit.material_description,
        location_label: locationsById.get(unit.location_id) ?? "Gudang tidak tersedia",
      };
    }),
    locations: (locations.data ?? []).filter((location) => location.is_active && location.location_type === "warehouse"),
    meta: { page: filters.page, page_size: filters.pageSize, total: units.count ?? 0 },
  });
}
