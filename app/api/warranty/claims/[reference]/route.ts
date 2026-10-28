import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { hasWarrantyPermission, WARRANTY_CLAIM_READ_PERMISSION } from "@/lib/warranty/permissions";
import { sendYiiWarrantyQuery } from "@/lib/warranty/yii-command";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const session = await createClient();
    const { data: { user }, error: userError } = await session.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile, error: profileError } = await createAdminClient()
      .from("users")
      .select("id, full_name, email, role:roles!users_role_id_fkey(name, permissions)")
      .eq("id", user.id)
      .is("deleted_at", null)
      .single();
    if (profileError || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = getRoleProps(profile);
    if (role.name !== "superadmin" && !hasWarrantyPermission(role.permissions, WARRANTY_CLAIM_READ_PERMISSION)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { reference } = await params;
    if (!reference.trim() || reference.length > 120) return NextResponse.json({ error: "Claim tidak valid" }, { status: 400 });
    const response = await sendYiiWarrantyQuery("/api/warranty/v1/queries/claims/get", {
      schema_version: 1,
      actor: {
        id: user.id,
        display_name: profile.full_name || profile.email || user.email || user.id,
        permissions: [WARRANTY_CLAIM_READ_PERMISSION],
      },
      data: { claim_reference: reference },
    });
    if (response.status >= 200 && response.status < 300) return NextResponse.json(response.body);
    return NextResponse.json({ error: response.error ?? "Claim tidak dapat dimuat" }, { status: response.status });
  } catch (error) {
    console.error("[GET /api/warranty/claims/[reference]]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
