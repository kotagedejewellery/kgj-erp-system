// proxy.ts

import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRoleProps, isSupervisorRoleName } from "@/lib/auth/session";
import {
  ROUTES,
  getDashboardPath,
  canAccessPath,
  isProtectedPath,
  isAuthOnlyPath,
} from "@/lib/routes";

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[proxy] Missing Supabase env vars");
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Update cookie di request (supaya getUser setelahnya dapat yg baru)
        cookiesToSet.forEach(({ name, value }) => {
          req.cookies.set(name, value);
        });
        // Buat response baru yang meneruskan request, dengan cookie ter-update
        res = NextResponse.next({
          request: { headers: req.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  const pathIsProtected = isProtectedPath(pathname);
  const pathIsAuthOnly = isAuthOnlyPath(pathname);

  // ──────────────────────────────────────────────────────────────────────────
  // 1) Akses halaman protected tanpa login → redirect ke /login
  // ──────────────────────────────────────────────────────────────────────────
  if (pathIsProtected && !user) {
    const loginUrl = new URL(ROUTES.LOGIN, req.url);
    // Sertakan path asal sebagai query, biar setelah login bisa kembali
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2) Akses halaman auth (e.g. /login) padahal sudah login →
  //    redirect ke dashboard sesuai role
  // ──────────────────────────────────────────────────────────────────────────
  if (pathIsAuthOnly && user) {
    // Biarkan halaman login handle redirect untuk integrated-system flow
    if (req.nextUrl.searchParams.get("from") === "integrated-system") {
      return NextResponse.next({ request: { headers: req.headers } });
    }

    const roleInfo = await fetchUserRoleName(supabase, user.id);

    const dashboardPath = resolveDashboardPath(roleInfo);
    if (dashboardPath) {
      return NextResponse.redirect(new URL(dashboardPath, req.url));
    }

    // Role tidak dikenali (misal production_staff yang login via form) —
    // paksa logout & biarkan di /login dengan pesan error.
    await supabase.auth.signOut();
    const loginUrl = new URL(ROUTES.LOGIN, req.url);
    loginUrl.searchParams.set("error", "invalid_role");
    return NextResponse.redirect(loginUrl);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3) Akses halaman protected dengan role tidak sesuai → redirect ke
  //    dashboard role-nya sendiri
  //    Misal: user CS coba akses /dashboard/superadmin
  // ──────────────────────────────────────────────────────────────────────────
  if (pathIsProtected && user) {
    const roleInfo = await fetchUserRoleName(supabase, user.id);

    // Role user tidak dikenali → force logout
    if (!roleInfo) {
      await supabase.auth.signOut();
      const loginUrl = new URL(ROUTES.LOGIN, req.url);
      loginUrl.searchParams.set("error", "no_role");
      return NextResponse.redirect(loginUrl);
    }

    // Cek akses path — kalau tidak punya akses, redirect ke dashboard sendiri
    if (!canAccessPath(roleInfo.name, pathname)) {
      const ownDashboard = resolveDashboardPath(roleInfo);
      if (ownDashboard) {
        return NextResponse.redirect(new URL(ownDashboard, req.url));
      }
      // Fallback defensive
      return NextResponse.redirect(new URL(ROUTES.LOGIN, req.url));
    }
  }

  return res;
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Ambil nama role user dari tabel users (JOIN ke roles).
 * Return null kalau user tidak ada, tidak aktif, sudah di-soft-delete,
 * atau role tidak valid.
 */
async function fetchUserRoleName(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<{ name: string; roleGroup: string } | null> {
  const { data, error } = await supabase
    .from("users")
    .select(
      `
      status,
      deleted_at,
      role:roles!users_role_id_fkey (
        name,
        role_group
      )
    `,
    )
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.warn("[proxy] failed to fetch user role:", error?.message);
    return null;
  }

  // Tolak user yang sudah di-soft-delete
  if (data.deleted_at) return null;

  // Tolak user yang statusnya bukan active
  if (data.status !== "active") return null;

  const roleName = getRoleProps(data).name;
  const roleGroup = getRoleProps(data).role_group;
  if (!roleName || typeof roleName !== "string") return null;

  return { name: roleName, roleGroup };
}

function resolveDashboardPath(roleInfo: { name: string; roleGroup: string } | null): string | null {
  if (!roleInfo) return null;
  // superadmin is in the management roleGroup but has its own dashboard
  if (roleInfo.name === "superadmin") return getDashboardPath("superadmin");
  if (isSupervisorRoleName(roleInfo.name)) return getDashboardPath("supervisor");
  if (roleInfo.roleGroup === "management") return "/dashboard/management";
  return getDashboardPath(roleInfo.name);
}

// ════════════════════════════════════════════════════════════════════════════
// MATCHER CONFIG
// ════════════════════════════════════════════════════════════════════════════

export const config = {
  // Matcher mengeksklusi static assets & API routes biar proxy
  // tidak jalan di setiap request yang tidak relevan.
  matcher: [
    /*
     * Jalankan proxy di semua path KECUALI:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - file dengan ekstensi (*.png, *.svg, dsb)
     * - /api/* (API routes handle auth sendiri)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/|.*\\..*).*)",
  ],
};
