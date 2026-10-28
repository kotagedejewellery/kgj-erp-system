// app/dashboard/superadmin/kelola-akun/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import Loading from "@/components/ui/Loading";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  Building2,
  Pencil,
  Plus,
  Power,
  Trash2,
  User,
  Users,
  Wrench,
  Shield,
} from "lucide-react";
import {
  SEGMENT_OPTIONS,
  EMPTY_BMS_FORM,
  EMPTY_OPRPRD_FORM,
  EMPTY_SUPERVISOR_FORM,
  EMPTY_MANAGEMENT_FORM,
  parseApiError,
  resolveUserType,
  getRoleBadge,
  getStatusBadge,
  formatDate,
  currentUserIsActive,
  type UnifiedUser,
  type RoleOPRPRD,
  type AlertState,
  type UserSegment,
  type NewUserType,
} from "./_components/shared";
import { UserTypePicker } from "./_components/UserTypePicker";
import { BmsUserForm } from "./_components/BmsUserForm";
import { SupervisorUserForm } from "./_components/SupervisorUserForm";
import { OprprdUserForm } from "./_components/OprprdUserForm";
import { ManagementUserForm } from "./_components/ManagementUserForm";
import {
  BmsUserSchema,
  BmsEditUserSchema,
  OprprdUserSchema,
  OprprdEditUserSchema,
  SupervisorUserSchema,
  SupervisorEditUserSchema,
  ManagementUserSchema,
  ManagementEditUserSchema,
} from "@/lib/schemas/kelola-akun";

