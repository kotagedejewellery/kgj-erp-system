import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleProps } from "@/lib/auth/session";

const MAX_PIN_ATTEMPTS = 3;
const PIN_LOCKOUT_MINUTES = 5;

export async function POST(request: Request) {
  try {
    const { user_id, pin, qr_token, setup_pin } = await request.json();

    if (!user_id || !pin || !qr_token) {
      return NextResponse.json(
        { error: "User ID, PIN, dan QR token wajib diisi" },
        { status: 400 },
      );
    }

    if (typeof pin !== "string" || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN harus berupa 6 digit angka" },
        { status: 400 },
      );
    }

    if (setup_pin !== undefined) {
      if (typeof setup_pin !== "string" || setup_pin.length !== 6 || !/^\d{6}$/.test(setup_pin)) {
        return NextResponse.json(
          { error: "Setup PIN harus berupa 6 digit angka" },
          { status: 400 },
        );
      }
    }

    const admin = createAdminClient();

    // 1. Validate QR token is active
    const { data: qrCode, error: qrError } = await admin
      .from("qr_codes")
      .select("id, role_id, workstation_name, is_active, roles:roles!qr_codes_role_id_fkey(id, name, role_group, allowed_stages)")
      .eq("qr_token", qr_token)
      .eq("is_active", true)
      .single();

    if (qrError || !qrCode) {
      return NextResponse.json(
        { error: "QR Code tidak valid atau tidak aktif" },
        { status: 404 },
      );
    }

    // 2. Look up user
    const { data: userData, error: userError } = await admin
      .from("users")
      .select("id, email, full_name, username, status, pin_hash, pin_attempts, pin_locked_until, role:roles!users_role_id_fkey(id, name, role_group, description, permissions, allowed_stages)")
      .eq("id", user_id)
      .is("deleted_at", null)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "Pekerja tidak ditemukan" },
        { status: 404 },
      );
    }

    if (userData.status !== "active") {
      return NextResponse.json(
        { error: "Akun tidak aktif. Hubungi administrator." },
        { status: 403 },
      );
    }

    // 3. Check role matches QR role
    if (getRoleProps(userData).id !== qrCode.role_id) {
      return NextResponse.json(
        { error: "Pekerja tidak sesuai dengan workstation ini" },
        { status: 403 },
      );
    }

    // 4. Check rate limiting
    if (userData.pin_locked_until) {
      const lockUntil = new Date(userData.pin_locked_until);
      if (lockUntil > new Date()) {
        const remainingMinutes = Math.ceil(
          (lockUntil.getTime() - Date.now()) / 60000,
        );
        return NextResponse.json(
          {
            error: `Terlalu banyak percobaan. Coba lagi dalam ${remainingMinutes} menit.`,
            locked_until: lockUntil.toISOString(),
          },
          { status: 429 },
        );
      }
    }

    if (!userData.pin_hash) {
      if (setup_pin) {
        // Save the new PIN and proceed with login
        const salt = await bcrypt.genSalt(10);
        const pinHash = await bcrypt.hash(setup_pin, salt);

        await admin
          .from("users")
          .update({
            pin_hash: pinHash,
            pin_attempts: 0,
            pin_locked_until: null,
          })
          .eq("id", userData.id);

        userData.pin_hash = pinHash;
      } else {
        return NextResponse.json(
          {
            needs_pin_setup: true,
            user_id: userData.id,
            full_name: userData.full_name,
          },
          { status: 200 },
        );
      }
    }

    // 5. Verify PIN
    const pinValid = await bcrypt.compare(pin, userData.pin_hash);

    if (!pinValid) {
      const newAttempts = (userData.pin_attempts || 0) + 1;
      const remaining = MAX_PIN_ATTEMPTS - newAttempts;

      if (newAttempts >= MAX_PIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + PIN_LOCKOUT_MINUTES * 60000);
        await admin
          .from("users")
          .update({
            pin_attempts: newAttempts,
            pin_locked_until: lockUntil.toISOString(),
          })
          .eq("id", userData.id);

        return NextResponse.json(
          {
            error: `Terlalu banyak percobaan. Coba lagi dalam ${PIN_LOCKOUT_MINUTES} menit.`,
            locked_until: lockUntil.toISOString(),
          },
          { status: 429 },
        );
      }

      await admin
        .from("users")
        .update({ pin_attempts: newAttempts })
        .eq("id", userData.id);

      return NextResponse.json(
        {
          error: `PIN salah. Sisa percobaan: ${remaining}`,
          remaining_attempts: remaining,
        },
        { status: 401 },
      );
    }

    // 6. PIN valid — reset attempts
    await admin
      .from("users")
      .update({ pin_attempts: 0, pin_locked_until: null })
      .eq("id", userData.id);

    // 7. Get workshop password for client-side sign in
    const { data: authUser } = await admin.auth.admin.getUserById(userData.id);
    const workshopPassword = authUser?.user?.user_metadata?.workshop_password || pin;

    // Ensure Auth password matches what the frontend will use
    try {
      await admin.auth.admin.updateUserById(userData.id, { password: workshopPassword });
    } catch {
      // Non-critical
    }

    // 8. Log activity
    await admin.from("activity_logs").insert({
      user_id: userData.id,
      action: "PIN_LOGIN",
      entity_type: "auth",
      metadata: { workstation: qrCode.workstation_name },
      ip_address:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip"),
      user_agent: request.headers.get("user-agent"),
    });

    const roleProps = getRoleProps(userData);

    return NextResponse.json({
      success: true,
      message: "Login berhasil",
      email: userData.email,
      workshopPassword,
      user: {
        id: userData.id,
        fullName: userData.full_name,
        username: userData.username,
        role: roleProps.name,
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
    console.error("[PIN Login] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
