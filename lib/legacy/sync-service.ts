import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLegacyOrder } from "@/lib/legacy/ingest";
import { type Yii2OrderPayload } from "@/lib/legacy/adapter";

const LIVE_SYSTEM_BASE_URL = process.env.LIVE_SYSTEM_BASE_URL || "";
const LIVE_SYSTEM_API_KEY = process.env.INTEGRATED_SYSTEM_WEBHOOK_SECRET || "";

// Since for the very first pull (empty table). Uses 3 days back from now
// so the initial sync is fast — only recent orders, not the entire history.
function fullSyncSince(): string {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return `${d.toISOString().split("T")[0]} 00:00:00`;
}

type Db = ReturnType<typeof createAdminClient>;

interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

const FETCH_TIMEOUT_MS = 60_000;
const FETCH_MAX_ATTEMPTS = 2;

// Fetch with a hard timeout so a slow upstream (Yii2) can't hang the function
// until Vercel's maxDuration kills it without a traceable error.
async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface Yii2FetchResult {
  orders: Yii2OrderPayload[] | null;
  errorDetail: string | null;
}

async function fetchYii2Orders(since: string): Promise<Yii2FetchResult> {
  const url = `${LIVE_SYSTEM_BASE_URL}/api/order-sync/new-orders?since=${encodeURIComponent(since)}`;

  let lastError: string | null = null;
  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        "X-API-Key": LIVE_SYSTEM_API_KEY,
      });

      if (!response.ok) {
        const body = (await response.text().catch(() => "")).slice(0, 300);
        lastError = `HTTP ${response.status} — ${body || "(empty body)"}`;
        console.error(
          `[sync] Fetch failed (attempt ${attempt}/${FETCH_MAX_ATTEMPTS}):`,
          lastError,
          "URL:",
          url,
        );
        continue;
      }

      const responseData = (await response.json()) as {
        orders: Yii2OrderPayload[];
      };
      console.log("[sync] Yii2 returned", responseData.orders?.length ?? 0, "orders, since:", since);
      return { orders: responseData.orders ?? [], errorDetail: null };
    } catch (err) {
      lastError =
        err instanceof Error && err.name === "AbortError"
          ? `timeout setelah ${FETCH_TIMEOUT_MS / 1000}s`
          : err instanceof Error
            ? err.message
            : String(err);
      console.error(
        `[sync] Fetch error (attempt ${attempt}/${FETCH_MAX_ATTEMPTS}):`,
        lastError,
        "URL:",
        url,
      );
    }
  }

  return { orders: null, errorDetail: lastError ?? "unknown" };
}

// Fetch the full set of ACTIVE kode_order from Yii2 (B1). Lightweight — just
// codes, no full payload — so reconcile can compare against the entire local
// table instead of a bounded `since` window.
async function fetchActiveCodes(): Promise<string[] | null> {
  const url = `${LIVE_SYSTEM_BASE_URL}/api/order-sync/active-codes`;
  try {
    const response = await fetchWithTimeout(url, {
      "X-API-Key": LIVE_SYSTEM_API_KEY,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[reconcile] active-codes failed:", response.status, "Body:", body, "URL:", url);
      return null;
    }

    const data = (await response.json()) as {
      success?: boolean;
      count?: number;
      orders?: { kode_order: string }[];
    };
    const codes = (data.orders ?? [])
      .map((o) => o.kode_order)
      .filter((code): code is string => Boolean(code && code.trim()));
    console.log("[reconcile] Yii2 active-codes returned", codes.length, "orders");
    return codes;
  } catch (err) {
    console.error("[reconcile] active-codes fetch error:", err, "URL:", url);
    return null;
  }
}

// Watermark for the pull fallback (spec checklist item 4). Yii2's `since`
// compares against DATE columns (tgl_update_status / tgl_order, Asia/Jakarta)
// — so overlap must be date-level (1 day), not minutes. Dedupe by kode_order
// in ingestLegacyOrder makes the overlap safe.
export async function computeSinceWatermark(db: Db): Promise<string> {
  const { count: existingCount } = await db
    .from("legacy_orders")
    .select("id", { count: "exact", head: true });

  if (!existingCount) return fullSyncSince();

  const { data: lastSync } = await db
    .from("sync_logs")
    .select("created_at")
    .in("sync_type", ["cron", "manual"])
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1);

  const last = lastSync?.[0]?.created_at;
  if (!last) return fullSyncSince();

  const watermark = new Date(last);
  watermark.setDate(watermark.getDate() - 1);
  return `${watermark.toISOString().split("T")[0]} 00:00:00`;
}

export async function syncNewOrders(
  since?: string,
  syncType: "cron" | "manual" = "cron",
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, errors: 0 };
  const db = createAdminClient();

  const sinceDate = since || fullSyncSince();

  const orders = await fetchYii2Orders(sinceDate);
  if (orders.orders === null) {
    result.errors++;
    await logSync(
      db,
      syncType,
      result,
      `fetch new-orders gagal: ${orders.errorDetail ?? "unknown"}`,
    );
    return result;
  }

  for (const order of orders.orders) {
    try {
      const ingest = await ingestLegacyOrder(db, order);
      if (ingest.action === "inserted" || ingest.stageChanged) {
        console.log("[sync]", ingest.action, order.kode_order, "→ stage:", ingest.stage ?? "unchanged");
        result.synced++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      console.error("[sync] Ingest error:", order.kode_order, err);
      result.errors++;
    }
  }

  await logSync(db, syncType, result, result.errors > 0 ? `${result.errors} order gagal disinkron` : null);
  return result;
}

