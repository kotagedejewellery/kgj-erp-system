import { NextResponse } from "next/server";
import { retryPendingWarrantyActivations } from "@/lib/warranty/push-activation";
import { retryPendingWarrantyWorkUpdates } from "@/lib/warranty/push-work";

export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[GET /api/warranty/cron] CRON_SECRET is not set — rejecting");
    return NextResponse.json({ error: "Cron belum dikonfigurasi" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const requestedLimit = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "10", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 10) : 10;
    const [activation, work] = await Promise.all([
      retryPendingWarrantyActivations(limit),
      retryPendingWarrantyWorkUpdates(limit),
    ]);
    return NextResponse.json({ success: true, activation, work });
  } catch (error) {
    console.error("[GET /api/warranty/cron] unexpected:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
