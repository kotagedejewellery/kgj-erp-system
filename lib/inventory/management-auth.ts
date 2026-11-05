import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canManageInventory } from "@/lib/inventory/management-access";

export async function requireInventoryManagement() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("status, role:roles!users_role_id_fkey(name)")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single();
  if (!canManageInventory(profile?.status, getRoleProps(profile).name)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin, actorId: user.id };
}
