// app/api/profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: userData, error: userErr } = await admin
      .from("users")
      .select(`
        id,
        full_name,
        username,
        status,
        role:roles!users_role_id_fkey (
          id,
          name,
          role_group,
          description,
          permissions,
          allowed_stages
        )
      `)
      .eq("id", user.id)
      .is("deleted_at", null)
      .single();

    if (userErr || !userData) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const roleProps = getRoleProps(userData);

    return NextResponse.json({
      id: userData.id,
      full_name: userData.full_name,
      username: userData.username,
      status: userData.status,
      email: user.email,
      role: {
        id: roleProps.id,
        name: roleProps.name,
        role_group: roleProps.role_group,
        description: roleProps.description,
      },
    });
  } catch (err) {
    console.error("[GET /api/profile]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, username, email, new_password } = body;

    const admin = createAdminClient();

    // Update users table
    const updates: Record<string, string> = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (username !== undefined) updates.username = username;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await admin
        .from("users")
        .update(updates)
        .eq("id", user.id);

      if (updateErr) {
        return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 });
      }
    }

    // Update Supabase Auth email/password if provided
    if (email || new_password) {
      // Update email
      if (email && email !== user.email) {
        const { error: emailErr } = await admin.auth.admin.updateUserById(user.id, { email });
        if (emailErr) {
          return NextResponse.json({ error: emailErr.message.includes("already") ? "Email sudah digunakan" : "Gagal mengubah email" }, { status: 400 });
        }
      }

      // Update password
      if (new_password) {
        const { error: passErr } = await admin.auth.admin.updateUserById(user.id, { password: new_password });
        if (passErr) {
          return NextResponse.json({ error: "Gagal mengubah password" }, { status: 400 });
        }
      }
    }

    // Fetch updated profile
    const { data: updatedUser } = await admin
      .from("users")
      .select(`id, full_name, username, status`)
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        id: updatedUser?.id ?? user.id,
        full_name: updatedUser?.full_name ?? full_name,
        username: updatedUser?.username ?? username,
        email: email || user.email,
      },
    });
  } catch (err) {
    console.error("[PUT /api/profile]", err);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
