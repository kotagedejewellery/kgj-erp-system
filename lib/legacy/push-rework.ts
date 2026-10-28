import { createAdminClient } from "@/lib/supabase/admin";

const REWORK_SYNC_TIMEOUT_MS = 15_000;
const REWORK_SYNC_MAX_ATTEMPTS = 8;

export type ReworkSyncJob = {
  intakeId: string;
  legacyId: number;
  kodeOrder: string;
  requestId: string;
  reason: string;
  requestedAt: string;
};

export type ReworkSyncResult = {
  status: "synced" | "failed";
  httpStatus: number | null;
  error: string | null;
};

export function buildReworkRequestPayload(job: ReworkSyncJob) {
  return {
    event: "spv_cs_rework_requested",
    request_id: job.requestId,
    order_id: job.legacyId,
    kode_order: job.kodeOrder,
    reason: job.reason,
    requested_at: job.requestedAt,
  };
}

function nextRetryAt(attempt: number): string {
  return new Date(
    Date.now() + Math.min(5 * 2 ** Math.max(attempt - 1, 0), 360) * 60_000,
  ).toISOString();
}

async function updateReworkSync(
  job: ReworkSyncJob,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("legacy_order_intakes")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", job.intakeId)
    .eq("rework_request_id", job.requestId);

  if (error) console.error("[rework-sync] Gagal memperbarui antrean:", error.message);
}

async function postReworkSync(
  job: ReworkSyncJob,
  previousAttempts: number,
): Promise<ReworkSyncResult> {
  const attempt = previousAttempts + 1;
  const baseUrl = process.env.LIVE_SYSTEM_BASE_URL;
  const apiKey = process.env.INTEGRATED_SYSTEM_WEBHOOK_SECRET;

  if (!baseUrl || !apiKey) {
    const error = "LIVE_SYSTEM_BASE_URL / INTEGRATED_SYSTEM_WEBHOOK_SECRET belum diset";
    await updateReworkSync(job, {
      rework_sync_status: "failed",
      rework_sync_attempt_count: attempt,
      rework_last_error: error,
      rework_last_http_status: null,
      rework_next_retry_at: nextRetryAt(attempt),
    });
    return { status: "failed", httpStatus: null, error };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REWORK_SYNC_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/order-rework/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify(buildReworkRequestPayload(job)),
      signal: controller.signal,
    });
    const responseBody = (await response.text().catch(() => "")).slice(0, 1_000);

    if (response.ok) {
      await updateReworkSync(job, {
        rework_sync_status: "synced",
        rework_sync_attempt_count: attempt,
        rework_last_error: null,
        rework_last_http_status: response.status,
        rework_next_retry_at: null,
        rework_synced_at: new Date().toISOString(),
      });
      return { status: "synced", httpStatus: response.status, error: null };
    }

    const error = `HTTP ${response.status}${responseBody ? `: ${responseBody}` : ""}`;
    await updateReworkSync(job, {
      rework_sync_status: "failed",
      rework_sync_attempt_count: attempt,
      rework_last_error: error,
      rework_last_http_status: response.status,
      rework_next_retry_at: nextRetryAt(attempt),
    });
    return { status: "failed", httpStatus: response.status, error };
  } catch (cause) {
    const error =
      cause instanceof Error && cause.name === "AbortError"
        ? `timeout setelah ${REWORK_SYNC_TIMEOUT_MS / 1_000}s`
        : cause instanceof Error
          ? cause.message
          : String(cause);
    await updateReworkSync(job, {
      rework_sync_status: "failed",
      rework_sync_attempt_count: attempt,
      rework_last_error: error,
      rework_last_http_status: null,
      rework_next_retry_at: nextRetryAt(attempt),
    });
    return { status: "failed", httpStatus: null, error };
  } finally {
    clearTimeout(timeout);
  }
}

export async function pushReworkRequestToYii2(job: ReworkSyncJob): Promise<ReworkSyncResult> {
  return postReworkSync(job, 0);
}

type RetryRow = {
  id: string;
  legacy_order_id: string;
  reason: string | null;
  rework_request_id: string | null;
  rework_requested_at: string | null;
  rework_sync_attempt_count: number;
};

export async function retryPendingReworkSyncs(limit = 25): Promise<{
  retried: number;
  synced: number;
  failed: number;
  exhausted: number;
}> {
  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("legacy_order_intakes")
    .select("id, legacy_order_id, reason, rework_request_id, rework_requested_at, rework_sync_attempt_count")
    .eq("state", "returned_for_revision")
    .in("rework_sync_status", ["pending", "failed"])
    .lte("rework_next_retry_at", new Date().toISOString())
    .order("rework_next_retry_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`query antrean rework gagal: ${error.message}`);

  const result = { retried: 0, synced: 0, failed: 0, exhausted: 0 };
  for (const row of (rows ?? []) as RetryRow[]) {
    if (row.rework_sync_attempt_count >= REWORK_SYNC_MAX_ATTEMPTS) {
      await db
        .from("legacy_order_intakes")
        .update({ rework_sync_status: "exhausted", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("rework_request_id", row.rework_request_id);
      result.exhausted++;
      continue;
    }

    if (!row.reason || !row.rework_request_id || !row.rework_requested_at) {
      await db
        .from("legacy_order_intakes")
        .update({
          rework_sync_status: "exhausted",
          rework_last_error: "Data permintaan rework tidak lengkap",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      result.exhausted++;
      continue;
    }

    const { data: order, error: orderError } = await db
      .from("legacy_orders")
      .select("legacy_id, kode_order")
      .eq("id", row.legacy_order_id)
      .maybeSingle();
    if (orderError || !order) {
      await db
        .from("legacy_order_intakes")
        .update({
          rework_sync_status: "failed",
          rework_sync_attempt_count: row.rework_sync_attempt_count + 1,
          rework_last_error: orderError?.message ?? "Order sumber tidak ditemukan",
          rework_next_retry_at: nextRetryAt(row.rework_sync_attempt_count + 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("rework_request_id", row.rework_request_id);
      result.failed++;
      continue;
    }

    result.retried++;
    const delivery = await postReworkSync({
      intakeId: row.id,
      legacyId: order.legacy_id as number,
      kodeOrder: order.kode_order as string,
      requestId: row.rework_request_id,
      reason: row.reason,
      requestedAt: row.rework_requested_at,
    }, row.rework_sync_attempt_count);
    if (delivery.status === "synced") result.synced++;
    else result.failed++;
  }

  return result;
}
