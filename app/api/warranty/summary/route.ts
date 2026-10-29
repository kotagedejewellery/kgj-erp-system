import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function warrantyReader() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("users")
    .select("id, status, role:roles!users_role_id_fkey(name, permissions)")
    .eq("id", user.id).is("deleted_at", null).single();
  if (!profile || profile.status !== "active") return null;
  const role = getRoleProps(profile);
  if (role.name !== "superadmin" && role.name !== "operational_supervisor") return null;
  return admin;
}

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count: total, error } = await query;
  if (error) throw error;
  return total ?? 0;
}

export async function GET() {
  try {
    const admin = await warrantyReader();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const now = new Date();
    const expiringAt = new Date(now);
    expiringAt.setDate(expiringAt.getDate() + 30);
    const [activeContracts, expiringContracts, activeWorks, pendingExceptions, failedWorkOutbox, deadWorkOutbox, failedActivationOutbox, deadActivationOutbox, lastInbound] = await Promise.all([
      count(admin.from("warranty_contract_projections").select("*", { count: "exact", head: true }).gt("expires_at", now.toISOString())),
      count(admin.from("warranty_contract_projections").select("*", { count: "exact", head: true }).gt("expires_at", now.toISOString()).lte("expires_at", expiringAt.toISOString())),
      count(admin.from("warranty_works").select("*", { count: "exact", head: true }).in("status", ["requested", "in_progress", "qc", "completion_pending", "cancellation_requested"])),
      count(admin.from("warranty_exception_requests").select("*", { count: "exact", head: true }).eq("status", "pending")),
      count(admin.from("warranty_erp_outbox").select("*", { count: "exact", head: true }).eq("status", "failed")),
      count(admin.from("warranty_erp_outbox").select("*", { count: "exact", head: true }).eq("status", "dead_letter")),
      count(admin.from("warranty_activation_outbox").select("*", { count: "exact", head: true }).eq("status", "failed")),
      count(admin.from("warranty_activation_outbox").select("*", { count: "exact", head: true }).eq("status", "dead_letter")),
      admin.from("warranty_event_inbox").select("applied_at").order("applied_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (lastInbound.error) throw lastInbound.error;
    return NextResponse.json({
      data: {
        active_contracts: activeContracts,
        expiring_within_30_days: expiringContracts,
        active_works: activeWorks,
        pending_exceptions: pendingExceptions,
        failed_outbox: failedWorkOutbox + failedActivationOutbox,
        dead_letter_outbox: deadWorkOutbox + deadActivationOutbox,
        last_synced_at: lastInbound.data?.applied_at ?? null,
      },
    });
  } catch (error) {
    console.error("[GET /api/warranty/summary]", error);
    return NextResponse.json({ error: "Ringkasan Garansi tidak dapat dimuat" }, { status: 500 });
  }
}
