import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";

function parseLocation(body: Record<string, unknown>) {
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  return code && name ? { code, name } : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ locationId: string }> }) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const { locationId } = await params;
  const location = parseLocation(await request.json());
  if (!location) return NextResponse.json({ error: "Kode dan nama gudang wajib diisi" }, { status: 400 });
  const { data: current } = await auth.admin
    .from("inventory_locations").select("id, is_default, location_type").eq("id", locationId).maybeSingle();
  if (!current) return NextResponse.json({ error: "Gudang tidak ditemukan" }, { status: 404 });
  if (current.is_default || current.location_type !== "warehouse") {
    return NextResponse.json({ error: "Gudang Utama dan WIP tidak dapat diubah" }, { status: 409 });
  }
  const { error } = await auth.admin.from("inventory_locations").update({ ...location, updated_at: new Date().toISOString() }).eq("id", locationId);
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Kode gudang sudah digunakan" : "Gagal memperbarui gudang" }, { status: 409 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ locationId: string }> }) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const { locationId } = await params;
  const { data: location } = await auth.admin.from("inventory_locations").select("id, is_default").eq("id", locationId).maybeSingle();
  if (!location) return NextResponse.json({ error: "Gudang tidak ditemukan" }, { status: 404 });
  if (location.is_default) return NextResponse.json({ error: "Gudang atau WIP utama tidak dapat dinonaktifkan" }, { status: 409 });
  const [{ data: balances, error: balancesError }, { data: units, error: unitsError }] = await Promise.all([
    auth.admin.from("inventory_material_balances").select("material_id").eq("location_id", locationId).gt("quantity_grams", 0),
    auth.admin.from("inventory_stock_units").select("id").eq("location_id", locationId).neq("status", "retired"),
  ]);
  if (balancesError || unitsError) return NextResponse.json({ error: "Isi gudang belum dapat diverifikasi" }, { status: 409 });
  if ((balances?.length ?? 0) > 0 || (units?.length ?? 0) > 0) return NextResponse.json({ error: "Pindahkan atau kosongkan stok sebelum menonaktifkan gudang" }, { status: 409 });
  const { error } = await auth.admin.from("inventory_locations").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", locationId);
  if (error) return NextResponse.json({ error: "Gagal menonaktifkan gudang" }, { status: 409 });
  return NextResponse.json({ success: true });
}
