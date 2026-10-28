import { createAdminClient } from "@/lib/supabase/admin";
import { stageToYii2Status } from "@/lib/legacy/reverse-map";

const STATUS_SYNC_TIMEOUT_MS = 15_000;
const STATUS_SYNC_MAX_ATTEMPTS = 8;

export type StatusSyncJob = {
  orderId: string;
  legacyId: number;
  stage: string;
  idStatus: number;
};

export type StatusSyncResult = {
  status: "synced" | "failed" | "skipped";
  httpStatus: number | null;
  error: string | null;
};

type QueueRow = {
  order_id: string;
  legacy_id: number;
  stage: string;
  id_status: number;
  attempt_count: number;
};

export function buildStatusSyncJob(
  orderId: string,
  legacyId: number | null | undefined,
  stage: string,
): StatusSyncJob | null {
  const idStatus = stageToYii2Status(stage);
  if (legacyId == null || idStatus == null) return null;
  return { orderId, legacyId, stage, idStatus };
}

export function getStatusSyncRetryDelayMinutes(attempt: number): number {
  return Math.min(5 * 2 ** Math.max(attempt - 1, 0), 360);
}

function nextRetryAt(attempt: number): string {
  return new Date(
    Date.now() + getStatusSyncRetryDelayMinutes(attempt) * 60_000,
  ).toISOString();
}

async function queueStatusSyncJob(job: StatusSyncJob): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("legacy_status_sync_queue")
    .upsert(
      {
        order_id: job.orderId,
        legacy_id: job.legacyId,
        stage: job.stage,
        id_status: job.idStatus,
        status: "pending",
        attempt_count: 0,
        last_error: null,
        last_http_status: null,
        last_response: null,
        next_retry_at: now,
        synced_at: null,
        updated_at: now,
      },
      { onConflict: "order_id" },
    );

  if (error) console.error("[status-sync] Gagal menyimpan antrean:", error.message);
}

async function updateStatusSyncJob(
  job: StatusSyncJob,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("legacy_status_sync_queue")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("order_id", job.orderId)
    .eq("stage", job.stage)
    .eq("id_status", job.idStatus);

  if (error) console.error("[status-sync] Gagal memperbarui antrean:", error.message);
}

async function postStatusSyncJob(
  job: StatusSyncJob,
  previousAttempts: number,
): Promise<StatusSyncResult> {
  const attempt = previousAttempts + 1;
  const baseUrl = process.env.LIVE_SYSTEM_BASE_URL;
  const apiKey = process.env.INTEGRATED_SYSTEM_WEBHOOK_SECRET;

  if (!baseUrl || !apiKey) {
    const error = "LIVE_SYSTEM_BASE_URL / INTEGRATED_SYSTEM_WEBHOOK_SECRET belum diset";
    await updateStatusSyncJob(job, {
      status: "failed",
      attempt_count: attempt,
      last_error: error,
      next_retry_at: nextRetryAt(attempt),
    });
    return { status: "failed", httpStatus: null, error };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_SYNC_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/order-sync/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({
        event: "status_update",
        order_id: job.legacyId,
        id_status: job.idStatus,
      }),
      signal: controller.signal,
    });
    const responseBody = (await response.text().catch(() => "")).slice(0, 1_000);

    if (response.ok) {
      await updateStatusSyncJob(job, {
        status: "synced",
        attempt_count: attempt,
        last_error: null,
        last_http_status: response.status,
        last_response: responseBody || null,
        next_retry_at: null,
        synced_at: new Date().toISOString(),
      });
      console.info("[status-sync] Yii2 tersinkron", {
        orderId: job.orderId,
        legacyId: job.legacyId,
        stage: job.stage,
        idStatus: job.idStatus,
        httpStatus: response.status,
      });
      return { status: "synced", httpStatus: response.status, error: null };
    }

    const error = `HTTP ${response.status}${responseBody ? `: ${responseBody}` : ""}`;
    await updateStatusSyncJob(job, {
      status: "failed",
      attempt_count: attempt,
      last_error: error,
      last_http_status: response.status,
      last_response: responseBody || null,
      next_retry_at: nextRetryAt(attempt),
    });
    console.error("[status-sync] Yii2 menolak update", {
      orderId: job.orderId,
      legacyId: job.legacyId,
      stage: job.stage,
      idStatus: job.idStatus,
      httpStatus: response.status,
    });
    return { status: "failed", httpStatus: response.status, error };
  } catch (cause) {
    const error =
      cause instanceof Error && cause.name === "AbortError"
        ? `timeout setelah ${STATUS_SYNC_TIMEOUT_MS / 1_000}s`
        : cause instanceof Error
          ? cause.message
          : String(cause);
    await updateStatusSyncJob(job, {
      status: "failed",
      attempt_count: attempt,
      last_error: error,
      next_retry_at: nextRetryAt(attempt),
    });
    console.error("[status-sync] Push gagal", {
      orderId: job.orderId,
      legacyId: job.legacyId,
      stage: job.stage,
      idStatus: job.idStatus,
      error,
    });
    return { status: "failed", httpStatus: null, error };
  } finally {
    clearTimeout(timeout);
  }
}

