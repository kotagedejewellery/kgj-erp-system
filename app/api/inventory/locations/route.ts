import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";

function parseLocation(body: Record<string, unknown>) {
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  return code && name ? { code, name } : null;
}

export async function GET() {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const [locations, balances, units] = await Promise.all([
    auth.admin.from("inventory_locations").select("id, code, name, location_type, is_default, is_active").order("location_type").order("code"),
    auth.admin.from("inventory_material_balances").select("location_id, quantity_grams"),
    auth.admin.from("inventory_stock_units").select("location_id, status"),
  ]);
  const failed = [locations, balances, units].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: "Lokasi inventory belum dapat dimuat" }, { status: 409 });
  const gramsByLocation = new Map<string, number>();
  for (const balance of balances.data ?? []) gramsByLocation.set(balance.location_id, (gramsByLocation.get(balance.location_id) ?? 0) + Number(balance.quantity_grams));
  const unitsByLocation = new Map<string, number>();
  for (const unit of units.data ?? []) {
    if (unit.status !== "retired") unitsByLocation.set(unit.location_id, (unitsByLocation.get(unit.location_id) ?? 0) + 1);
  }
  return NextResponse.json({
    locations: (locations.data ?? []).map((location) => ({
      ...location,
      balance_grams: gramsByLocation.get(location.id) ?? 0,
      stock_unit_count: unitsByLocation.get(location.id) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const location = parseLocation(await request.json());
  if (!location) return NextResponse.json({ error: "Kode dan nama gudang wajib diisi" }, { status: 400 });
  const { error } = await auth.admin.from("inventory_locations").insert({ ...location, location_type: "warehouse", is_default: false });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Kode gudang sudah digunakan" : "Gagal menambah gudang" }, { status: 409 });
  return NextResponse.json({ success: true }, { status: 201 });
}
