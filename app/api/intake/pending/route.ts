import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canValidateIntake } from "@/lib/legacy/intake";
import { getRoleProps } from "@/lib/auth/session";
import { getBrandIdFromFilterCode } from "@/lib/legacy/brands";

async function authorize() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role:roles!users_role_id_fkey(name, permissions)")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single();

  const role = getRoleProps(profile);
  if (role.name !== "superadmin" && !canValidateIntake(role.permissions)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, role };
}

export async function GET(request: Request) {
  try {
    const auth = await authorize();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const requestedBrand = searchParams.get("brand") ?? "all";
    const brand = auth.role.name === "customer_service_supervisor" ? "MP" : requestedBrand;
    const brandId = brand === "all" ? null : getBrandIdFromFilterCode(brand);
    if (brand !== "all" && brandId === null) {
      return NextResponse.json({ error: "Brand tidak valid" }, { status: 400 });
    }
    const requestedLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const requestedOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
    const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

    let intakeQuery = auth.admin
      .from("legacy_order_intakes")
      .select(`
        id, legacy_order_id, state, reason, rework_sync_status, created_at, updated_at,
        legacy_orders!legacy_order_intakes_legacy_order_id_fkey${brandId ? "!inner" : ""}(
          id, kode_order, nama, no_hp, tgl_order, tgl_selesai, catatan,
          komponen, harga_final, jumlah_bayar, sisa_bayar,
          reference_image_pria_url, reference_image_wanita_url, id_brand
        )
      `, { count: "exact" })
      .in("state", ["pending_spv_cs_validation", "returned_for_revision"])
      .order("updated_at", { ascending: true });
    if (brandId) intakeQuery = intakeQuery.eq("legacy_orders.id_brand", brandId);
    const { data, error, count: total } = await intakeQuery.range(offset, offset + limit - 1);

    if (error) {
      console.error("[GET /api/intake/pending]", error);
      return NextResponse.json({ error: "Gagal mengambil antrean intake" }, { status: 500 });
    }

    const intakeData = data ?? [];

    return NextResponse.json({
      success: true,
      data: intakeData,
      total: total ?? 0,
      next_offset: data && offset + data.length < (total ?? 0)
        ? offset + data.length
        : null,
    });
  } catch (error) {
    console.error("[GET /api/intake/pending]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