async function logSync(
  db: Db,
  syncType: "cron" | "manual" | "reconcile",
  result: SyncResult,
  errorMessage: string | null,
) {
  await db.from("sync_logs").insert({
    sync_type: syncType,
    orders_synced: result.synced,
    status: result.errors > 0 ? "partial" : "success",
    error_message: errorMessage,
    created_at: new Date().toISOString(),
  });
}

// ── Soft-delete reconciliation (spec checklist item 3) ────────────────────────
//
// Yii2 excludes soft-deleted orders from new-orders and (historically) never
// fired webhooks for them. This job pulls the full set of ACTIVE kode_order via
// active-codes (B1) and marks local rows that disappeared as deleted
// (deleted_at + drop the tracking pointer so they vanish from all worklists).
// Rows that reappear are resurrected by ingestLegacyOrder.

export interface ReconcileResult {
  checked: number;
  deleted: number;
  aborted: boolean;
  reason: string | null;
}

const RECONCILE_MAX_DELETE_RATIO = 0.1;
const RECONCILE_MAX_DELETE_FLOOR = 50;

// Soft-delete local orders and drop their tracking pointers so they disappear
// from every worklist. stage_history stays for audit. Shared by reconcile and
// the order_deleted webhook.
export async function softDeleteLocalOrders(
  db: Db,
  orderIds: string[],
): Promise<void> {
  if (orderIds.length === 0) return;

  const [{ data: intakes, error: intakeError }, { data: trackingRows, error: trackingError }] = await Promise.all([
    db
      .from("legacy_order_intakes")
      .select("id, legacy_order_id")
      .in("legacy_order_id", orderIds)
      .in("state", ["pending_spv_cs_validation", "returned_for_revision"]),
    db
      .from("tracking_stages")
      .select("order_id")
      .in("order_id", orderIds),
  ]);
  if (intakeError) throw new Error(`legacy_order_intakes query gagal: ${intakeError.message}`);
  if (trackingError) throw new Error(`tracking_stages query gagal: ${trackingError.message}`);

  const trackedIds = new Set((trackingRows ?? []).map((row) => row.order_id));
  const intakeIds = (intakes ?? [])
    .filter((row) => !trackedIds.has(row.legacy_order_id))
    .map((row) => row.id);
  if (intakeIds.length > 0) {
    await db
      .from("legacy_order_intakes")
      .update({ state: "cancelled_from_source", updated_at: new Date().toISOString() })
      .in("id", intakeIds);
  }

  const pendingOrderIds = new Set(
    (intakes ?? [])
      .filter((row) => !trackedIds.has(row.legacy_order_id))
      .map((row) => row.legacy_order_id),
  );
  const deletableOrderIds = orderIds.filter((id) => !pendingOrderIds.has(id));
  if (deletableOrderIds.length === 0) return;

  await db
    .from("legacy_orders")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", deletableOrderIds);

  await db.from("tracking_stages").delete().in("order_id", deletableOrderIds);
}

export async function reconcileDeletedOrders(): Promise<ReconcileResult> {
  const db = createAdminClient();

  const liveCodes = await fetchActiveCodes();

  // Never mass-delete on a bad/empty feed.
  if (liveCodes === null || liveCodes.length === 0) {
    const reason = liveCodes === null ? "fetch active-codes gagal" : "feed kosong — reconcile dibatalkan";
    await db.from("sync_logs").insert({
      sync_type: "reconcile",
      orders_synced: 0,
      status: "failed",
      error_message: reason,
      created_at: new Date().toISOString(),
    });
    return { checked: 0, deleted: 0, aborted: true, reason };
  }

  const liveSet = new Set(liveCodes);

  const { data: localRows, error } = await db
    .from("legacy_orders")
    .select("id, kode_order")
    .is("deleted_at", null);

  if (error || !localRows) {
    const reason = `query legacy_orders gagal: ${error?.message ?? "unknown"}`;
    await db.from("sync_logs").insert({
      sync_type: "reconcile",
      orders_synced: 0,
      status: "failed",
      error_message: reason,
      created_at: new Date().toISOString(),
    });
    return { checked: 0, deleted: 0, aborted: true, reason };
  }

  const missing = localRows.filter((row) => !liveSet.has(row.kode_order));

  // Safety valve: a suspiciously large deletion set means the feed is
  // truncated/broken, not that half the workshop got deleted.
  const maxAllowed = Math.max(
    RECONCILE_MAX_DELETE_FLOOR,
    Math.floor(localRows.length * RECONCILE_MAX_DELETE_RATIO),
  );
  if (missing.length > maxAllowed) {
    const reason = `${missing.length} order akan terhapus (batas ${maxAllowed}) — reconcile dibatalkan`;
    console.error("[reconcile]", reason);
    await db.from("sync_logs").insert({
      sync_type: "reconcile",
      orders_synced: 0,
      status: "failed",
      error_message: reason,
      created_at: new Date().toISOString(),
    });
    return { checked: localRows.length, deleted: 0, aborted: true, reason };
  }

  if (missing.length > 0) {
    const ids = missing.map((row) => row.id);
    await softDeleteLocalOrders(db, ids);
    console.log(
      "[reconcile] Marked deleted:",
      missing.map((row) => row.kode_order).join(", "),
    );
  }

  await db.from("sync_logs").insert({
    sync_type: "reconcile",
    orders_synced: missing.length,
    status: "success",
    error_message:
      missing.length > 0 ? `${missing.length} order ditandai deleted` : null,
    created_at: new Date().toISOString(),
  });

  return {
    checked: localRows.length,
    deleted: missing.length,
    aborted: false,
    reason: null,
  };
}
