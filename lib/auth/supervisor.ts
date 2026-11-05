import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";

export interface SupervisorInfo {
  id: string;
  full_name: string;
  roleName: string;
  roleGroup: string;
  allowedStages: string[];
}

export async function verifySupervisorScope(): Promise<{
  user: SupervisorInfo | null;
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !authUser) {
    return { user: null, error: "Unauthorized" };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, full_name, role:roles!users_role_id_fkey(name, role_group, allowed_stages)")
    .eq("id", authUser.id)
    .single();

  if (!profile) {
    return { user: null, error: "User not found" };
  }

  const roleName: string = getRoleProps(profile).name;
  const roleGroup: string = getRoleProps(profile).role_group;
  const allowedStages: string[] = getRoleProps(profile).allowed_stages;

  const isSupervisor =
    roleName === "superadmin" ||
    roleName === "operational_supervisor" ||
    roleName === "production_supervisor" ||
    roleName === "supervisor";

  if (!isSupervisor) {
    return { user: null, error: "Forbidden: supervisor access required" };
  }

  return {
    user: {
      id: profile.id,
      full_name: profile.full_name,
      roleName,
      roleGroup,
      allowedStages,
    },
    error: null,
  };
}
