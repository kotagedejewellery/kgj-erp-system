import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("role:roles!users_role_id_fkey(name, role_group, allowed_stages)")
      .eq("id", user.id)
      .is("deleted_at", null)
      .single();
    const role = getRoleProps(profile);
    const canApprove = role.name === "superadmin" || role.role_group === "management" || role.allowed_stages.includes("approval_penerimaan_order");
    if (!canApprove) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const brandId = Number(request.nextUrl.searchParams.get("brand_id"));
    const sourceProductId = Number(request.nextUrl.searchParams.get("source_product_id"));
    if (!Number.isInteger(brandId) || brandId <= 0 || !Number.isInteger(sourceProductId) || sourceProductId <= 0) {
      return NextResponse.json({ error: "brand_id dan source_product_id wajib valid" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("inventory_stock_units")
      .select("id, unit_code, size, ring_gender, material_description, actual_weight_grams")
      .eq("brand_id", brandId)
      .eq("source_product_id", sourceProductId)
      .eq("status", "available")
      .order("unit_code");
    if (error) return NextResponse.json({ error: "Gagal mengambil ready-stock" }, { status: 500 });

    return NextResponse.json({ units: data ?? [] });
  } catch (error) {
    console.error("[GET /api/inventory/stock-units] Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