export default function KelolaAkunPage() {
  const [activeTab, setActiveTab] = useState<"all" | "bms" | "oprprd" | "management">("all");
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);

  const [allUsers, setAllUsers] = useState<UnifiedUser[]>([]);
  const [roles, setRoles] = useState<RoleOPRPRD[]>([]);
  const [segment, setSegment] = useState<UserSegment>("all");
  const [showInactive, setShowInactive] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UnifiedUser | null>(null);
  const [newUserType, setNewUserType] = useState<NewUserType>(null);

  const [bmsForm, setBmsForm] = useState(EMPTY_BMS_FORM);
  const [oprprdForm, setOprprdForm] = useState(EMPTY_OPRPRD_FORM);
  const [supervisorForm, setSupervisorForm] = useState(EMPTY_SUPERVISOR_FORM);
  const [managementForm, setManagementForm] = useState(EMPTY_MANAGEMENT_FORM);

  const [userToDelete, setUserToDelete] = useState<UnifiedUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [userToToggle, setUserToToggle] = useState<UnifiedUser | null>(null);


  useEffect(() => {
    setClientUser(getClientUser());
  }, []);

  const showAlert = (
    type: NonNullable<AlertState>["type"],
    message: string,
  ) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // ─── Data fetching ─────────────────────────────────────────────

  interface UsersResponse { data: Record<string, unknown>[]; }
  interface RolesResponse { data: Record<string, unknown>[]; }

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery<UsersResponse>({
    queryKey: ["users", showInactive],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "500" });
      if (!showInactive) params.append("status", "active");
      return fetcher(`/api/users?${params.toString()}`);
    },
  });

  const { data: rolesData, isLoading: rolesLoading } = useQuery<RolesResponse>({
    queryKey: ["roles"],
    queryFn: () => fetcher("/api/roles"),
  });

  const isQueriesLoading = usersLoading || rolesLoading;

  useEffect(() => {
    if (usersData?.data) {
      setAllUsers(
        ((usersData.data ?? []) as unknown as UnifiedUser[]).map((u) => ({
          ...u,
          userType: resolveUserType(u as unknown as Parameters<typeof resolveUserType>[0]),
        })),
      );
    }
  }, [usersData]);

  useEffect(() => {
    if (rolesData?.data) {
      const BMS_NAMES = new Set(["superadmin", "after_sales"]);
      setRoles(
        ((rolesData.data ?? []) as unknown as RoleOPRPRD[]).filter(
          (r: RoleOPRPRD) => !BMS_NAMES.has(r.name),
        ),
      );
    }
  }, [rolesData]);

  // ─── Filtered & stats ──────────────────────────────────────────

  const filteredUsers = allUsers.filter((u) => {
    if (segment === "all") return true;
    if (segment === "bms") return u.userType === "bms";
    return u.roles?.role_group === segment;
  });

  const stats = {
    total: allUsers.length,
    bms: allUsers.filter((u) => u.userType === "bms").length,
    management: allUsers.filter((u) => u.roles?.role_group === "management").length,
    operational: allUsers.filter((u) => u.roles?.role_group === "operational").length,
    production: allUsers.filter((u) => u.roles?.role_group === "production").length,
    active: allUsers.filter((u) =>
      u.userType === "bms" ? u.status === "active" : u.is_active,
    ).length,
  };

  const displayUsers = (() => {
    if (activeTab === "all") return filteredUsers;
    if (activeTab === "bms") return allUsers.filter((u) => u.userType === "bms");
    if (activeTab === "oprprd") return allUsers.filter((u) => u.userType === "oprprd");
    if (activeTab === "management") return allUsers.filter((u) => u.userType === "supervisor" || u.userType === "management");
    return [];
  })();

  // ─── Modal handlers ────────────────────────────────────────────

  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setSelectedUser(null);
    setNewUserType(
      activeTab === "bms" ? "bms" :
      activeTab === "oprprd" ? "oprprd" :
      activeTab === "management" ? "management" :
      null
    );
    setBmsForm(EMPTY_BMS_FORM);
    setOprprdForm(EMPTY_OPRPRD_FORM);
    setSupervisorForm(EMPTY_SUPERVISOR_FORM);
    setManagementForm(EMPTY_MANAGEMENT_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UnifiedUser) => {
    setIsEditMode(true);
    setSelectedUser(user);
    setNewUserType(user.userType);
    if (user.userType === "bms") {
      setBmsForm({
        username: user.username ?? "",
        full_name: user.full_name,
        email: user.email ?? "",
        password: "",
        role: (user.role as typeof EMPTY_BMS_FORM.role) ?? "superadmin",
      });
    } else if (user.userType === "supervisor") {
      setSupervisorForm({
        username: user.username ?? "",
        full_name: user.full_name,
        email: user.email?.endsWith("@noreply.kodagede.id") ? "" : (user.email ?? ""),
        password: "",
        role: (user.roles?.name as "operational_supervisor" | "production_supervisor" | "customer_service_supervisor") ?? "operational_supervisor",
      });
    } else if (user.userType === "management") {
      setManagementForm({
        username: user.username ?? "",
        full_name: user.full_name,
        email: user.email?.endsWith("@noreply.kodagede.id") ? "" : (user.email ?? ""),
        password: "",
        role: user.roles?.name ?? "leader_operational",
      });
    } else {
      setOprprdForm({
        username: user.username ?? "",
        full_name: user.full_name,
        email: user.email?.endsWith("@internal.local") ? "" : (user.email ?? ""),
        phone: user.phone ?? "",
        password: "",
        role_id: user.role_id ?? "",
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
  };

  // ─── Save BMS ──────────────────────────────────────────────────

  const handleSaveBmsUser = async () => {
    const schema = isEditMode ? BmsEditUserSchema : BmsUserSchema;
    const validation = schema.safeParse({
      username: bmsForm.username || undefined,
      full_name: bmsForm.full_name,
      email: bmsForm.email,
      password: bmsForm.password,
      role: bmsForm.role,
    });
    if (!validation.success) {
      showAlert("error", validation.error.issues[0]?.message ?? "Validasi gagal");
      return;
    }
    if (!bmsForm.full_name.trim() || !bmsForm.email.trim()) {
      showAlert("error", "Nama lengkap dan email wajib diisi.");
      return;
    }
    if (!isEditMode && !bmsForm.password) {
      showAlert("error", "Password wajib diisi untuk akun baru.");
      return;
    }
    if (bmsForm.password && bmsForm.password.length < 6) {
      showAlert("error", "Password terlalu pendek, minimal 6 karakter.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        full_name: bmsForm.full_name.trim(),
        email: bmsForm.email.trim(),
        role: bmsForm.role,
        ...(bmsForm.username?.trim() ? { username: bmsForm.username.trim() } : {}),
        ...(bmsForm.password ? { password: bmsForm.password } : {}),
      };
      const res = await fetch(
        isEditMode ? `/api/users/${selectedUser!.id}` : "/api/users",
        { method: isEditMode ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      );
      const json = await res.json();
      if (!res.ok) { showAlert("error", parseApiError(json.error, res.status)); return; }
      showAlert("success", isEditMode ? "Akun berhasil diperbarui!" : "Akun dashboard baru berhasil dibuat!");
      setIsModalOpen(false);
      setTimeout(() => { refetchUsers(); }, 500);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Save OPRPRD ───────────────────────────────────────────────

  const handleSaveOprprdUser = async () => {
    const schema = isEditMode ? OprprdEditUserSchema : OprprdUserSchema;
    const validation = schema.safeParse({
      username: oprprdForm.username,
      full_name: oprprdForm.full_name,
      password: oprprdForm.password,
      role_id: oprprdForm.role_id,
      email: oprprdForm.email || undefined,
      phone: oprprdForm.phone || undefined,
    });
    if (!validation.success) {
      showAlert("error", validation.error.issues[0]?.message ?? "Validasi gagal");
      return;
    }
    if (!oprprdForm.username.trim() || !oprprdForm.full_name.trim()) {
      showAlert("error", "Username dan nama lengkap wajib diisi.");
      return;
    }
    if (oprprdForm.username.trim().length < 3) {
      showAlert("error", "Username terlalu pendek, minimal 3 karakter.");
      return;
    }
    if (!oprprdForm.role_id) { showAlert("error", "Role wajib dipilih."); return; }
    if (!isEditMode && !oprprdForm.password) {
      showAlert("error", "Password wajib diisi untuk akun baru.");
      return;
    }
    if (oprprdForm.password && oprprdForm.password.length < 6) {
      showAlert("error", "Password terlalu pendek, minimal 6 karakter.");
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, string | null> = {
        username: oprprdForm.username.trim(),
        full_name: oprprdForm.full_name.trim(),
        email: oprprdForm.email.trim() || null,
        phone: oprprdForm.phone.trim() || null,
        role_id: oprprdForm.role_id,
      };
      if (oprprdForm.password) payload.password = oprprdForm.password;
      const res = await fetch(
        isEditMode ? `/api/users/${selectedUser!.id}` : "/api/users",
        { method: isEditMode ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      );
      const json = await res.json();
      if (!res.ok) { showAlert("error", parseApiError(json.error, res.status)); return; }
      showAlert("success", isEditMode ? "Akun berhasil diperbarui!" : "Akun Operasional/Produksi baru berhasil dibuat!");
      setIsModalOpen(false);
      setTimeout(() => { refetchUsers(); }, 500);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Save Supervisor ───────────────────────────────────────────

  const handleSaveSupervisorUser = async () => {
    const schema = isEditMode ? SupervisorEditUserSchema : SupervisorUserSchema;
    const validation = schema.safeParse({
      username: supervisorForm.username,
      full_name: supervisorForm.full_name,
      email: supervisorForm.email,
      password: supervisorForm.password,
      role: supervisorForm.role,
    });
    if (!validation.success) {
      showAlert("error", validation.error.issues[0]?.message ?? "Validasi gagal");
      return;
    }
    if (!supervisorForm.full_name.trim()) { showAlert("error", "Nama lengkap wajib diisi."); return; }
    if (!isEditMode && !supervisorForm.username.trim()) { showAlert("error", "Username wajib diisi."); return; }
    if (!supervisorForm.email.trim()) { showAlert("error", "Email wajib diisi untuk akun supervisor."); return; }
    if (!isEditMode && !supervisorForm.password) { showAlert("error", "Password wajib diisi untuk akun baru."); return; }
    if (supervisorForm.password && supervisorForm.password.length < 6) {
      showAlert("error", "Password terlalu pendek, minimal 6 karakter.");
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, string> = {
        full_name: supervisorForm.full_name.trim(),
        email: supervisorForm.email.trim().toLowerCase(),
        role: supervisorForm.role,
      };
      if (supervisorForm.username.trim()) payload.username = supervisorForm.username.trim();
      if (supervisorForm.password) payload.password = supervisorForm.password;

      const res = await fetch(
        isEditMode ? `/api/users/${selectedUser!.id}` : "/api/users",
        { method: isEditMode ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      );
      const json = await res.json();
      if (!res.ok) { showAlert("error", parseApiError(json.error, res.status)); return; }
      showAlert("success", isEditMode ? "Akun supervisor berhasil diperbarui!" : "Akun supervisor baru berhasil dibuat!");
      setIsModalOpen(false);
      setTimeout(() => refetchUsers(), 500);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Save Management ───────────────────────────────────────────

  const handleSaveManagementUser = async () => {
    const schema = isEditMode ? ManagementEditUserSchema : ManagementUserSchema;
    const validation = schema.safeParse({
      username: managementForm.username,
      full_name: managementForm.full_name,
      email: managementForm.email,
      password: managementForm.password,
      role: managementForm.role,
    });
    if (!validation.success) {
      showAlert("error", validation.error.issues[0]?.message ?? "Validasi gagal");
      return;
    }
    if (!managementForm.full_name.trim()) { showAlert("error", "Nama lengkap wajib diisi."); return; }
    if (!isEditMode && !managementForm.username.trim()) { showAlert("error", "Username wajib diisi."); return; }
    if (!managementForm.email.trim()) { showAlert("error", "Email wajib diisi."); return; }
    if (!isEditMode && !managementForm.password) { showAlert("error", "Password wajib diisi untuk akun baru."); return; }
    if (managementForm.password && managementForm.password.length < 6) { showAlert("error", "Password terlalu pendek."); return; }
    if (!managementForm.role) { showAlert("error", "Leader role wajib dipilih."); return; }

    setIsSaving(true);
    try {
      const payload: Record<string, string> = {
        full_name: managementForm.full_name.trim(),
        email: managementForm.email.trim().toLowerCase(),
        role: managementForm.role,
      };
      if (managementForm.username.trim()) payload.username = managementForm.username.trim();
      if (managementForm.password) payload.password = managementForm.password;

      const res = await fetch(
        isEditMode ? `/api/users/${selectedUser!.id}` : "/api/users",
        { method: isEditMode ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      );
      const json = await res.json();
      if (!res.ok) { showAlert("error", parseApiError(json.error, res.status)); return; }
      showAlert("success", isEditMode ? "Akun management berhasil diperbarui!" : "Akun management baru berhasil dibuat!");
      setIsModalOpen(false);
      setTimeout(() => refetchUsers(), 500);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Toggle / Delete user ─────────────────────────────────────

  const handleToggleUserStatus = async (user: UnifiedUser) => {
    const body =
      user.userType === "bms"
        ? { status: user.status === "active" ? "inactive" : "active" }
        : { is_active: !user.is_active };
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { showAlert("error", parseApiError(json.error, res.status)); return; }
    const isNowActive = user.userType === "bms" ? user.status !== "active" : !user.is_active;
    showAlert("success", `Akun ${user.full_name} berhasil ${isNowActive ? "diaktifkan" : "dinonaktifkan"}.`);
    await refetchUsers();
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showAlert("error", parseApiError(json.error, res.status)); return; }
      showAlert("success", `Akun ${userToDelete.full_name} berhasil dihapus.`);
      await refetchUsers();
    } finally {
      setIsDeletingUser(false);
      setUserToDelete(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────

  const modalTitle = (() => {
    if (isEditMode) {
      const prefix = `Edit Akun — `;
      if (selectedUser?.userType === "bms") return prefix + "Superadmin";
      if (selectedUser?.userType === "supervisor")
        return prefix + (selectedUser.roles?.name === "production_supervisor" ? "Supervisor Produksi" : "Supervisor Operasional");
      if (selectedUser?.userType === "management")
        return prefix + "Management";
      return prefix + "Operasional & Produksi";
    }
    if (newUserType === null) return "Pilih Tipe Akun";
    if (newUserType === "bms") return "Buat Akun Superadmin";
    if (newUserType === "supervisor") return "Buat Akun Supervisor";
    if (newUserType === "management") return "Buat Akun Management";
    return "Buat Akun Operasional / Produksi";
  })();

  if (isQueriesLoading) {
    return (
      <div className="flex h-screen bg-[#26211c]">
        <Sidebar role="superadmin" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
          <main className="flex-1 overflow-y-auto p-6">
            <Loading variant="skeleton" text="Memuat data..." />
          </main>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen bg-[#26211c]">
        <Sidebar role="superadmin" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
          <main className="flex-1 overflow-y-auto p-6">
            {/* Page header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold text-cream mb-2">Kelola Akun</h2>
                <p className="text-white/70">Buat, edit, dan kelola akses pengguna</p>
              </div>
              <Button
                variant="primary"
                onClick={handleOpenCreateModal}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Buat Akun Baru
              </Button>
            </div>

            {/* Page alert */}
            {alert && (
              <div className="mb-6 animate-slide-down">
                <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} autoClose duration={5000} />
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gold/15 mb-8">
              <nav className="flex gap-6 overflow-x-auto">
                {([
                  { key: "all" as const, label: "Semua User", icon: Users },
                  { key: "bms" as const, label: "Superadmin", icon: Building2 },
                  { key: "oprprd" as const, label: "OPRPRD", icon: Wrench },
                  { key: "management" as const, label: "Manajemen", icon: Shield },
                ]).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-1.5 pb-4 px-1 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === key ? "text-gold border-b-2 border-gold" : "text-white/50 hover:text-cream"}`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            {/* ── Tab: Users ── */}
            <>
                {/* Stats */}
                {activeTab === "all" ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                    {[
                      { label: "Total", value: stats.total, color: "border-indigo-400", text: "text-indigo-700" },
                      { label: "Superadmin", value: stats.bms, color: "border-purple-400", text: "text-purple-700" },
                      { label: "Manajemen", value: stats.management, color: "border-orange-400", text: "text-orange-300" },
                      { label: "Operasional", value: stats.operational, color: "border-blue-400", text: "text-blue-700" },
                      { label: "Produksi", value: stats.production, color: "border-amber-400", text: "text-amber-300" },
                      { label: "Aktif", value: stats.active, color: "border-green-400", text: "text-emerald-300" },
                    ].map(({ label, value, color, text }) => (
                      <div key={label} className={`bg-cocoa rounded-xl shadow-sm p-4 border-t-2 ${color}`}>
                        <p className="text-xs text-white/50">{label}</p>
                        <p className={`text-xl font-bold ${text}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-4 mb-6">
                    <div className="bg-cocoa rounded-xl shadow-sm p-4 border-t-2 border-gold flex-1">
                      <p className="text-xs text-white/50">Total</p>
                      <p className="text-xl font-bold text-indigo-700">{displayUsers.length}</p>
                    </div>
                    <div className="bg-cocoa rounded-xl shadow-sm p-4 border-t-2 border-green-400 flex-1">
                      <p className="text-xs text-white/50">Aktif</p>
                      <p className="text-xl font-bold text-emerald-300">
                        {displayUsers.filter((u) => u.userType === "bms" ? u.status === "active" : u.is_active).length}
                      </p>
                    </div>
                  </div>
                )}

                {/* Filter bar — only on "all" tab */}
                {activeTab === "all" && (
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex flex-wrap gap-2">
                      {SEGMENT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSegment(opt.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${segment === opt.value ? "bg-gold text-night" : "bg-cocoa text-white/70 border border-gold/15 hover:border-gold/40"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer select-none">
                      <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-gold/25 bg-carbon accent-gold focus:ring-gold/30" />
                      Tampilkan nonaktif
                    </label>
                  </div>
                )}

                {/* Table */}
                <div className="bg-cocoa rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#26211c]">
                        <tr>
                          {["Nama / Identitas", "Email / Username", "Role", "Status", "Terakhir Login", "Aksi"].map((h) => (
                            <th key={h} className="px-6 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {displayUsers.length === 0 ? (
                          <tr><td colSpan={6} className="px-6 py-10 text-center text-white/50 text-sm">Tidak ada data user.</td></tr>
                        ) : (
                          displayUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-[#26211c]">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium text-ivory">{user.full_name}</div>
                                <div className="text-xs text-white/40 font-mono">{user.id.slice(0, 8)}…</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                                {user.userType === "bms" ? (user.email ?? "-") : (
                                  <div>
                                    <div className="font-medium text-cream">{user.username ?? "-"}</div>
                                    {user.email && !user.email.endsWith("@internal.local") && <div className="text-xs text-white/40">{user.email}</div>}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">{getRoleBadge(user)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(user)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">{formatDate(user.last_login ?? user.last_login_at)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex gap-2">
                                  <button onClick={() => handleOpenEditModal(user)} className="text-indigo-600 hover:text-indigo-900 transition-colors" title="Edit"><Pencil className="w-5 h-5" /></button>
                                  <button onClick={() => setUserToToggle(user)} className={`${currentUserIsActive(user) ? "text-yellow-600 hover:text-yellow-900" : "text-emerald-300 hover:text-green-900"} transition-colors`} title={currentUserIsActive(user) ? "Nonaktifkan" : "Aktifkan"}><Power className="w-5 h-5" /></button>
                                  <button onClick={() => setUserToDelete(user)} className="text-rose-300 hover:text-red-900 transition-colors" title="Hapus"><Trash2 className="w-5 h-5" /></button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
            </>

            {/* ── Modal ── */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={modalTitle} size="md">
              {alert && (
                <div className="mb-4">
                  <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} autoClose duration={3000} />
                </div>
              )}

              {/* User Type Picker */}
              {!isEditMode && newUserType === null && (
                <UserTypePicker onSelect={setNewUserType} />
              )}

              {/* Superadmin Form */}
              {(isEditMode ? selectedUser?.userType === "bms" : newUserType === "bms") && (
                <BmsUserForm
                  isEditMode={isEditMode}
                  isSaving={isSaving}
                  form={bmsForm}
                  setForm={setBmsForm}
                  onSave={handleSaveBmsUser}
                  onClose={handleCloseModal}
                  onBack={() => setNewUserType(null)}
                  showAlert={showAlert}
                />
              )}

              {/* Supervisor Form */}
              {(isEditMode ? selectedUser?.userType === "supervisor" : newUserType === "supervisor") && (
                <SupervisorUserForm
                  isEditMode={isEditMode}
                  isSaving={isSaving}
                  form={supervisorForm}
                  setForm={setSupervisorForm}
                  onSave={handleSaveSupervisorUser}
                  onClose={handleCloseModal}
                  onBack={() => setNewUserType(null)}
                  showAlert={showAlert}
                />
              )}

              {/* OPRPRD Form */}
              {(isEditMode ? selectedUser?.userType === "oprprd" : newUserType === "oprprd") && (
                <OprprdUserForm
                  isEditMode={isEditMode}
                  isSaving={isSaving}
                  form={oprprdForm}
                  setForm={setOprprdForm}
                  roles={roles}
                  onSave={handleSaveOprprdUser}
                  onClose={handleCloseModal}
                  onBack={() => setNewUserType(null)}
                  showAlert={showAlert}
                />
              )}

              {/* Management Form */}
              {(isEditMode ? selectedUser?.userType === "management" : newUserType === "management") && (
                <ManagementUserForm
                  isEditMode={isEditMode}
                  isSaving={isSaving}
                  form={managementForm}
                  setForm={setManagementForm}
                  onSave={handleSaveManagementUser}
                  onClose={handleCloseModal}
                  onBack={() => setNewUserType(null)}
                  showAlert={showAlert}
                />
              )}
            </Modal>
          </main>
        </div>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={!!userToDelete}
        variant="danger"
        title="Hapus akun ini?"
        message={userToDelete ? `Akun "${userToDelete.full_name}" (${userToDelete.userType === "bms" ? userToDelete.email : userToDelete.username}) akan dihapus permanen beserta akses loginnya. Tindakan ini tidak dapat dibatalkan.` : ""}
        confirmText="Ya, Hapus"
        cancelText="Batal"
        isLoading={isDeletingUser}
        onConfirm={handleDeleteUser}
        onCancel={() => !isDeletingUser && setUserToDelete(null)}
      />
      <ConfirmDialog
        isOpen={!!userToToggle}
        variant="warning"
        title={userToToggle?.status === "active" ? "Nonaktifkan akun?" : "Aktifkan akun?"}
        message={userToToggle ? (userToToggle.status === "active" ? `Akun "${userToToggle.full_name}" akan dinonaktifkan. Pengguna tidak dapat login sampai diaktifkan kembali.` : `Akun "${userToToggle.full_name}" akan diaktifkan kembali. Pengguna dapat login seperti biasa.`) : ""}
        confirmText={userToToggle?.status === "active" ? "Ya, Nonaktifkan" : "Ya, Aktifkan"}
        cancelText="Batal"
        onConfirm={() => { handleToggleUserStatus(userToToggle!); setUserToToggle(null); }}
        onCancel={() => setUserToToggle(null)}
      />
    </>
  );
}
