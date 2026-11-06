import { NextResponse } from "next/server";
import { buildInventoryActivationChecklist } from "@/lib/inventory/activation-readiness";
import { buildInventoryDashboardSummary } from "@/lib/inventory/dashboard-summary";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";

export async function GET() {
  try {
    const auth = await requireInventoryManagement();
    if ("error" in auth) return auth.error;
    const { admin } = auth;

    const [locationsResult, balancesResult, stockUnitsResult, readyStockUnitsResult, materialsResult, mutationsResult, settingsResult, catalogProductsResult] = await Promise.all([
      admin.from("inventory_locations").select("id, location_type, is_default, is_active"),
      admin.from("inventory_material_balances").select("location_id, material_id, quantity_grams"),
      admin.from("inventory_stock_units").select("id", { count: "exact", head: true }).eq("status", "available"),
      admin.from("inventory_stock_units").select("id", { count: "exact", head: true }),
      admin.from("inventory_materials").select("id, source_material_id, is_active").eq("is_active", true),
      admin.from("inventory_mutations").select("id, mutation_type, quantity_grams, reason, created_at").order("created_at", { ascending: false }).limit(8),
      admin.from("inventory_settings").select("is_enabled").eq("singleton", true).maybeSingle(),
      admin.from("inventory_catalog_products").select("source_product_id", { count: "exact", head: true }).eq("source_system", "yii2").eq("source_available", true).eq("is_published", true),
    ]);

    const resultWithError = [locationsResult, balancesResult, stockUnitsResult, readyStockUnitsResult, materialsResult, mutationsResult, settingsResult, catalogProductsResult]
      .find((result) => result.error);
    if (resultWithError?.error) {
      console.error("[GET /api/inventory/summary] Query error:", resultWithError.error);
      return NextResponse.json({ error: "Inventory belum diinisialisasi" }, { status: 409 });
    }

    const summary = buildInventoryDashboardSummary(
      (locationsResult.data ?? []) as { id: string; location_type: "warehouse" | "wip" }[],
      (balancesResult.data ?? []) as { location_id: string; quantity_grams: number | string }[],
      stockUnitsResult.count ?? 0,
      materialsResult.data?.length ?? 0,
    );

    const activation = buildInventoryActivationChecklist(
      (locationsResult.data ?? []) as { id: string; location_type: string; is_default: boolean; is_active: boolean }[],
      materialsResult.data ?? [],
      balancesResult.data ?? [],
      catalogProductsResult.count ?? 0,
      readyStockUnitsResult.count ?? 0,
    );

    return NextResponse.json({ summary, mutations: mutationsResult.data ?? [], is_enabled: settingsResult.data?.is_enabled === true, activation });
  } catch (error) {
    console.error("[GET /api/inventory/summary] Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
