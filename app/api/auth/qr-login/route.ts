// app/api/auth/qr-login/route.ts

import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Nama pengguna dan kata sandi wajib diisi" },
        { status: 400 },
      );
    }

    // Admin client bypasses RLS for the pre-auth user lookup
    const admin = createAdminClient();

    const { data: userData, error: userError } = await admin
      .from("users")
      .select(
        `
        id,
        email,
        full_name,
        username,
        status,
        deleted_at,
        pin_hash,
        role:roles!users_role_id_fkey (
          id,
          name,
          role_group,
          description,
          permissions,
          allowed_stages
        )
      `,
      )
      .or(`username.eq.${username},email.eq.${username}`)
      .is("deleted_at", null)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "Pengguna tidak ditemukan" },
        { status: 401 },
      );
    }

    if (userData.status !== "active") {
      return NextResponse.json(
        { error: "Akun tidak aktif. Hubungi administrator." },
        { status: 403 },
      );
    }

    const roleProps = getRoleProps(userData);
    const roleName = roleProps.name;
    const roleGroup = roleProps.role_group;

    // QR login hanya untuk workshop + management (supervisor)
    if (roleName === "superadmin") {
      return NextResponse.json(
        { error: "Akun Super Admin tidak dapat login melalui halaman workshop. Silakan gunakan halaman login dashboard." },
        { status: 403 },
      );
    }
    const qrAllowedGroups = ["production", "operational", "management"];
    if (!qrAllowedGroups.includes(roleGroup)) {
      return NextResponse.json(
        {
          error:
            "Akun Anda tidak memiliki akses ke halaman workshop. Gunakan halaman login dashboard.",
        },
        { status: 403 },
      );
    }

    // Try Supabase Auth signInWithPassword (original password)
    const supabase = await createClient();
    let { error: authError } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password,
    });

    // If primary fails and user has a PIN hash, try PIN-based login
    if (authError && userData.pin_hash) {
      const pinValid = await bcrypt.compare(password, userData.pin_hash);
      if (pinValid) {
        // Use original password if available, otherwise fall back to PIN
        const { data: authUser } = await admin.auth.admin.getUserById(userData.id);
        const loginPassword = authUser?.user?.user_metadata?.workshop_password || password;
        try {
          await admin.auth.admin.updateUserById(userData.id, { password: loginPassword });
        } catch {
          // Non-critical — continue to signIn attempt
        }
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email: userData.email,
          password: loginPassword,
        });
        authError = retryError ?? null;
      }
    }

    if (authError) {
      let message = "Kata sandi salah";
      if (authError.message.includes("rate limit")) {
        message = "Terlalu banyak percobaan. Coba lagi nanti.";
      }
      return NextResponse.json({ error: message }, { status: 401 });
    }

    // Post-auth writes via admin client (avoids RLS dependency)
    await admin
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", userData.id);

    await admin.from("activity_logs").insert({
      user_id: userData.id,
      action: "QR_LOGIN",
      entity_type: "auth",
      ip_address:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip"),
      user_agent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      message: "Login berhasil",
      user: {
        id: userData.id,
        email: userData.email,
        fullName: userData.full_name,
        username: userData.username,
        role: roleName,
        roleDetail: {
          id: roleProps.id,
          name: roleProps.name,
          role_group: roleProps.role_group,
          description: roleProps.description,
          permissions: roleProps.permissions,
          allowed_stages: roleProps.allowed_stages,
        },
      },
    });
  } catch (error) {
    console.error("[QR Login] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
