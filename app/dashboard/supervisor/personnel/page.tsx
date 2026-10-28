// app/dashboard/supervisor/personnel/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/MobileSidebar";
import Header from "@/components/layout/MobileHeader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Search, Trash2, Plus, X, Save } from "lucide-react";

interface PersonnelUser {
  id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  status: string | null;
  role_name: string;
  role_group: string;
  assignments: Assignment[];
}

interface Assignment {
  id: string;
  user_id: string;
  stage: string;
  person_code: string;
  sub_type: string | null;
  sort_order: number;
}

interface PersonnelResponse { success: boolean; data: { users: PersonnelUser[]; stages: string[] }; }

export default function PersonnelPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [assignModal, setAssignModal] = useState<{ user: PersonnelUser } | null>(null);
  const [assignStage, setAssignStage] = useState("");
  const [assignSubType, setAssignSubType] = useState("");
  const [assignCode, setAssignCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (!res.ok) {
        router.push("/workshop/login");
        return;
      }
      const json = await res.json();
      setUserEmail(json.data.username || json.data.full_name || "");
    })();
  }, [router]);

  const { data: personnelData, isLoading, refetch: refetchPersonnel } = useQuery<PersonnelResponse>({
    queryKey: ["supervisor-personnel"],
    queryFn: () => fetcher("/api/supervisor/personnel"),
  });

  const users = personnelData?.data.users ?? [];
  const stages = personnelData?.data.stages ?? [];

  const filtered = users.filter((u) =>
    !search ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.role_name.toLowerCase().includes(search.toLowerCase()) ||
    u.assignments.some((a) => a.person_code.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/supervisor/personnel?id=${deleteTarget.id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      setMessage({ type: "success", text: "Berhasil dihapus" });
      refetchPersonnel();
    } else {
      setMessage({ type: "error", text: json.error || "Gagal menghapus" });
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignModal || !assignStage || !assignCode) return;
    setSaving(true);
    const body: { user_id: string; stage: string; person_code: string; sub_type?: string } = { user_id: assignModal.user.id, stage: assignStage, person_code: assignCode };
    if (assignStage === "laser") body.sub_type = assignSubType;
    const res = await fetch("/api/supervisor/personnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (json.success) {
      setMessage({ type: "success", text: "Person berhasil ditambahkan" });
      setAssignModal(null);
      setAssignStage("");
      setAssignSubType("");
      setAssignCode("");
      refetchPersonnel();
    } else {
      setMessage({ type: "error", text: json.error || "Gagal menambahkan" });
    }
    setSaving(false);
  }

  // ── UI ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#26211c]">
        <Sidebar role="supervisor" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          userEmail={userEmail}
          role="supervisor"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-ivory">Personnel Management</h1>
                <p className="text-sm text-white/50 mt-1">Atur penugasan person untuk setiap tahap produksi</p>
              </div>
            </div>

            {/* Alert */}
            {message && (
              <div className={`p-3 rounded-lg mb-4 text-sm flex items-center justify-between ${
                message.type === "success" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-200" : "bg-rose-500/10 text-rose-300 border border-red-200"
              }`}>
                <span>{message.text}</span>
                <button onClick={() => setMessage(null)}><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* Search */}
            <div className="relative mb-6 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Cari nama, role, atau kode person..."
                className="w-full pl-9 pr-3 py-2 border border-gold/25 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="text-center py-12 text-white/50">Memuat data...</div>
            ) : (
              <div className="bg-cocoa rounded-xl border border-gold/15 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#26211c] border-b border-gold/15">
                        <th className="text-left px-4 py-3 font-semibold text-white/70">Nama</th>
                        <th className="text-left px-4 py-3 font-semibold text-white/70">Role</th>
                        <th className="text-left px-4 py-3 font-semibold text-white/70">Group</th>
                        <th className="text-left px-4 py-3 font-semibold text-white/70">Penugasan</th>
                        <th className="text-right px-4 py-3 font-semibold text-white/70">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filtered.map((u) => (
                        <tr key={u.id} className="hover:bg-[#26211c]">
                          <td className="px-4 py-3">
                            <div className="font-medium text-ivory">{u.full_name}</div>
                            <div className="text-xs text-white/50">{u.username || u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-cream">
                              {u.role_name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              u.role_group === "production"
                                ? "bg-amber-500/10 text-amber-300"
                                : "bg-sky-500/20 text-sky-300"
                            }`}>
                              {u.role_group}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {u.assignments.length > 0 ? (
                                u.assignments.map((a) => (
                                  <div key={a.id} className="group relative inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 text-xs border border-purple-400/20">
                                    <span className="font-medium">{a.person_code}</span>
                                    <span className="text-purple-300/70">—</span>
                                    <span className="text-purple-300">{a.stage}{a.sub_type ? ` (${a.sub_type})` : ""}</span>
                                    <button
                                      onClick={() => setDeleteTarget(a)}
                                      className="ml-0.5 text-purple-300/50 hover:text-rose-300 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <span className="text-xs text-white/40">Belum ada penugasan</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setAssignModal({ user: u })}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-purple-500/10 hover:bg-indigo-100 border border-purple-400/20 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Tambah
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-white/50">
                    Tidak ada data yang sesuai
                  </div>
                )}
              </div>
            )}
        </main>
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-cocoa rounded-xl shadow-xl w-full max-w-md">
            <form onSubmit={handleAssign}>
              <div className="p-6">
                <h2 className="text-lg font-bold text-ivory mb-1">Tambah Penugasan</h2>
                <p className="text-sm text-white/50 mb-4">{assignModal.user.full_name} — {assignModal.user.role_name}</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-cream mb-1">Stage</label>
                    <select
                      className="w-full px-3 py-2 border border-gold/25 rounded-lg text-sm focus:ring-2 focus:ring-gold/30 bg-carbon text-cream appearance-none"
                      value={assignStage}
                      onChange={(e) => setAssignStage(e.target.value)}
                      required
                    >
                      <option value="">Pilih stage</option>
                      {stages.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-cream mb-1">Kode Person</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gold/25 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase"
                      placeholder="Contoh: PR"
                      value={assignCode}
                      onChange={(e) => setAssignCode(e.target.value.toUpperCase())}
                      maxLength={10}
                      required
                    />
                  </div>

                  {assignStage === "laser" && (
                    <div>
                      <label className="block text-sm font-medium text-cream mb-1">Tipe Laser</label>
                      <select
                      className="w-full px-3 py-2 border border-gold/25 rounded-lg text-sm focus:ring-2 focus:ring-gold/30 bg-carbon text-cream appearance-none"
                        value={assignSubType}
                        onChange={(e) => setAssignSubType(e.target.value)}
                        required
                      >
                        <option value="">Pilih tipe</option>
                        <option value="batik">Batik</option>
                        <option value="nama">Nama</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#26211c] rounded-b-xl border-t border-gold/15">
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="px-4 py-2 text-sm font-medium text-cream bg-cocoa border border-gold/25 rounded-lg hover:bg-[#26211c]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || !assignStage || !assignCode || (assignStage === "laser" && !assignSubType)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Menyimpan..." : <><Save className="w-4 h-4" /> Simpan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Hapus Penugasan"
        message={`Hapus kode "${deleteTarget?.person_code}" dari stage ${deleteTarget?.stage}${deleteTarget?.sub_type ? ` (${deleteTarget.sub_type})` : ""}?`}
        confirmText="Hapus"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
