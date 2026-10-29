import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const outboxTables = {
  activation: "warranty_activation_outbox",
  work: "warranty_erp_outbox",
} as const;

type OutboxSource = keyof typeof outboxTables;

function isOutboxSource(value: unknown): value is OutboxSource {
  return value === "activation" || value === "work";
}

function text(value: unknown, maximumLength = 120) {
  return typeof value === "string" && value.trim() && value.trim().length <= maximumLength ? value.trim() : null;
}

async function integrationAdmin() {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("users")
    .select("id, status, role:roles!users_role_id_fkey(name)")
    .eq("id", user.id).is("deleted_at", null).single();
  if (!profile || profile.status !== "active" || getRoleProps(profile).name !== "superadmin") return null;
  return { admin, userId: user.id };
}

export async function GET() {
  const actor = await integrationAdmin();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [activation, work, unresolvedExceptions] = await Promise.all([
    actor.admin.from("warranty_activation_outbox")
      .select("event_id, event_type, attempt_count, last_error, last_http_status, created_at, updated_at")
      .eq("status", "dead_letter").order("updated_at", { ascending: true }),
    actor.admin.from("warranty_erp_outbox")
      .select("event_id, event_type, attempt_count, last_error, last_http_status, created_at, updated_at")
      .eq("status", "dead_letter").order("updated_at", { ascending: true }),
    actor.admin.from("warranty_exception_requests")
      .select("exception_request_id, claim_reference, reason, created_at")
      .eq("status", "pending").is("requested_by", null).order("created_at", { ascending: true }),
  ]);
  const error = activation.error ?? work.error ?? unresolvedExceptions.error;
  if (error) {
    console.error("[GET /api/warranty/integration]", error);
    return NextResponse.json({ error: "Status integrasi Garansi tidak dapat dimuat" }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      dead_letters: [
        ...(activation.data ?? []).map((row) => ({ ...row, source: "activation" })),
        ...(work.data ?? []).map((row) => ({ ...row, source: "work" })),
      ],
      unresolved_exceptions: unresolvedExceptions.data ?? [],
    },
  });
}

export async function POST(request: Request) {
  const actor = await integrationAdmin();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;

  if (body?.action === "retry_outbox") {
    const source = body.source;
    const eventId = text(body.event_id);
    if (!isOutboxSource(source) || !eventId) return NextResponse.json({ error: "Event outbox tidak valid" }, { status: 400 });
    const { data, error } = await actor.admin.from(outboxTables[source])
      .update({
        status: "pending",
        attempt_count: 0,
        last_error: null,
        last_http_status: null,
        next_retry_at: new Date().toISOString(),
        delivered_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", eventId)
      .eq("status", "dead_letter")
      .select("event_id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Event tidak dapat diantrekan ulang" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Event dead-letter tidak ditemukan" }, { status: 404 });
    await actor.admin.from("activity_logs").insert({
      user_id: actor.userId,
      action: "WARRANTY_OUTBOX_RETRIED",
      entity_type: "warranty_outbox",
      entity_id: eventId,
      new_data: { source },
    });
    return NextResponse.json({ success: true, data: { event_id: eventId } });
  }

  if (body?.action === "recover_exception_requester") {
    const exceptionRequestId = text(body.exception_request_id);
    if (!exceptionRequestId) return NextResponse.json({ error: "Exception tidak valid" }, { status: 400 });
    const { data: pendingRequest, error: requestError } = await actor.admin.from("warranty_exception_requests")
      .select("requested_by").eq("exception_request_id", exceptionRequestId).eq("status", "pending").maybeSingle();
    if (requestError) return NextResponse.json({ error: "Exception tidak dapat diperiksa" }, { status: 500 });
    if (!pendingRequest) return NextResponse.json({ error: "Exception pending tidak ditemukan" }, { status: 404 });
    if (pendingRequest.requested_by) return NextResponse.json({ error: "Identitas pemohon sudah tersedia" }, { status: 409 });

    const { data: auditRows, error: auditError } = await actor.admin.from("activity_logs")
      .select("user_id")
      .eq("action", "WARRANTY_EXCEPTION_REQUESTED")
      .eq("entity_type", "warranty_exception_request")
      .eq("entity_id", exceptionRequestId);
    if (auditError) return NextResponse.json({ error: "Audit Exception tidak dapat diperiksa" }, { status: 500 });
    const requesterIds = [...new Set((auditRows ?? []).map((row) => row.user_id).filter(Boolean))];
    if (requesterIds.length !== 1) {
      return NextResponse.json({ error: "Identitas pemohon tidak dapat dipulihkan dengan aman" }, { status: 422 });
    }
    const requesterId = requesterIds[0];
    const { data: actorLink, error: actorError } = await actor.admin.from("warranty_exception_request_actors")
      .select("requested_by").eq("exception_request_id", exceptionRequestId).maybeSingle();
    if (actorError) return NextResponse.json({ error: "Identitas pemohon tidak dapat diperiksa" }, { status: 500 });
    if (actorLink && actorLink.requested_by !== requesterId) {
      return NextResponse.json({ error: "Identitas pemohon tidak konsisten dengan audit" }, { status: 409 });
    }
    if (!actorLink) {
      const { error } = await actor.admin.from("warranty_exception_request_actors").insert({
        exception_request_id: exceptionRequestId,
        requested_by: requesterId,
      });
      if (error) return NextResponse.json({ error: "Identitas pemohon tidak dapat dipulihkan" }, { status: 500 });
    }
    const { error: updateError } = await actor.admin.from("warranty_exception_requests")
      .update({ requested_by: requesterId, updated_at: new Date().toISOString() })
      .eq("exception_request_id", exceptionRequestId).is("requested_by", null);
    if (updateError) return NextResponse.json({ error: "Exception tidak dapat diperbarui" }, { status: 500 });
    await actor.admin.from("activity_logs").insert({
      user_id: actor.userId,
      action: "WARRANTY_EXCEPTION_REQUESTER_RECOVERED",
      entity_type: "warranty_exception_request",
      entity_id: exceptionRequestId,
      new_data: { requested_by: requesterId },
    });
    return NextResponse.json({ success: true, data: { exception_request_id: exceptionRequestId } });
  }

  return NextResponse.json({ error: "Aksi integrasi tidak valid" }, { status: 400 });
}