export async function pushStageToYii2(
  orderId: string,
  legacyId: number | null | undefined,
  stage: string,
): Promise<StatusSyncResult> {
  const job = buildStatusSyncJob(orderId, legacyId, stage);
  if (!job) {
    console.warn("[status-sync] Dilewati karena legacy_id atau mapping stage tidak tersedia", {
      orderId,
      legacyId,
      stage,
    });
    return { status: "skipped", httpStatus: null, error: null };
  }

  await queueStatusSyncJob(job);
  return postStatusSyncJob(job, 0);
}

export async function retryPendingStatusSyncs(limit = 25): Promise<{
  retried: number;
  synced: number;
  failed: number;
  exhausted: number;
}> {
  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("legacy_status_sync_queue")
    .select("order_id, legacy_id, stage, id_status, attempt_count")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`query antrean status gagal: ${error.message}`);

  const result = { retried: 0, synced: 0, failed: 0, exhausted: 0 };
  for (const row of (rows ?? []) as QueueRow[]) {
    if (row.attempt_count >= STATUS_SYNC_MAX_ATTEMPTS) {
      await db
        .from("legacy_status_sync_queue")
        .update({ status: "exhausted", updated_at: new Date().toISOString() })
        .eq("order_id", row.order_id);
      result.exhausted++;
      continue;
    }

    result.retried++;
    const delivery = await postStatusSyncJob(
      {
        orderId: row.order_id,
        legacyId: row.legacy_id,
        stage: row.stage,
        idStatus: row.id_status,
      },
      row.attempt_count,
    );
    if (delivery.status === "synced") result.synced++;
    else result.failed++;
  }

  return result;
}

export async function backfillCurrentStatusSyncs(
  limit = 25,
  dryRun = true,
  offset = 0,
): Promise<{
  examined: number;
  eligible: number;
  queued: number;
  synced: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  nextOffset: number | null;
}> {
  const db = createAdminClient();
  const { data: orders, error: ordersError } = await db
    .from("legacy_orders")
    .select("id, legacy_id")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (ordersError) throw new Error(`query order backfill gagal: ${ordersError.message}`);

  const orderIds = (orders ?? []).map((order) => order.id as string);
  const { data: trackingRows, error: trackingError } = await db
    .from("tracking_stages")
    .select("order_id, current_stage")
    .in("order_id", orderIds);

  if (trackingError) throw new Error(`query tracking backfill gagal: ${trackingError.message}`);

  const stageByOrderId = new Map(
    (trackingRows ?? []).map((row) => [row.order_id as string, row.current_stage as string]),
  );
  const result = {
    examined: orderIds.length,
    eligible: 0,
    queued: 0,
    synced: 0,
    failed: 0,
    skipped: 0,
    dryRun,
    nextOffset: (orders ?? []).length === limit ? offset + limit : null,
  };

  for (const order of orders ?? []) {
    const job = buildStatusSyncJob(
      order.id as string,
      order.legacy_id as number | null,
      stageByOrderId.get(order.id as string) ?? "",
    );
    if (!job) {
      result.skipped++;
      continue;
    }

    result.eligible++;
    if (dryRun) continue;

    result.queued++;
    await queueStatusSyncJob(job);
    const delivery = await postStatusSyncJob(job, 0);
    if (delivery.status === "synced") result.synced++;
    else result.failed++;
  }

  return result;
}
