import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { STAGE_SEQUENCE } from "@/lib/stages";

type StageHistoryEntry = {
  order_id: string;
  stage: string;
  created_at: string;
};

function percentile(values: number[], ratio: number): number {
  return values[Math.floor((values.length - 1) * ratio)];
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = createAdminClient();

    const { data, error } = await db
      .from("stage_history")
      .select("order_id, stage, created_at")
      .order("order_id", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stageDurations = new Map<string, number[]>();
    for (const stage of STAGE_SEQUENCE) {
      stageDurations.set(stage, []);
    }

    const historyByOrder = new Map<string, StageHistoryEntry[]>();
    for (const entry of (data ?? []) as StageHistoryEntry[]) {
      const history = historyByOrder.get(entry.order_id) ?? [];
      history.push(entry);
      historyByOrder.set(entry.order_id, history);
    }

    for (const history of historyByOrder.values()) {
      for (let index = 0; index < history.length - 1; index += 1) {
        const entered = history[index];
        const leftAt = history[index + 1];
        const durations = stageDurations.get(entered.stage);
        if (!durations) continue;

        const hours =
          (new Date(leftAt.created_at).getTime() -
            new Date(entered.created_at).getTime()) /
          (1000 * 60 * 60);
        if (Number.isFinite(hours) && hours >= 0) {
          durations.push(hours);
        }
      }
    }

    const stageStats = STAGE_SEQUENCE.map((stage) => {
      const durs = stageDurations.get(stage) ?? [];
      if (durs.length === 0) {
        return { stage, avg: null, median: null, p75: null, p95: null, count: 0 };
      }
      durs.sort((a, b) => a - b);
      const avg = durs.reduce((a, b) => a + b, 0) / durs.length;
      const median = percentile(durs, 0.5);
      const p75 = percentile(durs, 0.75);
      const p95 = percentile(durs, 0.95);
      return {
        stage,
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        p75: Math.round(p75 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        count: durs.length,
      };
    });

    return NextResponse.json({ stageStats });
  } catch (err) {
    console.error("[GET /api/analytics/stage-durations]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
