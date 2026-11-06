import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";
import { canReadInventoryAvailability } from "@/lib/inventory/availability";
import { loadInventoryAvailability } from "@/lib/inventory/availability-data";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("status, role:roles!users_role_id_fkey(name)")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!canReadInventoryAvailability(profile?.status, getRoleProps(profile).name)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const orderId = request.nextUrl.searchParams.get("order_id") ?? undefined;
    return NextResponse.json(await loadInventoryAvailability(admin, orderId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat ketersediaan stok";
    return NextResponse.json({ error: message }, { status: message === "Order tidak ditemukan" ? 404 : 500 });
  }
}
