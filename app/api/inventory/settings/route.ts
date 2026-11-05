import { NextResponse } from "next/server";
import { isInventoryReadyForActivation } from "@/lib/inventory/activation-readiness";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";

export async function GET() {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.admin.from("inventory_settings").select("is_enabled").eq("singleton", true).maybeSingle();
  if (error) return NextResponse.json({ error: "Inventory belum diinisialisasi" }, { status: 409 });
  return NextResponse.json({ is_enabled: data?.is_enabled === true });
}

export async function POST(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const { is_enabled } = await request.json();
  if (typeof is_enabled !== "boolean") return NextResponse.json({ error: "Status aktivasi tidak valid" }, { status: 400 });
  if (is_enabled) {
    const [locations, materials, balances] = await Promise.all([
      auth.admin.from("inventory_locations").select("id, location_type, is_default, is_active"),
      auth.admin.from("inventory_materials").select("id, source_material_id, is_active"),
      auth.admin.from("inventory_material_balances").select("location_id, material_id, quantity_grams"),
    ]);
    if ([locations, materials, balances].some((result) => result.error)) {
      return NextResponse.json({ error: "Data inventory belum dapat diverifikasi" }, { status: 409 });
    }
    if (!isInventoryReadyForActivation(locations.data ?? [], materials.data ?? [], balances.data ?? [])) {
      return NextResponse.json({ error: "Aktivasi membutuhkan Gudang dan WIP default, satu mapping bahan Yii2 aktif, serta saldo gudang positif" }, { status: 409 });
    }
  }
  const { error } = await auth.admin.from("inventory_settings").update({ is_enabled, updated_at: new Date().toISOString(), updated_by: auth.actorId }).eq("singleton", true);
  if (error) return NextResponse.json({ error: "Gagal memperbarui aktivasi inventory" }, { status: 500 });
  return NextResponse.json({ is_enabled });
}
