import { createWarrantySignature, getWarrantyRetryDelayMs } from "@/lib/warranty/push-activation";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifySupervisors } from "@/lib/notifications";

const EVENT_PATH = "/api/warranty/v1/events";

type OutboxRow = { event_id: string; payload: Record<string, unknown>; attempt_count: number };

export async function retryPendingWarrantyWorkUpdates(limit = 10) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("warranty_erp_outbox")
    .select("event_id, payload, attempt_count")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`query outbox Warranty Work gagal: ${error.message}`);

  const result = { retried: 0, delivered: 0, failed: 0, deadLetter: 0 };
  for (const row of (data ?? []) as OutboxRow[]) {
    result.retried++;
    const attempt = row.attempt_count + 1;
    let httpStatus: number | null = null;
    let deliveryError: string | null = null;
    try {
      const baseUrl = process.env.WARRANTY_YII2_BASE_URL;
      const secret = process.env.WARRANTY_MAIN_ERP_SECRET;
      if (!baseUrl || !secret) throw new Error("WARRANTY_YII2_BASE_URL / WARRANTY_MAIN_ERP_SECRET belum diset");
      const body = JSON.stringify(row.payload);
      const timestamp = new Date().toISOString();
      const response = await fetch(new URL(EVENT_PATH, baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Warranty-Key-Id": process.env.WARRANTY_MAIN_ERP_KEY_ID || "main-erp",
          "X-Warranty-Timestamp": timestamp,
          "X-Warranty-Signature": `v1=${createWarrantySignature(secret, timestamp, body)}`,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      httpStatus = response.status;
      if (response.status === 202) {
        await db.from("warranty_erp_outbox").update({ status: "delivered", attempt_count: attempt, last_error: null, last_http_status: httpStatus, next_retry_at: null, delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("event_id", row.event_id);
        result.delivered++;
        continue;
      }
      deliveryError = `HTTP ${response.status}`;
    } catch (cause) {
      deliveryError = cause instanceof Error ? cause.message : String(cause);
    }
    const deadLetter = attempt >= 12;
    await db.from("warranty_erp_outbox").update({ status: deadLetter ? "dead_letter" : "failed", attempt_count: attempt, last_error: deliveryError, last_http_status: httpStatus, next_retry_at: deadLetter ? null : new Date(Date.now() + getWarrantyRetryDelayMs(attempt)).toISOString(), updated_at: new Date().toISOString() }).eq("event_id", row.event_id);
    if (attempt === 3 || deadLetter) {
      await notifySupervisors(
        "operational_supervisor",
        "Integrasi Garansi perlu perhatian",
        deadLetter ? "Event Warranty Work masuk dead-letter." : "Pengiriman event Warranty Work gagal tiga kali.",
        "error",
        "/dashboard/supervisor/warranty",
      );
    }
    if (deadLetter) result.deadLetter++;
    else result.failed++;
  }
  return result;
}
