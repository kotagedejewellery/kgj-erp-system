import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncNewOrders, computeSinceWatermark } from "@/lib/legacy/sync-service";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = createAdminClient();
    const since = await computeSinceWatermark(db);
    const result = await syncNewOrders(since, "manual");

    return NextResponse.json({
      synced: result.synced,
      skipped: result.skipped,
      errors: result.errors,
      since,
    });
  } catch (error) {
    console.error("[POST /api/legacy/sync] unexpected:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
