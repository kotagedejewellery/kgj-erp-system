// lib/auth/session.ts

/**
 * Semua role yang bisa login via halaman /login (form email+password).
 * Union flat — tampil sebagai satu daftar di dropdown.
 */
export const LOGIN_ROLES = [
  "superadmin",
  "management",
  "supervisor",
  "after_sales",
] as const;

export type LoginRole = (typeof LOGIN_ROLES)[number];

export const SUPERVISOR_ROLE_NAMES = [
  "operational_supervisor",
  "production_supervisor",
  "customer_service_supervisor",
] as const;

export type SupervisorRoleName = (typeof SUPERVISOR_ROLE_NAMES)[number];

export function isSupervisorRoleName(
  value: unknown,
): value is SupervisorRoleName {
  return (
    typeof value === "string" &&
    (SUPERVISOR_ROLE_NAMES as readonly string[]).includes(value)
  );
}

/** role_group dari tabel roles di database. */
export type RoleGroup =
  | "management"
  | "operational"
  | "production";

export interface RolePermissions {
  can_read: boolean;
  can_insert: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_validate_intake?: boolean;
  warranty_administrator?: boolean;
  "warranty.activation.validate"?: boolean;
  "warranty.activation.activate"?: boolean;
  "warranty.contract.read"?: boolean;
  "warranty.claim.read"?: boolean;
  "warranty.claim.create"?: boolean;
  "warranty.claim.submit"?: boolean;
  "warranty.claim.complete_non_workshop"?: boolean;
}

/**
 * Detail role lengkap — diambil dari tabel `roles` di database.
 * Dipakai untuk permission-based rendering dan display name.
 *
 * Catatan: `name` di-type sebagai `string` karena tabel roles memuat juga
 * role non-login (packing, qc_1, jewelry_expert_*, dll) yang tidak ada di
 * union LoginRole. Jadi nilai field ini bisa lebih luas dari LoginRole.
 */
export interface UserRoleDetail {
  id: string;
  name: string;
  role_group: RoleGroup;
  description: string | null;
  permissions: RolePermissions;
}

export interface ClientUser {
  id: string;
  email: string;
  fullName: string;
  username: string | null;
  /** Nama role dashboard yang bisa login via form. */
  role: LoginRole;
  /** Detail role lengkap dari database (permissions, role_group, dll). */
  roleDetail: UserRoleDetail | null;
}

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

const STORAGE_KEYS = {
  id: "userId",
  email: "userEmail",
  fullName: "userName",
  username: "userUsername",
  role: "userRole",
  roleDetail: "userRoleDetail",
} as const;

/** Role yang masuk kategori management (akses tinggi). */
export const MANAGEMENT_ROLES = [
  "superadmin",
] as const satisfies readonly LoginRole[];

/** Role yang masuk kategori operasional (input data harian). */
const VALID_ROLE_GROUPS: readonly string[] = [
  "management",
  "operational",
  "production",
];

// ════════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ════════════════════════════════════════════════════════════════════════════

export function isLoginRole(value: unknown): value is LoginRole {
  return (
    typeof value === "string" &&
    (LOGIN_ROLES as readonly string[]).includes(value)
  );
}

function isRoleGroup(value: unknown): value is RoleGroup {
  return typeof value === "string" && VALID_ROLE_GROUPS.includes(value);
}

function isRoleDetailObject(value: unknown): value is UserRoleDetail {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    isRoleGroup(r.role_group)
  );
}

// ════════════════════════════════════════════════════════════════════════════
// READ
// ════════════════════════════════════════════════════════════════════════════

/**
 * Baca data user dari localStorage. Return null kalau tidak ada atau rusak.
 * SSR-safe: kalau dipanggil di server, return null.
 */
