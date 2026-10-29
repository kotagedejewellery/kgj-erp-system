import { createHash, createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifySupervisors } from "@/lib/notifications";

const WARRANTY_EVENT_PATH = "/api/warranty/v1/events";
const WARRANTY_EVENT_TIMEOUT_MS = 15_000;
const WARRANTY_EVENT_MAX_ATTEMPTS = 12;

type WarrantyActivationOutboxRow = {
  event_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
};

type WarrantyDelivery = {
  status: "delivered" | "failed" | "dead_letter";
  httpStatus: number | null;
  error: string | null;
};

export function createWarrantySignature(secret: string, timestamp: string, body: string): string {
  return createWarrantyPathSignature(secret, WARRANTY_EVENT_PATH, timestamp, body);
}

export function createWarrantyPathSignature(
  secret: string,
  path: string,
  timestamp: string,
  body: string,
): string {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonical = `POST\n${path}\n${timestamp}\n${bodyHash}`;
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function isValidWarrantySignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string | null,
): boolean {
  if (!signature) return false;
  const expected = Buffer.from(`v1=${createWarrantySignature(secret, timestamp, body)}`);
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getWarrantyRetryDelayMs(attempt: number): number {
  const delays = [30_000, 60_000, 120_000, 240_000, 480_000, 960_000, 1_920_000];
  return delays[Math.max(0, attempt - 1)] ?? 3_600_000;
}

function nextRetryAt(attempt: number): string {
  return new Date(Date.now() + getWarrantyRetryDelayMs(attempt)).toISOString();
}

function warrantyEventUrl(baseUrl: string): string {
  return new URL(WARRANTY_EVENT_PATH, baseUrl).toString();
}

async function updateOutbox(
  eventId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("warranty_activation_outbox")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("event_id", eventId);
  if (error) console.error("[warranty-activation] Gagal memperbarui outbox:", error.message);
}

async function failDelivery(
  row: WarrantyActivationOutboxRow,
  error: string,
  httpStatus: number | null,
): Promise<WarrantyDelivery> {
  const attempt = row.attempt_count + 1;
  const isDeadLetter = attempt >= WARRANTY_EVENT_MAX_ATTEMPTS;
  await updateOutbox(row.event_id, {
    status: isDeadLetter ? "dead_letter" : "failed",
    attempt_count: attempt,
    last_error: error,
    last_http_status: httpStatus,
    next_retry_at: isDeadLetter ? null : nextRetryAt(attempt),
  });
  if (attempt >= 3) {
    console.error("[warranty-activation] Pengiriman membutuhkan perhatian:", {
      eventId: row.event_id,
      attempt,
      status: isDeadLetter ? "dead_letter" : "failed",
    });
    if (attempt === 3 || isDeadLetter) {
      await notifySupervisors(
        "operational_supervisor",
        "Integrasi Garansi perlu perhatian",
        isDeadLetter ? "Event aktivasi Garansi masuk dead-letter." : "Pengiriman event aktivasi Garansi gagal tiga kali.",
        "error",
        "/dashboard/supervisor/warranty",
      );
    }
  }
  return { status: isDeadLetter ? "dead_letter" : "failed", httpStatus, error };
}

async function deliverWarrantyActivation(
  row: WarrantyActivationOutboxRow,
): Promise<WarrantyDelivery> {
  const baseUrl = process.env.WARRANTY_YII2_BASE_URL;
  const secret = process.env.WARRANTY_MAIN_ERP_SECRET;
  if (!baseUrl || !secret) {
    return failDelivery(
      row,
      "WARRANTY_YII2_BASE_URL / WARRANTY_MAIN_ERP_SECRET belum diset",
      null,
    );
  }

  const body = JSON.stringify(row.payload);
  const timestamp = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WARRANTY_EVENT_TIMEOUT_MS);
  try {
    const response = await fetch(warrantyEventUrl(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Warranty-Key-Id": process.env.WARRANTY_MAIN_ERP_KEY_ID || "main-erp",
        "X-Warranty-Timestamp": timestamp,
        "X-Warranty-Signature": `v1=${createWarrantySignature(secret, timestamp, body)}`,
      },
      body,
      signal: controller.signal,
    });
    const responseBody = (await response.text().catch(() => "")).slice(0, 1_000);
    if (response.status === 202) {
      await updateOutbox(row.event_id, {
        status: "delivered",
        attempt_count: row.attempt_count + 1,
        last_error: null,
        last_http_status: response.status,
        next_retry_at: null,
        delivered_at: new Date().toISOString(),
      });
      return { status: "delivered", httpStatus: response.status, error: null };
    }
    return failDelivery(
      row,
      `HTTP ${response.status}${responseBody ? `: ${responseBody}` : ""}`,
      response.status,
    );
  } catch (cause) {
    const error = cause instanceof Error && cause.name === "AbortError"
      ? `timeout setelah ${WARRANTY_EVENT_TIMEOUT_MS / 1_000}s`
      : cause instanceof Error
        ? cause.message
        : String(cause);
    return failDelivery(row, error, null);
  } finally {
    clearTimeout(timeout);
  }
}

export async function retryPendingWarrantyActivations(limit = 10): Promise<{
  retried: number;
  delivered: number;
  failed: number;
  deadLetter: number;
}> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("warranty_activation_outbox")
    .select("event_id, payload, attempt_count")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`query outbox Warranty gagal: ${error.message}`);

  const result = { retried: 0, delivered: 0, failed: 0, deadLetter: 0 };
  for (const row of (data ?? []) as WarrantyActivationOutboxRow[]) {
    result.retried++;
    const delivery = await deliverWarrantyActivation(row);
    if (delivery.status === "delivered") result.delivered++;
    else if (delivery.status === "dead_letter") result.deadLetter++;
    else result.failed++;
  }
  return result;
}
