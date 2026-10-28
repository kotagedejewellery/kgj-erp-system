// app/dashboard/supervisor/accounts/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher, mutator } from "@/lib/api";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/MobileSidebar";
import Header from "@/components/layout/MobileHeader";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  AlertTriangle,
  Clock,
  Key,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Users,
} from "lucide-react";
import type { SupervisorGroup } from "@/types/roles";
import {
  StatusBadge,
  Avatar,
  AccountsSkeleton,
  formatDate,
  formatRelative,
  roleLabel,
  roleGroupLabel,
  roleGroupColor,
  type Account,
  type Role,
  type ModalType,
  type FilterStatus,
} from "./_components/shared";
import { CreateModal } from "./_components/CreateModal";
import { EditModal } from "./_components/EditModal";
import { PasswordModal } from "./_components/PasswordModal";
import { DeactivateModal } from "./_components/DeactivateModal";
import { DeleteModal } from "./_components/DeleteModal";

type FilterTab = "all" | "production" | "operational";

export default function SupervisorAccountsPage() {
  const router = useRouter();

  const [modal, setModal] = useState<ModalType>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [alert, setAlert] = useState<{ type: "success" | "error" | "warning" | "info"; message: string } | null>(null);

  const [resetPinTarget, setResetPinTarget] = useState<Account | null>(null);
  const [reseatingPin, setReseatingPin] = useState(false);

  const [_filter, _setFilter] = useState<FilterTab>("all");
  const [supervisorGroup, setSupervisorGroup] =
    useState<SupervisorGroup>("all");

  // Verify supervisor identity
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (!res.ok) {
        router.push("/workshop/login");
        return;
      }
      const json = await res.json();
      const u = json.data;
      const allowedStages: string[] = u.role?.allowed_stages ?? [];
      const canAccess =
        u.role?.role_group === "management" ||
        allowedStages.some((s: string) => s.startsWith("approval_"));
      if (!canAccess) {
        router.push("/workshop/login");
        return;
      }
      setUserEmail(u.username || u.full_name || "");
      if (u.role?.name === "production_supervisor") {
        setSupervisorGroup("production");
        _setFilter("production");
      } else if (u.role?.name === "operational_supervisor") {
        setSupervisorGroup("operational");
        _setFilter("operational");
      } else {
        setSupervisorGroup("all");
      }
    })();
  }, [router]);

  interface AccountsResponse { accounts: Account[]; roles: Role[]; supervisor: { scoped_group: string } | null; }

  const { data: accountsData, isLoading, error: queryError, refetch: refetchAccounts } = useQuery<AccountsResponse>({
    queryKey: ["supervisor-accounts"],
    queryFn: () => fetcher("/api/supervisor/accounts"),
  });

  const accounts = accountsData?.accounts ?? [];
  const roles = accountsData?.roles ?? [];
  const scopedGroup = accountsData?.supervisor?.scoped_group ?? "";

  const closeModal = () => {
    setModal(null);
    setSelectedAccount(null);
  };

  const handleCreated = () => {
    refetchAccounts();
    setAlert({ type: "success", message: "Akun berhasil dibuat" });
  };

  const handleUpdated = () => {
    refetchAccounts();
    closeModal();
    setAlert({ type: "success", message: "Akun berhasil diperbarui" });
  };

  const handleDeleted = () => {
    refetchAccounts();
    closeModal();
    setAlert({ type: "success", message: "Akun berhasil dihapus" });
  };

  const handleDeactivated = () => {
    refetchAccounts();
    closeModal();
  };

  const handleResetPin = async () => {
    if (!resetPinTarget) return;
    setReseatingPin(true);
    try {
      const res = await mutator<{ success: boolean; message: string }>(
        `/api/supervisor/accounts/${resetPinTarget.id}/reset-pin`,
        { method: "POST" },
      );
      setAlert({ type: "success", message: res.message });
      refetchAccounts();
    } catch (err) {
      setAlert({ type: "error", message: err instanceof Error ? err.message : "Gagal mereset PIN" });
    } finally {
      setReseatingPin(false);
      setResetPinTarget(null);
    }
  };

  const filtered = accounts.filter((a) => {
    const matchSearch =
      !search ||
      a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.username.toLowerCase().includes(search.toLowerCase()) ||
      (a.role?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (a.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount = accounts.filter((a) => a.status === "active").length;
  const inactiveCount = accounts.filter((a) => a.status === "inactive").length;

  const groupLabel =
    scopedGroup === "operational"
      ? "Tim Operasional"
      : scopedGroup === "production"
        ? "Tim Produksi"
        : "Semua Tim";

  return (
    <div className="flex flex-col md:flex-row h-screen bg-carbon">
      {/* Sidebar */}
      <Sidebar
        role="supervisor"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userEmail={userEmail}
          role="supervisor"
          logoutPath="/workshop/login"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {alert && (
            <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
          )}
          {/* Header */}
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-ivory">
                  Kelola Akun Tim
                </h1>
                {supervisorGroup === "production" && (
                  <span className="rounded-full bg-amber-500/10 border border-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Supervisor Produksi
                  </span>
                )}
                {supervisorGroup === "operational" && (
                  <span className="rounded-full bg-sky-500/20 border border-sky-400/20 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                    Supervisor Operasional
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-white/50">
                {groupLabel} — {accounts.length} akun terdaftar
              </p>
            </div>
            <button
              onClick={() => setModal("create")}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/100 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 active:scale-[0.98] transition-all min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
              Tambah Akun
            </button>
          </div>

          {/* Stats */}
          <div className="mb-4 sm:mb-5 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              {
                label: "Total Akun",
                value: accounts.length,
                icon: Users,
                color: "text-cream",
                bg: "bg-white/10",
              },
              {
                label: "Aktif",
                value: activeCount,
                icon: Shield,
                color: "text-emerald-300",
                bg: "bg-emerald-500/10",
              },
              {
                label: "Nonaktif",
                value: inactiveCount,
                icon: ShieldOff,
                color: "text-white/40",
                bg: "bg-white/10",
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className="rounded-xl border border-gold/15 bg-cocoa px-3 sm:px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${bg}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <p className="text-[11px] sm:text-xs font-medium text-white/50">
                    {label}
                  </p>
                </div>
                <p className={`mt-1.5 text-xl sm:text-2xl font-bold ${color}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Cari nama, username, email, atau role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gold/15 bg-cocoa py-2.5 pl-10 pr-4 text-sm text-cream placeholder:text-white/30 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100 transition"
              />
            </div>
            <div className="flex gap-1 rounded-xl border border-gold/15 bg-cocoa p-1">
              {(["all", "active", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filterStatus === s
                      ? "bg-amber-500/100 text-white shadow-sm"
                      : "text-white/50 hover:text-cream"
                  }`}
                >
                  {s === "all"
                    ? "Semua"
                    : s === "active"
                      ? "Aktif"
                      : "Nonaktif"}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <AccountsSkeleton />
          ) : queryError ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
              <AlertTriangle className="mb-3 h-8 w-8 text-rose-400" />
              <p className="text-sm font-medium text-cream">{queryError instanceof Error ? queryError.message : "Gagal memuat data"}</p>
              <button
                onClick={() => refetchAccounts()}
                className="mt-4 rounded-md border border-gold/15 bg-cocoa px-4 py-2.5 text-sm text-cream hover:bg-carbon min-h-[44px]"
              >
                Coba lagi
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-gold/10 bg-cocoa py-16 text-center shadow-sm px-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <Users className="h-8 w-8 text-white/40" />
              </div>
              <p className="text-sm font-medium text-white/50">
                {search || filterStatus !== "all"
                  ? "Tidak ada akun yang sesuai filter"
                  : "Belum ada akun dalam tim ini"}
              </p>
              {!search && filterStatus === "all" && (
                <button
                  onClick={() => setModal("create")}
                  className="mt-3 text-sm font-semibold text-amber-300 hover:text-amber-300"
                >
                  + Tambah akun pertama
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gold/15 bg-cocoa shadow-sm">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gold/10 bg-carbon">
                      {[
                        "Nama / Username",
                        "Role",
                        "Status",
                        "Login Terakhir",
                        "Dibuat",
                        "Aksi",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/50"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((account) => (
                      <tr
                        key={account.id}
                        className="hover:bg-carbon/60 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={account.full_name} />
                            <div>
                              <p className="font-medium text-cream">
                                {account.full_name}
                              </p>
                              <p className="text-xs text-white/40">
                                @{account.username}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {account.role ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-400/20">
                                {roleLabel(account.role.name)}
                              </span>
                              <span
                                className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${roleGroupColor(
                                  account.role.role_group,
                                )}`}
                              >
                                {roleGroupLabel(account.role.role_group)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-white/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={account.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-white/40" />
                            {formatRelative(account.last_login)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">
                          {formatDate(account.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {/* Edit */}
                            <button
                              onClick={() => {
                                setSelectedAccount(account);
                                setModal("edit");
                              }}
                              title="Edit"
                              className="rounded-lg p-1.5 text-white/40 hover:bg-amber-500/100/10 hover:text-amber-300 transition-colors"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {/* Password */}
                            <button
                              onClick={() => {
                                setSelectedAccount(account);
                                setModal("password");
                              }}
                              title="Reset Password"
                              className="rounded-lg p-1.5 text-white/40 hover:bg-sky-500/10 hover:text-sky-300 transition-colors"
                            >
                              <Key className="h-4 w-4" />
                            </button>
                            {/* Reset PIN — hanya untuk workshop worker */}
                            {account.role?.role_group === "production" || account.role?.role_group === "operational" ? (
                              <button
                                onClick={() => setResetPinTarget(account)}
                                title="Reset PIN"
                                className="rounded-lg p-1.5 text-white/40 hover:bg-amber-500/10 hover:text-amber-300 transition-colors"
                              >
                                <KeyRound className="h-4 w-4" />
                              </button>
                            ) : null}
                            {/* Deactivate/Activate */}
                            <button
                              onClick={() => {
                                setSelectedAccount(account);
                                setModal("deactivate");
                              }}
                              title={
                                account.status === "active"
                                  ? "Nonaktifkan"
                                  : "Aktifkan"
                              }
                              className={`rounded-lg p-1.5 transition-colors ${
                                account.status === "active"
                                  ? "text-white/40 hover:bg-yellow-50 hover:text-yellow-600"
                                  : "text-white/30 hover:bg-emerald-500/100/10 hover:text-emerald-300"
                              }`}
                            >
                              {account.status === "active" ? (
                                <ShieldOff className="h-4 w-4" />
                              ) : (
                                <Shield className="h-4 w-4" />
                              )}
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => {
                                setSelectedAccount(account);
                                setModal("delete");
                              }}
                              title="Hapus Akun"
                              className="rounded-lg p-1.5 text-white/40 hover:bg-rose-500/100/10 hover:text-rose-300 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-white/5 md:hidden">
                {filtered.map((account) => (
                  <div key={account.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={account.full_name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-medium text-cream">
                            {account.full_name}
                          </p>
                          <StatusBadge status={account.status} />
                        </div>
                        <p className="text-xs text-white/40">
                          @{account.username}
                        </p>
                        {account.role && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-400/20">
                              {roleLabel(account.role.name)}
                            </span>
                            <span
                              className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${roleGroupColor(
                                account.role.role_group,
                              )}`}
                            >
                              {roleGroupLabel(account.role.role_group)}
                            </span>
                          </div>
                        )}
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-white/40">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelative(account.last_login)}
                          </span>
                          <span>{formatDate(account.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedAccount(account);
                          setModal("edit");
                        }}
                        className="flex-1 rounded-lg border border-gold/15 py-2.5 text-xs font-medium text-cream hover:bg-carbon active:bg-white/10 transition-colors flex items-center justify-center gap-1"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAccount(account);
                          setModal("password");
                        }}
                        className="flex-1 rounded-lg border border-sky-400/20 py-2.5 text-xs font-medium text-sky-300 hover:bg-sky-500/10 active:bg-sky-500/20 transition-colors flex items-center justify-center gap-1"
                      >
                        <Key className="h-3 w-3" />
                        Reset PW
                      </button>
                      {account.role?.role_group === "production" || account.role?.role_group === "operational" ? (
                        <button
                          onClick={() => setResetPinTarget(account)}
                          className="rounded-lg border border-amber-400/20 px-2.5 py-2.5 text-xs font-medium text-amber-300 hover:bg-amber-500/10 active:bg-amber-500/20 transition-colors flex items-center justify-center"
                          title="Reset PIN"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => {
                          setSelectedAccount(account);
                          setModal("deactivate");
                        }}
                        className={`rounded-lg border px-2.5 py-2.5 text-xs font-medium transition-colors flex items-center justify-center ${
                          account.status === "active"
                            ? "border-yellow-200 text-yellow-600 hover:bg-yellow-50 active:bg-yellow-100"
                            : "border-emerald-200 text-emerald-300 hover:bg-emerald-500/100/10 active:bg-emerald-500/10"
                        }`}
                        title={
                          account.status === "active"
                            ? "Nonaktifkan"
                            : "Aktifkan"
                        }
                      >
                        {account.status === "active" ? (
                          <ShieldOff className="h-3.5 w-3.5" />
                        ) : (
                          <Shield className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAccount(account);
                          setModal("delete");
                        }}
                        className="rounded-lg border border-red-100 px-2.5 py-2.5 text-xs font-medium text-red-500 hover:bg-rose-500/100/10 active:bg-rose-500/10 transition-colors flex items-center justify-center"
                        title="Hapus Akun"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {modal === "create" && (
        <CreateModal
          roles={roles}
          onClose={closeModal}
          onCreated={handleCreated}
        />
      )}
      {modal === "edit" && selectedAccount && (
        <EditModal
          account={selectedAccount}
          roles={roles}
          onClose={closeModal}
          onUpdated={handleUpdated}
        />
      )}
      {modal === "password" && selectedAccount && (
        <PasswordModal account={selectedAccount} onClose={closeModal} />
      )}
      {modal === "deactivate" && selectedAccount && (
        <DeactivateModal
          account={selectedAccount}
          onClose={closeModal}
          onDeactivated={handleDeactivated}
        />
      )}
      {modal === "delete" && selectedAccount && (
        <DeleteModal
          account={selectedAccount}
          onClose={closeModal}
          onDeleted={handleDeleted}
        />
      )}

      {/* Reset PIN confirmation */}
      <ConfirmDialog
        isOpen={resetPinTarget !== null}
        title="Reset PIN"
        message={`Reset PIN untuk ${resetPinTarget?.full_name}? Worker harus mengatur PIN baru saat login berikutnya.`}
        confirmText="Reset PIN"
        variant="warning"
        isLoading={reseatingPin}
        onConfirm={handleResetPin}
        onCancel={() => setResetPinTarget(null)}
      />
    </div>
  );
}
