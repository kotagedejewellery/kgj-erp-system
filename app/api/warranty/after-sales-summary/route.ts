import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  hasWarrantyPermission,
  WARRANTY_CLAIM_READ_PERMISSION,
  WARRANTY_CONTRACT_READ_PERMISSION,
} from "@/lib/warranty/permissions";

type ActivationQueueItem = {
  status: string;
  updated_at: string;
  order: { kode_order: string } | { kode_order: string }[] | null;
};

async function afterSalesReader() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("users")
    .select("id, status, role:roles!users_role_id_fkey(name, permissions)")
    .eq("id", user.id).is("deleted_at", null).single();
  if (!profile || profile.status !== "active") return null;
  const role = getRoleProps(profile);
  if (role.name !== "superadmin" && (
    role.name !== "after_sales"
    || !hasWarrantyPermission(role.permissions, WARRANTY_CONTRACT_READ_PERMISSION)
    || !hasWarrantyPermission(role.permissions, WARRANTY_CLAIM_READ_PERMISSION)
  )) return null;
  return admin;
}

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count: total, error } = await query;
  if (error) throw error;
  return total ?? 0;
}

export async function GET() {
  try {
    const admin = await afterSalesReader();
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const now = new Date();
    const expiringAt = new Date(now);
    expiringAt.setDate(expiringAt.getDate() + 30);
    const [activeContracts, expiringContracts, pendingActivations, activeClaims, activationQueue, lastInbound] = await Promise.all([
      count(admin.from("warranty_contract_projections").select("*", { count: "exact", head: true }).gt("expires_at", now.toISOString())),
      count(admin.from("warranty_contract_projections").select("*", { count: "exact", head: true }).gt("expires_at", now.toISOString()).lte("expires_at", expiringAt.toISOString())),
      count(admin.from("warranty_activation_outbox").select("*", { count: "exact", head: true }).in("status", ["pending", "failed"])),
      count(admin.from("warranty_claim_projections").select("*", { count: "exact", head: true }).not("canonical_status", "in", "(completed,cancelled)")),
      admin.from("warranty_activation_outbox")
        .select("status, updated_at, order:legacy_orders!warranty_activation_outbox_order_id_fkey(kode_order)")
        .in("status", ["pending", "failed"])
        .order("updated_at", { ascending: false })
        .limit(5),
      admin.from("warranty_event_inbox").select("applied_at").order("applied_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (activationQueue.error ?? lastInbound.error) throw activationQueue.error ?? lastInbound.error;

    return NextResponse.json({
      data: {
        active_contracts: activeContracts,
        expiring_within_30_days: expiringContracts,
        pending_activations: pendingActivations,
        active_claims: activeClaims,
        activation_queue: ((activationQueue.data ?? []) as ActivationQueueItem[]).map((item) => ({
          order_reference: Array.isArray(item.order) ? item.order[0]?.kode_order : item.order?.kode_order,
          status: item.status,
          updated_at: item.updated_at,
        })).filter((item) => item.order_reference),
        last_synced_at: lastInbound.data?.applied_at ?? null,
      },
    });
  } catch (error) {
    console.error("[GET /api/warranty/after-sales-summary] Error:", error);
    return NextResponse.json({ error: "Ringkasan After Sales tidak dapat dimuat" }, { status: 500 });
  }
}
