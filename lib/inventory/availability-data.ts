import { createAdminClient } from "@/lib/supabase/admin";
import { buildOrderAvailability, buildReadyStockAvailability } from "@/lib/inventory/availability";

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
    admin.from("inventory_locations").select("id, name, location_type, is_default, is_active"),
    admin.from("inventory_materials").select("id, code, name, source_material_id, waste_percent, material_family").eq("is_active", true).order("code"),
    admin.from("inventory_material_balances").select("location_id, material_id, quantity_grams"),
    admin.from("inventory_stock_units").select("brand_id, source_product_id, source_material_id, size, ring_gender, location_id").eq("status", "available"),
  ]);

  const failed = [locationsResult, materialsResult, balancesResult, unitsResult].find((result) => result.error);
  if (failed?.error) throw new Error("Gagal membaca ketersediaan stok");

  const activeLocations = (locationsResult.data ?? []).filter((location) => location.is_active);
  const warehouseIds = new Set(activeLocations
    .filter((location) => location.location_type === "warehouse")
    .map((location) => location.id));
  const defaultWarehouseId = activeLocations.find((location) => location.location_type === "warehouse" && location.is_default)?.id ?? null;
  const materials = (materialsResult.data ?? []).flatMap((material) => {
    const sourceMaterialId = Number(material.source_material_id);
    return Number.isInteger(sourceMaterialId) && sourceMaterialId > 0 ? [{
      id: material.id,
      code: material.code,
      name: material.name,
      sourceMaterialId,
      wastePercent: material.waste_percent,
      materialFamily: material.material_family,
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
  const readyStock = buildReadyStockAvailability({
    units: (unitsResult.data ?? []).map((unit) => ({
      brandId: unit.brand_id,
      productId: unit.source_product_id,
      sourceMaterialId: unit.source_material_id,
      size: unit.size,
      ringGender: unit.ring_gender,
      locationId: unit.location_id,
    })),
    products: (productsResult.data ?? []).map((product) => ({
      sourceProductId: product.source_product_id,
      sku: product.sku,
      name: product.name,
      coverImageUrl: product.cover_image_url,
    })),
    materials,
    locations: (locationsResult.data ?? []).map((location) => ({ id: location.id, name: location.name })),
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
        ringGender: unit.ring_gender,
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
