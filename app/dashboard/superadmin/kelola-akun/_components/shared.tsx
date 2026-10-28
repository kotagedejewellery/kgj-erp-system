"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoleOPRPRD {
  id: string;
  name: string;
  role_group:
    | "management"
    | "operational"
    | "production";
  description: string | null;
  permissions: {
    can_read: boolean;
    can_insert: boolean;
    can_update: boolean;
    can_delete: boolean;
  };
  allowed_stages: string[];
}

export interface UnifiedUser {
  id: string;
  full_name: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  role: "superadmin" | "after_sales" | null;
  roles: RoleOPRPRD | null;
  role_id: string | null;
  status: "active" | "inactive" | null;
  is_active: boolean;
  last_login: string | null;
  last_login_at: string | null;
  created_at: string;
  userType: "bms" | "supervisor" | "oprprd" | "management";
}

export type AlertState = {
  type: "success" | "error" | "warning" | "info";
  message: string;
} | null;

export type UserSegment = "all" | "bms" | "management" | "operational" | "production";

export type NewUserType = "bms" | "supervisor" | "oprprd" | "management" | null;

// ─── Constants ────────────────────────────────────────────────────────────────

export const BMS_ROLES = ["superadmin", "after_sales"] as const;

export const ROLE_GROUP_LABELS: Record<string, { label: string; bg: string }> = {
  management: { label: "Manajemen", bg: "bg-purple-100 text-purple-800" },
  operational: { label: "Operasional", bg: "bg-blue-100 text-blue-800" },
  production: { label: "Produksi", bg: "bg-amber-500/10 text-amber-800" },
};

export const SEGMENT_OPTIONS: { value: UserSegment; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "bms", label: "Dashboard" },
  { value: "management", label: "Manajemen" },
  { value: "operational", label: "Operasional" },
  { value: "production", label: "Produksi" },
];

// ─── Empty forms ──────────────────────────────────────────────────────────────

export const EMPTY_BMS_FORM = {
  username: "",
  full_name: "",
  email: "",
  password: "",
  role: "superadmin" as "superadmin" | "after_sales",
};

export const EMPTY_OPRPRD_FORM = {
  username: "",
  full_name: "",
  email: "",
  phone: "",
  password: "",
  role_id: "",
};

export const EMPTY_SUPERVISOR_FORM = {
  username: "",
  full_name: "",
  email: "",
  password: "",
  role: "operational_supervisor" as "operational_supervisor" | "production_supervisor" | "customer_service_supervisor",
};

