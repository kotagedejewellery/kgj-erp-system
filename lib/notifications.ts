import { createAdminClient } from "@/lib/supabase/admin";
// Pusher push is now handled by Supabase Database Webhook
// ("Pusher-RealTime-Notification") on the notifications table.

export async function sendNotification({
  userId,
  title,
  message,
  type,
  link,
}: {
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  link?: string | null;
}) {
  const admin = createAdminClient();

  const { error } = await admin
    .from("notifications")
    .insert({
      user_id: userId,
      title,
      message,
      type,
      link: link ?? null,
    });

  if (error) {
    console.error("[sendNotification] insert error:", error);
  }
}
const APPROVAL_SUPERVISOR: Record<string, "operational_supervisor" | "production_supervisor"> = {
  approval_penerimaan_order: "operational_supervisor",
  approval_racik_bahan: "operational_supervisor",
  approval_qc_1: "operational_supervisor",
  approval_produksi: "production_supervisor",
  approval_qc_2: "operational_supervisor",
};

export function getSupervisorRoleForApproval(approvalStage: string) {
  return APPROVAL_SUPERVISOR[approvalStage] ?? null;
}

export async function findSupervisorIds(
  roleName: "operational_supervisor" | "production_supervisor",
): Promise<string[]> {
  const admin = createAdminClient();

  const { data: roleData } = await admin
    .from("roles")
    .select("id")
    .eq("name", roleName)
    .single();

  if (!roleData) return [];

  const { data: supervisors } = await admin
    .from("users")
    .select("id")
    .eq("role_id", roleData.id)
    .eq("deleted_at", null)
    .in("status", ["active", null]);

  return (supervisors || []).map((s) => s.id);
}

export async function notifySupervisors(
  roleName: "operational_supervisor" | "production_supervisor",
  title: string,
  message: string,
  type: "info" | "success" | "warning" | "error",
  link?: string | null,
) {
  const ids = await findSupervisorIds(roleName);
  await Promise.allSettled(
    ids.map((userId) =>
      sendNotification({ userId, title, message, type, link }),
    ),
  );
}
