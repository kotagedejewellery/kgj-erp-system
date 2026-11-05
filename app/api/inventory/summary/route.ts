import { NextResponse } from "next/server";
import { buildInventoryDashboardSummary } from "@/lib/inventory/dashboard-summary";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";

export async function GET() {
  try {
    const auth = await requireInventoryManagement();
    if ("error" in auth) return auth.error;
    const { admin } = auth;

    const [locationsResult, balancesResult, stockUnitsResult, materialsResult, mutationsResult, settingsResult] = await Promise.all([
      admin.from("inventory_locations").select("id, location_type"),
      admin.from("inventory_material_balances").select("location_id, quantity_grams"),
      admin.from("inventory_stock_units").select("id", { count: "exact", head: true }).eq("status", "available"),
      admin.from("inventory_materials").select("id", { count: "exact", head: true }).eq("is_active", true),
      admin.from("inventory_mutations").select("id, mutation_type, quantity_grams, reason, created_at").order("created_at", { ascending: false }).limit(8),
      admin.from("inventory_settings").select("is_enabled").eq("singleton", true).maybeSingle(),
    ]);

    const resultWithError = [locationsResult, balancesResult, stockUnitsResult, materialsResult, mutationsResult, settingsResult]
      .find((result) => result.error);
    if (resultWithError?.error) {
      console.error("[GET /api/inventory/summary] Query error:", resultWithError.error);
      return NextResponse.json({ error: "Inventory belum diinisialisasi" }, { status: 409 });
    }

    const summary = buildInventoryDashboardSummary(
      (locationsResult.data ?? []) as { id: string; location_type: "warehouse" | "wip" }[],
      (balancesResult.data ?? []) as { location_id: string; quantity_grams: number | string }[],
      stockUnitsResult.count ?? 0,
      materialsResult.count ?? 0,
    );

    return NextResponse.json({ summary, mutations: mutationsResult.data ?? [], is_enabled: settingsResult.data?.is_enabled === true });
  } catch (error) {
    console.error("[GET /api/inventory/summary] Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
