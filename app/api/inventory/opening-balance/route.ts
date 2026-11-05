import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { parsePositiveGrams } from "@/lib/inventory/grams";

export async function POST(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const quantity = parsePositiveGrams(body.quantity_grams);
  if (typeof body.material_id !== "string" || typeof body.location_id !== "string" || quantity === null) {
    return NextResponse.json({ error: "Material, lokasi, dan saldo awal wajib valid" }, { status: 400 });
  }
  const { error } = await auth.admin.rpc("inventory_record_opening_balance", {
    p_location_id: body.location_id, p_material_id: body.material_id, p_quantity_grams: quantity, p_actor_id: auth.actorId,
    p_reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Saldo awal inventory",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ success: true });
}
