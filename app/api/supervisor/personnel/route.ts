// app/api/supervisor/personnel/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";

async function verifySupervisor(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("users")
    .select("id, role:roles!users_role_id_fkey(name, role_group)")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();

  if (!data) return null;
  const roleName: string = getRoleProps(data).name;

  if (
    roleName === "operational_supervisor" ||
    roleName === "production_supervisor"
  ) {
    return { userId, roleName };
  }
  return null;
}

const GROUP_STAGES = {
  operational: [
    "racik_bahan", "qc_1", "laser", "konfirmasi",
    "packing", "pengiriman",
  ],
  production: [
    "pembentukan_cincin", "pemasangan_permata", "finishing",
    "lebur_bahan", "pemolesan", "cek_kadar", "qc_2",
  ],
} as const;

// GET /api/supervisor/personnel
// Returns all users with role_group production or operational + their stage assignments
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supervisor = await verifySupervisor(authUser.id);
    if (!supervisor)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const targetGroup = supervisor.roleName === "production_supervisor"
      ? "production"
      : "operational";
    const allowedStages = GROUP_STAGES[targetGroup];

    const admin = createAdminClient();

    const { data: users } = await admin
      .from("users")
      .select(`
        id, full_name, username, email, status,
        role:roles!users_role_id_fkey(id, name, role_group)
      `)
      .in("status", ["active", null])
      .is("deleted_at", null)
      .order("full_name");

    const { data: assignments } = await admin
      .from("stage_personnel")
      .select("*")
      .in("stage", allowedStages as unknown as string[])
      .order("sort_order");

    const assignmentsByUser: Record<string, unknown[]> = {};
    if (assignments) {
      for (const a of assignments) {
        if (!assignmentsByUser[a.user_id]) assignmentsByUser[a.user_id] = [];
        assignmentsByUser[a.user_id].push(a);
      }
    }

    const mapped = (users || [])
      .filter((u) => getRoleProps(u).role_group === targetGroup)
      .map((u) => ({
      id: u.id,
      full_name: u.full_name,
      username: u.username,
      email: u.email,
      status: u.status,
      role_name: getRoleProps(u).name,
      role_group: getRoleProps(u).role_group,
      assignments: assignmentsByUser[u.id] || [],
    }));

    return NextResponse.json({
      success: true,
      data: {
        users: mapped,
        stages: [...allowedStages],
      },
    });
  } catch (error) {
    console.error("[Personnel GET] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/supervisor/personnel
// Assign user to stage with person code
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supervisor = await verifySupervisor(authUser.id);
    if (!supervisor)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const targetGroup = supervisor.roleName === "production_supervisor"
      ? "production"
      : "operational";
    const allowedStages = GROUP_STAGES[targetGroup];

    const body = await request.json();
    const { user_id, stage, person_code, sub_type = null, sort_order = 0 } = body;

    if (!user_id || !stage || !person_code)
      return NextResponse.json({ error: "user_id, stage, dan person_code wajib diisi" }, { status: 400 });

    if (!(allowedStages as readonly string[]).includes(stage))
      return NextResponse.json({ error: `Stage '${stage}' tidak valid` }, { status: 400 });

    if (stage === "laser" && (!sub_type || !["batik", "nama"].includes(sub_type)))
      return NextResponse.json({ error: "Stage laser memerlukan sub_type (batik atau nama)" }, { status: 400 });

    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("stage_personnel")
      .select("id")
      .eq("user_id", user_id)
      .eq("stage", stage)
      .eq("sub_type", sub_type ?? "")
      .eq("person_code", person_code)
      .maybeSingle();

    if (existing)
      return NextResponse.json({ error: "Kode person sudah digunakan untuk stage ini" }, { status: 409 });

    const { data, error } = await admin
      .from("stage_personnel")
      .insert({ user_id, stage, person_code, sub_type, sort_order })
      .select("id")
      .single();

    if (error) {
      console.error("[Personnel POST] Insert error:", error.message);
      return NextResponse.json({ error: "Gagal menyimpan data" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { id: data.id } });
  } catch (error) {
    console.error("[Personnel POST] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT /api/supervisor/personnel
// Update person code or sort order
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supervisor = await verifySupervisor(authUser.id);
    if (!supervisor)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { id, person_code, sort_order } = body;

    if (!id)
      return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

    const admin = createAdminClient();
    const updates: Record<string, unknown> = {};
    if (person_code !== undefined) updates.person_code = person_code;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    const { error } = await admin
      .from("stage_personnel")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("[Personnel PUT] Error:", error.message);
      return NextResponse.json({ error: "Gagal mengupdate data" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Personnel PUT] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/supervisor/personnel?id=xxx
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supervisor = await verifySupervisor(authUser.id);
    if (!supervisor)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id)
      return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin
      .from("stage_personnel")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Personnel DELETE] Error:", error.message);
      return NextResponse.json({ error: "Gagal menghapus data" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Personnel DELETE] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