export const EMPTY_MANAGEMENT_FORM = {
  username: "",
  full_name: "",
  email: "",
  password: "",
  role: "" as string,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const parseApiError = (raw: string, httpStatus?: number): string => {
  if (!raw) return "Terjadi kesalahan, silakan coba lagi";

  if (httpStatus === 409) {
    if (raw.includes("Supervisor Operasional") || raw.includes("Supervisor Produksi"))
      return raw;
    if (raw.toLowerCase().includes("email"))
      return "Email ini sudah terdaftar. Gunakan email lain.";
    if (raw.toLowerCase().includes("username"))
      return "Username sudah digunakan. Pilih username lain.";
    if (raw.includes("sudah terdaftar"))
      return "Akun dengan data ini sudah terdaftar di sistem.";
    return raw;
  }

  if (httpStatus === 403)
    return "Anda tidak memiliki izin untuk melakukan tindakan ini.";
  if (httpStatus === 401)
    return "Sesi login Anda telah berakhir. Silakan login ulang.";

  if (raw.includes("Nama lengkap dan password"))
    return "Nama lengkap dan password wajib diisi.";
  if (raw.includes("Password minimal"))
    return "Password terlalu pendek, minimal 6 karakter.";
  if (raw.includes("Email wajib")) return "Email wajib diisi untuk akun Superadmin.";
  if (raw.includes("Username minimal"))
    return "Username terlalu pendek, minimal 3 karakter.";
  if (raw.includes("Role harus dipilih") || raw.includes("Role tidak valid"))
    return "Role belum dipilih atau tidak valid.";
  if (raw.includes("Role harus salah satu"))
    return "Role tidak dikenali. Pilih Super Admin atau role operasional yang tersedia.";
  if (raw.includes("role BMS, gunakan field"))
    return "Untuk role Superadmin gunakan mode Superadmin, bukan mode Operasional.";

  if (raw.startsWith("Gagal membuat akun auth:")) return raw;
  if (raw.includes("Gagal menyimpan profil"))
    return "Akun berhasil dibuat di sistem auth, tapi profil gagal disimpan. Hubungi administrator.";
  if (raw.includes("Gagal memperbarui"))
    return "Gagal menyimpan perubahan. Silakan coba lagi.";
  if (raw.includes("Gagal mengubah password"))
    return "Password gagal diubah. Silakan coba lagi.";
  if (raw.includes("tidak ditemukan di database"))
    return "Konfigurasi role tidak ditemukan. Hubungi administrator.";
  if (raw.includes("Terjadi kesalahan server"))
    return "Server sedang bermasalah. Silakan coba beberapa saat lagi.";

  return raw;
};

export const resolveUserType = (u: { role?: string; roles?: { name?: string; role_group?: string } | null; username?: string; email?: string }): "bms" | "supervisor" | "oprprd" | "management" => {
  if (u.role && (BMS_ROLES as readonly string[]).includes(u.role))
    return "bms";
  const roleName = u.roles?.name;
  if (roleName === "operational_supervisor" || roleName === "production_supervisor" || roleName === "customer_service_supervisor")
    return "supervisor";
  if (u.roles?.role_group === "management") return "management";
  if (u.roles?.role_group) return "oprprd";
  if (u.username && (!u.email || u.email?.endsWith("@internal.local")))
    return "oprprd";
  return u.email && !u.username ? "bms" : "oprprd";
};

export const currentUserIsActive = (u: UnifiedUser) =>
  u.userType === "bms" ? u.status === "active" : u.is_active;

export const formatDate = (iso: string | null) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getRoleBadge = (user: UnifiedUser) => {
  if (user.userType === "bms") {
    const map: Record<string, { bg: string; label: string }> = {
      superadmin: { bg: "bg-purple-100 text-purple-800", label: "Super Admin" },
      after_sales: { bg: "bg-teal-500/10 text-teal-700", label: "After Sales" },
    };
    const cfg = map[user.role ?? ""] ?? {
      bg: "bg-white/10 text-cream",
      label: user.role ?? "-",
    };
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${cfg.bg}`}>
          {cfg.label}
        </span>
        <span className="text-[10px] text-white/40">Dashboard</span>
      </div>
    );
  }
  const role = user.roles;
  if (!role)
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-white/10 text-white/50">
        -
      </span>
    );
  if (role.name === "operational_supervisor") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-orange-500/10 text-orange-800">
          Spv. Operasional
        </span>
        <span className="text-[10px] text-white/40">Manajemen</span>
      </div>
    );
  }
  if (role.name === "production_supervisor") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-800">
          Spv. Produksi
        </span>
        <span className="text-[10px] text-white/40">Manajemen</span>
      </div>
    );
  }
  if (role.name === "customer_service_supervisor") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-sky-500/10 text-sky-800">
          Spv. Customer Service
        </span>
        <span className="text-[10px] text-white/40">Manajemen</span>
      </div>
    );
  }
  // Management (Leader) roles
  const MGMT_LABELS: Record<string, string> = {
    leader_hc: "Leader HC",
    leader_operational: "Leader Operasional",
    leader_production: "Leader Produksi",
    leader_marketing: "Leader Marketing",
    leader_sales: "Leader Sales",
    leader_fat: "Leader FAT",
    leader_rnd: "Leader RND",
    leader_safar: "Leader Safar",
    leader_ga: "Leader GA",
    leader_sekdir: "Leader Sekdir",
    leader_rji: "Leader RJI",
  };
  if (role.role_group === "management" && MGMT_LABELS[role.name]) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-violet-500/10 text-violet-800">
          {MGMT_LABELS[role.name]}
        </span>
        <span className="text-[10px] text-white/40">Management</span>
      </div>
    );
  }
  const cfg = ROLE_GROUP_LABELS[role.role_group] ?? {
    label: role.name,
    bg: "bg-white/10 text-cream",
  };
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${cfg.bg}`}>
        {role.name}
      </span>
      <span className="text-[10px] text-white/40">{cfg.label}</span>
    </div>
  );
};

export const getStatusBadge = (user: UnifiedUser) => {
  const isActive =
    user.userType === "bms" ? user.status === "active" : user.is_active;
  return isActive ? (
    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-green-800">
      Aktif
    </span>
  ) : (
    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-red-800">
      Nonaktif
    </span>
  );
};

