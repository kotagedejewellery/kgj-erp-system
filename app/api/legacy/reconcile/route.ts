import { NextResponse } from "next/server";
import { reconcileDeletedOrders } from "@/lib/legacy/sync-service";

export const maxDuration = 300;

// Soft-delete reconciliation (spec checklist item 3): Yii2 never tells the
// ERP about deleted orders — this job pulls the full feed and marks local
// rows that disappeared as deleted. Triggered daily by Vercel Cron.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[GET /api/legacy/reconcile] CRON_SECRET is not set — rejecting");
    return NextResponse.json({ error: "Cron belum dikonfigurasi" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileDeletedOrders();
    return NextResponse.json(result, { status: result.aborted ? 502 : 200 });
  } catch (error) {
    console.error("[GET /api/legacy/reconcile] unexpected:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
