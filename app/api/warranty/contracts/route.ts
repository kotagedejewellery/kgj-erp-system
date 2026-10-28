import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { hasWarrantyPermission, WARRANTY_CONTRACT_READ_PERMISSION } from "@/lib/warranty/permissions";
import { sendYiiWarrantyQuery } from "@/lib/warranty/yii-command";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function positiveInteger(value: string | null, fallback: number) {
  const number = Number.parseInt(value ?? "", 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export async function GET(request: Request) {
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
    if (role.name !== "superadmin" && !hasWarrantyPermission(role.permissions, WARRANTY_CONTRACT_READ_PERMISSION)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim() ?? "";
    if (!query) return NextResponse.json({ error: "Pencarian wajib diisi" }, { status: 400 });
    if (query.length > 160) return NextResponse.json({ error: "Pencarian terlalu panjang" }, { status: 400 });

    const response = await sendYiiWarrantyQuery("/api/warranty/v1/queries/contracts/search", {
      schema_version: 1,
      actor: {
        id: user.id,
        display_name: profile.full_name || profile.email || user.email || user.id,
        permissions: [WARRANTY_CONTRACT_READ_PERMISSION],
      },
      data: {
        query,
        page: positiveInteger(url.searchParams.get("page"), 1),
        page_size: 20,
      },
    });
    if (response.status >= 200 && response.status < 300) {
      return NextResponse.json(response.body);
    }
    return NextResponse.json({ error: response.error ?? "Warranty Core tidak dapat dihubungi" }, { status: response.status });
  } catch (error) {
    console.error("[GET /api/warranty/contracts]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
