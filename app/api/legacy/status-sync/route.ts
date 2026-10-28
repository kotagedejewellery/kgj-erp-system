import { NextResponse } from "next/server";
import {
  backfillCurrentStatusSyncs,
  retryPendingStatusSyncs,
} from "@/lib/legacy/push-status";
import { retryPendingReworkSyncs } from "@/lib/legacy/push-rework";
import { retryPendingApprovalLocks } from "@/lib/legacy/push-approval-lock";

export const maxDuration = 300;

function getLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 25;
  return Math.min(parsed, 100);
}

function getOffset(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return parsed;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron belum dikonfigurasi" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "retry";
  const limit = getLimit(url.searchParams.get("limit"));
  const offset = getOffset(url.searchParams.get("offset"));

  try {
    if (mode === "retry") {
      const [statusSync, reworkSync, approvalLockSync] = await Promise.all([
        retryPendingStatusSyncs(limit),
        retryPendingReworkSyncs(limit),
        retryPendingApprovalLocks(limit),
      ]);
      return NextResponse.json({ ...statusSync, reworkSync, approvalLockSync });
    }
    if (mode === "backfill") {
      const dryRun = url.searchParams.get("dry_run") !== "false";
      return NextResponse.json(await backfillCurrentStatusSyncs(limit, dryRun, offset));
    }
    return NextResponse.json({ error: "mode harus retry atau backfill" }, { status: 400 });
  } catch (error) {
    console.error("[GET /api/legacy/status-sync]", error);
    return NextResponse.json(
      { error: "Sinkronisasi status gagal diproses" },
      { status: 500 },
    );
  }
}
