import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { isInventoryMutationType } from "@/lib/inventory/mutation-history";

function dateValue(value: string | null, endOfDay = false): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`;
}

export async function GET(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;

  const params = new URL(request.url).searchParams;
  const type = params.get("type") ?? "";
  if (type && !isInventoryMutationType(type)) {
    return NextResponse.json({ error: "Jenis mutasi tidak valid" }, { status: 400 });
  }

  let query = auth.admin
    .from("inventory_mutations")
    .select("id, mutation_type, material_id, stock_unit_id, order_id, from_location_id, to_location_id, quantity_grams, reason, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (type) query = query.eq("mutation_type", type);
  const from = dateValue(params.get("from"));
  const to = dateValue(params.get("to"), true);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data: mutations, error } = await query;
  if (error) return NextResponse.json({ error: "Riwayat mutasi belum dapat dimuat" }, { status: 409 });

  const records = mutations ?? [];
  const materialIds = [...new Set(records.flatMap((record) => record.material_id ? [record.material_id] : []))];
  const stockUnitIds = [...new Set(records.flatMap((record) => record.stock_unit_id ? [record.stock_unit_id] : []))];
  const orderIds = [...new Set(records.flatMap((record) => record.order_id ? [record.order_id] : []))];
  const userIds = [...new Set(records.flatMap((record) => record.created_by ? [record.created_by] : []))];
  const locationIds = [...new Set(records.flatMap((record) => [record.from_location_id, record.to_location_id].filter(Boolean)))];

  const [materials, units, orders, users, locations] = await Promise.all([
    materialIds.length ? auth.admin.from("inventory_materials").select("id, code, name").in("id", materialIds) : Promise.resolve({ data: [], error: null }),
    stockUnitIds.length ? auth.admin.from("inventory_stock_units").select("id, unit_code, catalog_product_name, catalog_product_sku").in("id", stockUnitIds) : Promise.resolve({ data: [], error: null }),
    orderIds.length ? auth.admin.from("legacy_orders").select("id, kode_order").in("id", orderIds) : Promise.resolve({ data: [], error: null }),
    userIds.length ? auth.admin.from("users").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    locationIds.length ? auth.admin.from("inventory_locations").select("id, code, name").in("id", locationIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if ([materials, units, orders, users, locations].some((result) => result.error)) {
    return NextResponse.json({ error: "Referensi riwayat mutasi belum dapat dimuat" }, { status: 409 });
  }

  const materialById = new Map((materials.data ?? []).map((material) => [material.id, `${material.code} — ${material.name}`]));
  const unitById = new Map((units.data ?? []).map((unit) => [unit.id, unit.catalog_product_sku ? `${unit.unit_code} — ${unit.catalog_product_sku}` : unit.unit_code]));
  const orderById = new Map((orders.data ?? []).map((order) => [order.id, order.kode_order]));
  const userById = new Map((users.data ?? []).map((user) => [user.id, user.full_name]));
  const locationById = new Map((locations.data ?? []).map((location) => [location.id, location.name || location.code]));

  return NextResponse.json({
    mutations: records.map((record) => ({
      ...record,
      material_label: record.material_id ? materialById.get(record.material_id) ?? "Bahan tidak ditemukan" : null,
      stock_unit_label: record.stock_unit_id ? unitById.get(record.stock_unit_id) ?? "Unit tidak ditemukan" : null,
      order_code: record.order_id ? orderById.get(record.order_id) ?? "Order tidak ditemukan" : null,
      actor_name: record.created_by ? userById.get(record.created_by) ?? "Pengguna tidak ditemukan" : null,
      from_location_label: record.from_location_id ? locationById.get(record.from_location_id) ?? "Lokasi tidak ditemukan" : null,
      to_location_label: record.to_location_id ? locationById.get(record.to_location_id) ?? "Lokasi tidak ditemukan" : null,
    })),
  });
}