export function getClientUser(): ClientUser | null {
  if (typeof window === "undefined") return null;

  const id = localStorage.getItem(STORAGE_KEYS.id);
  const email = localStorage.getItem(STORAGE_KEYS.email);
  const fullName = localStorage.getItem(STORAGE_KEYS.fullName);
  const roleRaw = localStorage.getItem(STORAGE_KEYS.role);

  // Field wajib
  if (!id || !email || !fullName || !roleRaw) return null;

  // Validasi role — kalau ada role asing, anggap session rusak
  if (!isLoginRole(roleRaw)) return null;

  const username = localStorage.getItem(STORAGE_KEYS.username);
  const roleDetailRaw = localStorage.getItem(STORAGE_KEYS.roleDetail);
  let roleDetail: UserRoleDetail | null = null;
  if (roleDetailRaw) {
    try {
      const parsed = JSON.parse(roleDetailRaw);
      if (isRoleDetailObject(parsed)) {
        roleDetail = parsed;
      }
    } catch {
      roleDetail = null;
    }
  }

  return {
    id,
    email,
    fullName,
    username: username || null,
    role: roleRaw,
    roleDetail,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// WRITE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Simpan data user ke localStorage. Dipanggil setelah login sukses.
 */
export function setClientUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: LoginRole;
  username?: string | null;
  roleDetail?: UserRoleDetail | null;
}): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEYS.id, user.id);
  localStorage.setItem(STORAGE_KEYS.email, user.email);
  localStorage.setItem(STORAGE_KEYS.fullName, user.fullName);
  localStorage.setItem(STORAGE_KEYS.role, user.role);

  if (user.username) {
    localStorage.setItem(STORAGE_KEYS.username, user.username);
  } else {
    localStorage.removeItem(STORAGE_KEYS.username);
  }

  if (user.roleDetail) {
    localStorage.setItem(
      STORAGE_KEYS.roleDetail,
      JSON.stringify(user.roleDetail),
    );
  } else {
    localStorage.removeItem(STORAGE_KEYS.roleDetail);
  }

}

/** Hapus semua data user di localStorage. Dipanggil saat logout. */
export function clearClientUser(): void {
  if (typeof window === "undefined") return;
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

// ════════════════════════════════════════════════════════════════════════════
// ROLE CHECK HELPERS
// ════════════════════════════════════════════════════════════════════════════

/** Cek apakah user adalah superadmin. */
export function isSuperadmin(user: ClientUser | null): boolean {
  return user?.role === "superadmin";
}

/**
 * Cek apakah user punya salah satu role dari daftar.
 * Contoh: hasAnyRole(user, ["superadmin", "management"])
 */
export function hasAnyRole(
  user: ClientUser | null,
  roles: readonly LoginRole[],
): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Cek permission berdasarkan roleDetail.
 * Kalau roleDetail tidak tersedia (misal user lama sebelum struktur di-update),
 * fallback: superadmin dianggap punya semua permission.
 */
export function hasPermission(
  user: ClientUser | null,
  action: keyof RolePermissions,
): boolean {
  if (!user) return false;
  if (user.roleDetail?.permissions) {
    return user.roleDetail.permissions[action] === true;
  }
  // Fallback: superadmin selalu dapat akses, role lain return false
  return user.role === "superadmin";
}

/**
 * Helper untuk ekstrak properti role dari Supabase user object yang loosely-typed.
 * Digunakan di API routes untuk menghindari `(role as any)?.name`.
 *
 * Menerima object apapun yang punya `role` (object atau array hasil join Supabase).
 * Return default aman kalau role tidak ada.
 */
export function getRoleProps(user: unknown): { id: string; name: string; role_group: string; description: string | null; allowed_stages: string[]; permissions: Record<string, unknown> } {
  const userObj = user as { role?: unknown } | null;
  const role = Array.isArray(userObj?.role) ? (userObj.role as Record<string, unknown>[])[0] : userObj?.role as Record<string, unknown> | undefined;
  return {
    id: (role?.id as string) ?? "",
    name: (role?.name as string) ?? "",
    role_group: (role?.role_group as string) ?? "",
    description: (role?.description as string) ?? null,
    allowed_stages: (role?.allowed_stages as string[]) ?? [],
    permissions: (role?.permissions as Record<string, unknown>) ?? {},
  };
}

/** Dapatkan display name role untuk UI (human-readable). */
export function getRoleDisplayName(role: LoginRole): string {
  const map: Record<LoginRole, string> = {
    superadmin: "Super Admin",
    management: "Management",
    supervisor: "Supervisor",
    after_sales: "After Sales",
  };
  return map[role];
}
