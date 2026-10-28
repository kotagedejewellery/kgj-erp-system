import { createAdminClient } from "@/lib/supabase/admin";

const APPROVAL_LOCK_TIMEOUT_MS = 15_000;
const APPROVAL_LOCK_MAX_ATTEMPTS = 8;

export type ApprovalLockJob = {
  orderId: string;
  legacyId: number;
  kodeOrder: string;
  approvedAt: string;
};

export type ApprovalLockResult = {
  status: "synced" | "failed";
  httpStatus: number | null;
  error: string | null;
};

export function buildApprovalLockPayload(job: ApprovalLockJob) {
  return {
    event: "spv_cs_approved_lock",
    order_id: job.legacyId,
    kode_order: job.kodeOrder,
    approved_at: job.approvedAt,
  };
}

function nextRetryAt(attempt: number): string {
  return new Date(
    Date.now() + Math.min(5 * 2 ** Math.max(attempt - 1, 0), 360) * 60_000,
  ).toISOString();
}

async function updateApprovalLock(
  job: ApprovalLockJob,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("legacy_approval_lock_sync_queue")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("order_id", job.orderId);
  if (error) console.error("[approval-lock] Gagal memperbarui antrean:", error.message);
}

async function queueApprovalLock(job: ApprovalLockJob): Promise<void> {
  const { error } = await createAdminClient()
    .from("legacy_approval_lock_sync_queue")
    .upsert({
      order_id: job.orderId,
      legacy_id: job.legacyId,
      kode_order: job.kodeOrder,
      approved_at: job.approvedAt,
      status: "pending",
      attempt_count: 0,
      last_error: null,
      last_http_status: null,
      next_retry_at: new Date().toISOString(),
      synced_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "order_id" });
  if (error) throw new Error(`simpan antrean approval lock gagal: ${error.message}`);
}

async function postApprovalLock(
  job: ApprovalLockJob,
  previousAttempts: number,
): Promise<ApprovalLockResult> {
  const attempt = previousAttempts + 1;
  const baseUrl = process.env.LIVE_SYSTEM_BASE_URL;
  const apiKey = process.env.INTEGRATED_SYSTEM_WEBHOOK_SECRET;

  if (!baseUrl || !apiKey) {
    const error = "LIVE_SYSTEM_BASE_URL / INTEGRATED_SYSTEM_WEBHOOK_SECRET belum diset";
    await updateApprovalLock(job, {
      status: "failed",
      attempt_count: attempt,
      last_error: error,
      last_http_status: null,
      next_retry_at: nextRetryAt(attempt),
    });
    return { status: "failed", httpStatus: null, error };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), APPROVAL_LOCK_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/api/order-lock/spv-approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify(buildApprovalLockPayload(job)),
      signal: controller.signal,
    });
    const responseBody = (await response.text().catch(() => "")).slice(0, 1_000);
    if (response.ok) {
      await updateApprovalLock(job, {
        status: "synced",
        attempt_count: attempt,
        last_error: null,
        last_http_status: response.status,
        next_retry_at: null,
        synced_at: new Date().toISOString(),
      });
      return { status: "synced", httpStatus: response.status, error: null };
    }

    const error = `HTTP ${response.status}${responseBody ? `: ${responseBody}` : ""}`;
    await updateApprovalLock(job, {
      status: "failed",
      attempt_count: attempt,
      last_error: error,
      last_http_status: response.status,
      next_retry_at: nextRetryAt(attempt),
    });
    return { status: "failed", httpStatus: response.status, error };
  } catch (cause) {
    const error = cause instanceof Error && cause.name === "AbortError"
      ? `timeout setelah ${APPROVAL_LOCK_TIMEOUT_MS / 1_000}s`
      : cause instanceof Error
        ? cause.message
        : String(cause);
    await updateApprovalLock(job, {
      status: "failed",
      attempt_count: attempt,
      last_error: error,
      last_http_status: null,
      next_retry_at: nextRetryAt(attempt),
    });
    return { status: "failed", httpStatus: null, error };
  } finally {
    clearTimeout(timeout);
  }
}

export async function pushApprovalLockToYii2(job: ApprovalLockJob): Promise<ApprovalLockResult> {
  await queueApprovalLock(job);
  return postApprovalLock(job, 0);
}

type RetryRow = {
  order_id: string;
  legacy_id: number;
  kode_order: string;
  approved_at: string;
  attempt_count: number;
};

export async function retryPendingApprovalLocks(limit = 25): Promise<{
  retried: number;
  synced: number;
  failed: number;
  exhausted: number;
}> {
  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("legacy_approval_lock_sync_queue")
    .select("order_id, legacy_id, kode_order, approved_at, attempt_count")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`query antrean approval lock gagal: ${error.message}`);

  const result = { retried: 0, synced: 0, failed: 0, exhausted: 0 };
  for (const row of (rows ?? []) as RetryRow[]) {
    if (row.attempt_count >= APPROVAL_LOCK_MAX_ATTEMPTS) {
      await db
        .from("legacy_approval_lock_sync_queue")
        .update({ status: "exhausted", updated_at: new Date().toISOString() })
        .eq("order_id", row.order_id);
      result.exhausted++;
      continue;
    }

    result.retried++;
    const delivery = await postApprovalLock({
      orderId: row.order_id,
      legacyId: row.legacy_id,
      kodeOrder: row.kode_order,
      approvedAt: row.approved_at,
    }, row.attempt_count);
    if (delivery.status === "synced") result.synced++;
    else result.failed++;
  }

  return result;
}
