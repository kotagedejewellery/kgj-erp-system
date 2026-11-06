import { createAdminClient } from "@/lib/supabase/admin";
import { buildOrderAvailability } from "@/lib/inventory/availability";

type AdminClient = ReturnType<typeof createAdminClient>;

type InventoryOrder = {
  id: string;
  id_brand: number;
  id_produk: number | null;
  komponen: Array<{ id_gender: number | string | null; id_jenis_bahan: number | string | null; ukuran: string | null }> | null;
  berat_cincin_pria: number | string | null;
  berat_cincin_wanita: number | string | null;
};

export async function loadInventoryAvailability(admin: AdminClient, orderId?: string) {
  const [locationsResult, materialsResult, balancesResult, unitsResult] = await Promise.all([
    admin.from("inventory_locations").select("id, name, location_type, is_default").eq("is_active", true),
    admin.from("inventory_materials").select("id, code, name, source_material_id, waste_percent").eq("is_active", true).order("code"),
    admin.from("inventory_material_balances").select("location_id, material_id, quantity_grams"),
    admin.from("inventory_stock_units").select("brand_id, source_product_id, source_material_id, size").eq("status", "available"),
  ]);

  const failed = [locationsResult, materialsResult, balancesResult, unitsResult].find((result) => result.error);
  if (failed?.error) throw new Error("Gagal membaca ketersediaan stok");

  const warehouseIds = new Set((locationsResult.data ?? [])
    .filter((location) => location.location_type === "warehouse")
    .map((location) => location.id));
  const defaultWarehouseId = (locationsResult.data ?? []).find((location) => location.location_type === "warehouse" && location.is_default)?.id ?? null;
  const materials = (materialsResult.data ?? []).flatMap((material) => {
    const sourceMaterialId = Number(material.source_material_id);
    return Number.isInteger(sourceMaterialId) && sourceMaterialId > 0 ? [{
      id: material.id,
      code: material.code,
      name: material.name,
      sourceMaterialId,
      wastePercent: material.waste_percent,
    }] : [];
  });
  const warehouseBalanceByMaterialId = new Map<string, number>();
  const defaultBalanceByMaterialId = new Map<string, number>();
  for (const balance of balancesResult.data ?? []) {
    const quantity = Number(balance.quantity_grams);
    if (!Number.isFinite(quantity)) continue;
    if (warehouseIds.has(balance.location_id)) {
      warehouseBalanceByMaterialId.set(balance.material_id, (warehouseBalanceByMaterialId.get(balance.material_id) ?? 0) + quantity);
    }
    if (balance.location_id === defaultWarehouseId) defaultBalanceByMaterialId.set(balance.material_id, quantity);
  }

  const materialAvailability = materials.map((material) => ({
    code: material.code,
    name: material.name,
    available_grams: (warehouseBalanceByMaterialId.get(material.id) ?? 0).toFixed(3),
  }));

  const productIds = [...new Set((unitsResult.data ?? []).flatMap((unit) =>
    typeof unit.source_product_id === "number" ? [unit.source_product_id] : [],
  ))];
  const productsResult = productIds.length > 0
    ? await admin.from("inventory_catalog_products").select("source_product_id, sku, name, cover_image_url").eq("source_system", "yii2").in("source_product_id", productIds)
    : { data: [], error: null };
  if (productsResult.error) throw new Error("Gagal membaca referensi katalog");
  const products = new Map((productsResult.data ?? []).map((product) => [product.source_product_id, product]));
  const readyGroups = new Map<string, {
    brand_id: number;
    source_product_id: number | null;
    source_material_id: number | null;
    size: string | null;
    available_units: number;
  }>();
  for (const unit of unitsResult.data ?? []) {
    const key = [unit.brand_id, unit.source_product_id ?? "", unit.source_material_id ?? "", unit.size ?? ""].join(":");
    const group = readyGroups.get(key) ?? {
      brand_id: unit.brand_id,
      source_product_id: unit.source_product_id,
      source_material_id: unit.source_material_id,
      size: unit.size,
      available_units: 0,
    };
    group.available_units += 1;
    readyGroups.set(key, group);
  }
  const readyStock = [...readyGroups.values()].map((group) => {
    const product = group.source_product_id === null ? null : products.get(group.source_product_id);
    const material = materials.find((item) => item.sourceMaterialId === group.source_material_id);
    return {
      ...group,
      product_label: product ? (product.sku ? `${product.sku} — ${product.name}` : product.name) : "Model katalog belum tersedia",
      cover_image_url: product?.cover_image_url ?? null,
      material_label: material ? `${material.code} — ${material.name}` : "Bahan belum dipetakan",
    };
  });

  let orderAvailability = null;
  if (orderId) {
    const { data: order, error } = await admin
      .from("legacy_orders")
      .select("id, id_brand, id_produk, komponen, berat_cincin_pria, berat_cincin_wanita")
      .eq("id", orderId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("Gagal membaca detail order");
    if (!order) throw new Error("Order tidak ditemukan");
    const inventoryOrder = order as InventoryOrder;
    orderAvailability = buildOrderAvailability({
      order: {
        brandId: inventoryOrder.id_brand,
        productId: inventoryOrder.id_produk,
        components: inventoryOrder.komponen ?? [],
        beratCincinPria: inventoryOrder.berat_cincin_pria,
        beratCincinWanita: inventoryOrder.berat_cincin_wanita,
      },
      materials,
      balances: materials.map((material) => ({
        materialId: material.id,
        quantityGrams: defaultBalanceByMaterialId.get(material.id) ?? 0,
      })),
      readyStock: (unitsResult.data ?? []).map((unit) => ({
        brandId: unit.brand_id,
        productId: unit.source_product_id,
        sourceMaterialId: unit.source_material_id,
        size: unit.size,
      })),
    });
  }

  return {
    checked_at: new Date().toISOString(),
    materials: materialAvailability,
    ready_stock: readyStock,
    order: orderAvailability,
  };
}
