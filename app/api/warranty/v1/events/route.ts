import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidWarrantySignature } from "@/lib/warranty/push-activation";

const MAX_TIMESTAMP_SKEW_MS = 5 * 60_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredTimestamp(value: unknown): string | null {
  const timestamp = requiredText(value);
  return timestamp && Number.isFinite(Date.parse(timestamp)) ? timestamp : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function POST(request: Request) {
  const secret = process.env.WARRANTY_YII2_SECRET;
  if (!secret) {
    console.error("[POST /api/warranty/v1/events] WARRANTY_YII2_SECRET is not set");
    return NextResponse.json({ error: "Webhook belum dikonfigurasi" }, { status: 500 });
  }

  const timestamp = request.headers.get("x-warranty-timestamp");
  const signature = request.headers.get("x-warranty-signature");
  if (request.headers.get("x-warranty-key-id") !== "yii2" || !timestamp) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const parsedTimestamp = Date.parse(timestamp);
  if (!Number.isFinite(parsedTimestamp) || Math.abs(Date.now() - parsedTimestamp) > MAX_TIMESTAMP_SKEW_MS) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const rawBody = await request.text();
  if (!isValidWarrantySignature(secret, timestamp, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody) as Record<string, unknown>;
    const order = event.order as Record<string, unknown> | null;
    const data = event.data as Record<string, unknown> | null;
    const eventId = requiredText(event.event_id);
    const occurredAt = requiredTimestamp(event.occurred_at);
    const orderSourceId = requiredText(order?.source_id);
    const orderReference = requiredText(order?.reference);
    if (event.schema_version !== 1 || !eventId || !UUID_PATTERN.test(eventId) || !occurredAt || !orderSourceId || !orderReference) {
      return NextResponse.json({ error: "Payload Warranty tidak valid" }, { status: 400 });
    }

    const admin = createAdminClient();
    let result: string | null = null;
    let error: { message: string } | null = null;
    if (event.event_type === "warranty_contract_activated") {
      const contractReference = requiredText(data?.contract_reference);
      const unitCode = requiredText(data?.unit_code);
      const brandCode = requiredText(data?.brand_code);
      const activatedAt = requiredTimestamp(data?.activated_at);
      const expiresAt = requiredTimestamp(data?.expires_at);
      if (!contractReference || !unitCode || !brandCode || !activatedAt || !expiresAt) {
        return NextResponse.json({ error: "Payload Warranty tidak valid" }, { status: 400 });
      }
      const response = await admin.rpc("apply_warranty_contract_activated", {
        p_source: "yii2",
        p_event_id: eventId,
        p_order_source_id: orderSourceId,
        p_order_reference: orderReference,
        p_contract_reference: contractReference,
        p_unit_code: unitCode,
        p_brand_code: brandCode,
        p_activated_at: activatedAt,
        p_expires_at: expiresAt,
        p_payload: event,
      });
      result = response.data;
      error = response.error;
    } else if (event.event_type === "warranty_claim_changed") {
      const claimReference = requiredText(event.claim_reference);
      const claimVersion = nonNegativeInteger(data?.claim_version);
      const canonicalStatus = requiredText(data?.canonical_status);
      const entitlement = data?.entitlement_snapshot as Record<string, unknown> | null;
      const quotaInitial = nonNegativeInteger(entitlement?.quota_initial);
      const approvedGrant = nonNegativeInteger(entitlement?.approved_grant);
      const quotaUsed = nonNegativeInteger(entitlement?.quota_used);
      const quotaReserved = nonNegativeInteger(entitlement?.quota_reserved);
      const quotaAvailable = nonNegativeInteger(entitlement?.quota_available);
      if (!claimReference || !claimVersion || !canonicalStatus || quotaInitial === null || approvedGrant === null || quotaUsed === null || quotaReserved === null || quotaAvailable === null) {
        return NextResponse.json({ error: "Payload Warranty tidak valid" }, { status: 400 });
      }
      const response = await admin.rpc("apply_warranty_claim_changed", {
        p_source: "yii2",
        p_event_id: eventId,
        p_order_source_id: orderSourceId,
        p_order_reference: orderReference,
        p_claim_reference: claimReference,
        p_claim_version: claimVersion,
        p_canonical_status: canonicalStatus,
        p_quota_initial: quotaInitial,
        p_approved_grant: approvedGrant,
        p_quota_used: quotaUsed,
        p_quota_reserved: quotaReserved,
        p_quota_available: quotaAvailable,
        p_payload: event,
      });
      result = response.data;
      error = response.error;
    } else {
      return NextResponse.json({ error: "Payload Warranty tidak valid" }, { status: 400 });
    }
    if (error) {
      if (error.message === "order_identity_mismatch") {
        return NextResponse.json({ error: "order_identity_mismatch" }, { status: 422 });
      }
      throw error;
    }

    return NextResponse.json({ schema_version: 1, event_id: eventId, status: result }, { status: 202 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload Warranty tidak valid" }, { status: 400 });
    }
    console.error("[POST /api/warranty/v1/events]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
