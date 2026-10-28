// app/dashboard/superadmin/management/monitoring/page.tsx

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Loading from "@/components/ui/Loading";
import Alert from "@/components/ui/Alert";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import { LayoutGrid, List, Calendar, X, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { ManagerCard } from "@/components/dashboard/superadmin/ManagerCard";
import { TaskDetailModal } from "@/components/dashboard/superadmin/TaskDetailModal";
import { ROLE_DISPLAY } from "../_shared/constants";
import type { ManagerData } from "../_shared/types";
import { getManagerStats, isOverdue } from "../_shared/utils";
import { computeOverdueDays, getOverdueSeverity, getReviewWaitingDays } from "@/lib/overdue";
import type { Manager } from "@/components/dashboard/superadmin/ManagerCard";

type SortKey = "completion" | "overdue" | "name";
const PAGE_SIZE = 8;

export default function ManagementMonitoringPage() {
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [searchName, setSearchName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedManager, setSelectedManager] = useState<ManagerData | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("completion");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "all">("today");
  const datePickerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => { setClientUser(getClientUser()); }, []);
  useEffect(() => {
    if (!showDatePicker) return;
    const h = (e: MouseEvent) => { if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showDatePicker]);

  const { data, isLoading } = useQuery<{ success: boolean; data: ManagerData[] }>({
    queryKey: ["superadmin", "management-tasks"],
    queryFn: () => fetcher("/api/superadmin/management-tasks"),
    refetchInterval: 30_000,
  });

  const managers = useMemo(() => {
    const all = data?.data ?? [];
    return all.filter((m) => m.role_name.startsWith("leader_"));
  }, [data]);

  const filteredManagers = useMemo(() => {
    const result = managers.filter((m) => {
      if (searchName && !m.full_name.toLowerCase().includes(searchName.toLowerCase()) && !m.role_name.toLowerCase().includes(searchName.toLowerCase())) return false;
      return true;
    }).map((m) => {
      const ft = m.tasks.map((task) => {
        const fi = (task.items ?? []).filter((item) => {
          if (!dateFrom && !dateTo) return true;
          const d = item.progress?.[0]?.completed_at ? new Date(item.progress[0].completed_at) : null;
          if (dateFrom && (!d || d < new Date(dateFrom))) return false;
          if (dateTo && (!d || d > new Date(dateTo + "T23:59:59"))) return false;
          return true;
        });
        return { ...task, items: fi };
      });
      return { ...m, tasks: ft };
    });
    result.sort((a, b) => {
      const sa = getManagerStats(a); const sb = getManagerStats(b);
      if (sortKey === "completion") return sa.rate - sb.rate;
      if (sortKey === "overdue") {
        const oa = a.tasks.flatMap((tk) => (tk.items ?? []).map((item) => ({ item, deadline: tk.deadline }))).filter((x) => isOverdue(x.deadline ?? null, x.item.progress?.[0]?.status ?? null)).length;
        const ob = b.tasks.flatMap((tk) => (tk.items ?? []).map((item) => ({ item, deadline: tk.deadline }))).filter((x) => isOverdue(x.deadline ?? null, x.item.progress?.[0]?.status ?? null)).length;
        return ob - oa;
      }
      return a.full_name.localeCompare(b.full_name);
    });
    return result;
  }, [managers, searchName, dateFrom, dateTo, sortKey]);

  const visibleManagers = useMemo(() => filteredManagers.slice(0, visibleCount), [filteredManagers, visibleCount]);
  const hasMore = visibleCount < filteredManagers.length;

  const metrics = useMemo(() => {
    const allItems = filteredManagers.flatMap((m) => m.tasks.flatMap((t) => (t.items ?? []).map((item) => ({ item, deadline: t.deadline }))));
    const total = allItems.length;
    const done = allItems.filter((i) => i.item.progress?.[0]?.status === "selesai").length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const overdue = allItems.filter((i) => isOverdue(i.deadline ?? null, i.item.progress?.[0]?.status ?? null)).length;
    const atRisk = allItems.filter((i) => i.item.progress?.[0]?.status === "proses" && !isOverdue(i.deadline ?? null, i.item.progress?.[0]?.status ?? null)).length;
    const now = new Date(); now.setHours(23, 59, 59, 999);
    const twoDaysAhead = new Date(now.getTime() + 2 * 86400000);
    const dueSoon = allItems.filter((i) => { if (!i.deadline || i.item.progress?.[0]?.status === "selesai") return false; const d = new Date(i.deadline); return d >= now && d <= twoDaysAhead; }).length;
    return { completionRate, total, done, overdue, atRisk, dueSoon };
  }, [filteredManagers]);

  const dailyMetrics = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    const allItems = managers.flatMap((m) =>
      m.tasks.flatMap((t) => (t.items ?? []).map((item) => ({
        item, deadline: t.deadline, managerId: m.id,
        completedAt: item.progress?.[0]?.completed_at ?? null,
        status: item.progress?.[0]?.status ?? "belum",
        isCompleted: item.progress?.[0]?.is_completed ?? false,
      })))
    );

    const todayDone = allItems.filter((i) => i.isCompleted && i.completedAt && new Date(i.completedAt) >= today && new Date(i.completedAt) < tomorrow).length;
    const weekDone = allItems.filter((i) => i.isCompleted && i.completedAt && new Date(i.completedAt) >= weekAgo).length;
    const todayActive = new Set(allItems.filter((i) => i.isCompleted && i.completedAt && new Date(i.completedAt) >= today && new Date(i.completedAt) < tomorrow).map((i) => i.managerId)).size;

    const displayTotal = dateFilter === "today" ? allItems.filter((i) => i.isCompleted && i.completedAt && new Date(i.completedAt) >= today && new Date(i.completedAt) < tomorrow).length
      : dateFilter === "week" ? weekDone
      : metrics.done;
    const displayRate = dateFilter === "today" ? 0
      : dateFilter === "week" ? (metrics.total > 0 ? Math.round((weekDone / metrics.total) * 100) : 0)
      : metrics.completionRate;

    return { todayDone, weekDone, todayActive, displayTotal, displayRate };
  }, [managers, metrics, dateFilter]);

  const showAlert = (type: "success" | "error", msg: string) => { setAlert({ type, message: msg }); setTimeout(() => setAlert(null), 3000); };
  const handleSaveNote = async (progressId: string) => {
    const note = noteInput[progressId]?.trim(); if (note === undefined) return;
    try {
      const res = await fetch("/api/superadmin/management-tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ progress_id: progressId, admin_notes: note || null }) });
      if (!res.ok) throw new Error("Gagal");
      showAlert("success", "Catatan tersimpan");
      queryClient.invalidateQueries({ queryKey: ["superadmin", "management-tasks"] });
    } catch (e) { showAlert("error", e instanceof Error ? e.message : "Gagal"); }
  };
  const handleEscalate = async (manager: ManagerData) => {
    const allItems = manager.tasks.flatMap((tk) => (tk.items ?? []).map((item) => ({ item, taskTitle: tk.title, deadline: tk.deadline })));
    const oi = allItems.filter((i) => isOverdue(i.deadline ?? null, i.item.progress?.[0]?.status ?? null));
    const ai = allItems.filter((i) => i.item.progress?.[0]?.status === "proses" && !isOverdue(i.deadline ?? null, i.item.progress?.[0]?.status ?? null));
    const taskList = [...oi, ...ai].map((i) => `\u25C6 ${i.item.title} (${i.taskTitle})`).join("\n");
    const text = `Eskalasi \u2014 ${manager.full_name}\n\nTask perlu perhatian:\n${taskList}`;
    try { await navigator.clipboard.writeText(text); showAlert("success", "Template eskalasi disalin"); } catch { showAlert("error", "Gagal menyalin"); }
  };

  const handleReview = async (itemId: string, action: "approve" | "reject", notes?: string) => {
    try {
      const res = await fetch(`/api/superadmin/management-tasks/items/${itemId}/review`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, notes: notes || undefined }) });
      if (!res.ok) throw new Error("Gagal");
      showAlert("success", action === "approve" ? "Item disetujui" : "Item ditolak");
      // Update selectedManager in-place so modal reflects changes immediately
      if (selectedManager) {
        setSelectedManager({
          ...selectedManager,
          tasks: selectedManager.tasks.map((task) => ({
            ...task,
            items: (task.items ?? []).map((item) => {
              if (item.id !== itemId) return item;
              return {
                ...item,
                progress: (item.progress ?? []).map((pg) => ({
                  ...pg,
                  status: action === "approve" ? "approved" : "rejected",
                  is_completed: action === "approve",
                  completed_at: new Date().toISOString(),
                  review_notes: notes || null,
                })),
              };
            }),
          })),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["superadmin", "management-tasks"] });
    } catch { showAlert("error", "Gagal memperbarui status"); }
  };

  const hasFilters = !!(searchName || dateFrom || dateTo);
  const filterHint = hasFilters && filteredManagers.length !== managers.length ? `${filteredManagers.length} managers dari ${managers.length} total` : null;
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchName, dateFrom, dateTo, sortKey]);

    const P = {
    purple: "#7c3aed", purpleLight: "#7c3aed22", purpleMuted: "#a78bfa",
    green: "#34d399", greenLight: "#05966922", greenMuted: "#6ee7b7",
    gray: "#a8a29e", grayLight: "#1C1917", grayBorder: "#c9a22733",
    orange: "#f97316", orangeLight: "#f9731622",
    red: "#f87171", redLight: "#f8717122",
    ink: "#F5EFE3", card: "#2A2522",
  };

  const inputBase = "block w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors";
  const inputStyle = { borderColor: P.grayBorder, color: P.ink, background: P.card };
  const bgStyle = {
    background:
      "#26211C url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='0.75' fill='rgba(201,162,39,0.06)'/%3E%3C/svg%3E\") repeat",
  };
  const cardBase: React.CSSProperties = { background: P.card, borderRadius: 16, border: `1px solid ${P.grayBorder}`, padding: 20 };

  return (
    <div className="flex h-screen" style={bgStyle}>
      <Sidebar role="superadmin" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
        <main className="flex-1 overflow-y-auto p-6">
          {alert && <div className="mb-4"><Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /></div>}

          {/* Title Banner */}
          <div className="mb-6 p-5 rounded-2xl relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.purple}18 0%, transparent 60%)`, border: `1px solid ${P.grayBorder}` }}>
            <div className="absolute top-0 right-0 w-48 h-full pointer-events-none opacity-30" style={{ background: `radial-gradient(ellipse at top right, ${P.purpleMuted} 0%, transparent 70%)` }} />
            <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: P.purple }}>Management Monitoring</p>
                  <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">
                    {(["today", "week", "all"] as const).map((f) => (
                      <button key={f} onClick={() => setDateFilter(f)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${dateFilter === f ? "bg-cocoa text-purple-300 shadow-sm" : "text-white/50 hover:text-cream"}`}>
                        {f === "today" ? "Hari Ini" : f === "week" ? "Minggu Ini" : "Semua"}
                      </button>
                    ))}
                  </div>
                </div>
                <h2 className="text-[28px] font-bold leading-tight" style={{ color: P.ink }}>Monitor <span style={{ color: P.purple }}>Manajemen</span></h2>
              </div>
              <div className="flex items-center gap-4 sm:pb-1">
                {[
                  { label: dateFilter === "today" ? "Selesai Hari Ini" : dateFilter === "week" ? "Selesai Minggu Ini" : "Total", value: dateFilter === "all" ? metrics.total : dailyMetrics.displayTotal, color: P.purple },
                  { label: dateFilter === "all" ? "Selesai" : "Aktif", value: dateFilter === "all" ? metrics.done : dailyMetrics.todayActive, color: P.green },
                  { label: dateFilter === "all" ? "Rate" : "Overdue", value: dateFilter === "all" ? `${metrics.completionRate}%` : metrics.overdue, color: dateFilter === "all" ? P.orange : "#dc2626" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center"><p className="text-[10px] font-medium" style={{ color: P.gray }}>{label}</p><p className="text-base font-bold" style={{ color }}>{value}</p></div>
                ))}
                <div className="flex rounded-lg overflow-hidden shrink-0 border" style={{ borderColor: P.grayBorder }}>
                  <button onClick={() => setViewMode("cards")} className="px-3 py-2 text-xs font-medium transition-colors" style={{ background: viewMode === "cards" ? P.purple : "transparent", color: viewMode === "cards" ? "#fff" : P.gray }}><LayoutGrid className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setViewMode("table")} className="px-3 py-2 text-xs font-medium transition-colors" style={{ background: viewMode === "table" ? P.purple : "transparent", color: viewMode === "table" ? "#fff" : P.gray }}><List className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Inline Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Completion Rate", value: `${metrics.completionRate}%`, icon: <TrendingUp size={16} />, color: P.purple, bg: P.purpleLight },
              { label: "Total Items", value: metrics.total, icon: <LayoutGrid size={16} />, color: P.green, bg: P.greenLight },
              { label: "At-Risk / Overdue", value: metrics.atRisk + metrics.overdue, icon: <AlertTriangle size={16} />, color: metrics.overdue > 0 ? P.red : P.orange, bg: metrics.overdue > 0 ? P.redLight : P.orangeLight },
              { label: "Due in 2 Days", value: metrics.dueSoon, icon: <Clock size={16} />, color: metrics.dueSoon > 0 ? P.orange : P.green, bg: metrics.dueSoon > 0 ? P.orangeLight : P.greenLight },
            ].map(({ label, value, icon, color, bg }) => (
              <div key={label} className="rounded-xl p-4" style={{ background: bg }}>
                <div className="flex items-center gap-2 mb-2" style={{ color }}>{icon}</div>
                <p className="text-[10px] font-medium mb-0.5" style={{ color: P.gray }}>{label}</p>
                <p className="text-xl font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="mb-4 p-4 rounded-2xl" style={cardBase}>
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <input type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Cari nama atau role..." className={inputBase} style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = P.purple; }} onBlur={(e) => { e.currentTarget.style.borderColor = P.grayBorder; }} />
              </div>
              <div className="flex items-center gap-2">
                <div className="relative" ref={datePickerRef}>
                  <button type="button" onClick={() => setShowDatePicker(!showDatePicker)} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors"
                    style={{ borderColor: dateFrom || dateTo ? P.purple : P.grayBorder, color: dateFrom || dateTo ? P.purple : P.gray, background: P.card }}>
                    <Calendar className="h-3.5 w-3.5" />
                    {dateFrom || dateTo ? <span>{dateFrom ? new Date(dateFrom).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "…"}{" — "}{dateTo ? new Date(dateTo).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "…"}</span> : "Filter"}
                  </button>
                  {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="absolute -top-1 -right-1 rounded-full p-0.5" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}><X className="h-2.5 w-2.5" style={{ color: P.gray }} /></button>}
                  {showDatePicker && (
                    <div className="absolute right-0 top-full mt-1 z-30 rounded-xl border p-3 shadow-lg w-52" style={{ background: P.card, borderColor: P.grayBorder }}>
                      <div className="space-y-2">
                        <div><label className="text-[10px] font-semibold mb-1 block" style={{ color: P.gray }}>Dari</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none" style={{ borderColor: P.grayBorder, color: P.ink, background: P.grayLight }} onFocus={(e) => { e.currentTarget.style.borderColor = P.purple; }} /></div>
                        <div><label className="text-[10px] font-semibold mb-1 block" style={{ color: P.gray }}>Sampai</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none" style={{ borderColor: P.grayBorder, color: P.ink, background: P.grayLight }} onFocus={(e) => { e.currentTarget.style.borderColor = P.purple; }} /></div>
                        <button onClick={() => setShowDatePicker(false)} className="w-full rounded-lg py-1.5 text-[10px] font-semibold text-white transition-colors" style={{ background: P.purple }}>Terapkan</button>
                      </div>
                    </div>
                  )}
                </div>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={inputBase + " w-auto text-xs"} style={inputStyle}><option value="completion">Completion ↑</option><option value="overdue">Overdue ↓</option><option value="name">Nama A-Z</option></select>
              </div>
            </div>
          </div>

          {filterHint && <p className="text-[11px] mb-3" style={{ color: P.gray }}>{filterHint}</p>}

          {isLoading ? <Loading variant="skeleton" text="Memuat data..." /> : filteredManagers.length === 0 ? (
            <div className="text-center py-12 rounded-2xl" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}>
              {hasFilters ? <div className="space-y-2"><p className="text-sm" style={{ color: P.gray }}>Tidak ada hasil{searchName ? ` untuk "${searchName}"` : null}</p></div> : <p style={{ color: P.gray }}>Belum ada data manager dengan task.</p>}
            </div>
          ) : viewMode === "cards" ? (
            <><div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{visibleManagers.map((m) => <ManagerCard key={m.id} manager={m as Manager} onViewAll={setSelectedManager} onEscalate={handleEscalate} />)}</div>
              {hasMore && <div className="flex justify-center mt-4"><button onClick={() => setVisibleCount((p) => Math.min(p + PAGE_SIZE, filteredManagers.length))} className="rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors" style={{ border: `1px solid ${P.purple}`, color: P.purple, background: P.card }}>Tampilkan {Math.min(PAGE_SIZE, filteredManagers.length - visibleCount)} lainnya · {filteredManagers.length - visibleCount} tersisa</button></div>}</>
          ) : (
            <div className="rounded-2xl overflow-x-auto" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}>
              <table className="w-full text-sm">
                <thead style={{ background: P.grayLight }}><tr>{["Manager", "Progress", "Hari Ini", "Terlambat", "Status", "Aksi"].map((h) => <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider" style={{ color: P.gray, borderBottom: `1px solid ${P.grayBorder}` }}>{h}</th>)}</tr></thead>
                <tbody>{filteredManagers.map((m) => {
                  const s = getManagerStats(m);
                  const allItems = m.tasks.flatMap((t) => (t.items ?? []).map((item) => ({ item, deadline: t.deadline })));
                  const overdue = allItems.filter((i) => isOverdue(i.deadline ?? null, i.item.progress?.[0]?.status ?? null)).length;
                  const maxOverdueDays = Math.max(0, ...allItems.map((i) => computeOverdueDays(i.deadline ?? null)));
                  const overdueSev = getOverdueSeverity(maxOverdueDays);
                  const waitingItems = allItems.filter((i) => i.item.progress?.[0]?.status === "waiting_review");
                  const maxReviewDays = waitingItems.length > 0 ? Math.max(...waitingItems.map((i) => getReviewWaitingDays(i.item.progress?.[0]?.completed_at ?? null))) : 0;
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
                  const todayDone = allItems.filter((i) => i.item.progress?.[0]?.is_completed && i.item.progress?.[0]?.completed_at && new Date(i.item.progress![0].completed_at!) >= today && new Date(i.item.progress![0].completed_at!) < tomorrow).length;
                  return (<tr key={m.id} style={{ borderBottom: `1px solid ${P.grayBorder}` }}>
                    <td className="px-5 py-3"><p className="font-semibold" style={{ color: P.ink }}>{m.full_name}</p><p className="text-[11px]" style={{ color: P.gray }}>{ROLE_DISPLAY[m.role_name] ?? m.role_name}</p></td>
                    <td className="px-5 py-3"><div className="flex items-center gap-2"><div className="flex-1 flex gap-0.5 max-w-[120px]">{[...Array(s.total)].map((_, i) => { const st = allItems[i]?.item.progress?.[0]?.status ?? "belum"; return <div key={i} className="flex-1 h-1 rounded-full" style={{ background: st === "selesai" ? P.green : st === "proses" ? P.purple : P.grayBorder }} />; })}</div><span className="text-xs font-semibold" style={{ color: P.ink }}>{s.rate}%</span></div></td>
                    <td className="px-5 py-3"><span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full ${todayDone > 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-white/10 text-white/50"}`}>{todayDone > 0 ? `${todayDone} done` : "—"}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {overdueSev && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full" style={{ background: overdueSev.bg, color: overdueSev.color }}>{overdueSev.label}</span>}
                        {maxReviewDays > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full" style={{ background: P.purpleLight, color: P.purple }}>Review {maxReviewDays}h</span>}
                        {!overdueSev && maxReviewDays === 0 && <span className="text-[10px]" style={{ color: P.gray }}>—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3"><div className="flex items-center gap-1.5 flex-wrap">{s.done > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full" style={{ background: P.greenLight, color: P.green }}>{s.done} done</span>}{overdue > 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full" style={{ background: P.redLight, color: P.red }}>{overdue} overdue</span>}</div></td>
                    <td className="px-5 py-3"><button onClick={() => setSelectedManager(m)} className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors" style={{ border: `1px solid ${P.grayBorder}`, color: P.ink, background: P.card }}>Detail</button></td>
                  </tr>);
                })}</tbody>
              </table>
            </div>
          )}
        </main>
      </div>
      {selectedManager && <TaskDetailModal manager={selectedManager as unknown as Manager} noteInput={noteInput} setNoteInput={setNoteInput} onSaveNote={handleSaveNote} onReview={handleReview} onClose={() => setSelectedManager(null)} />}
    </div>
  );
}
