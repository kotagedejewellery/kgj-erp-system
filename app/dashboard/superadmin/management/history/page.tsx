// app/dashboard/superadmin/management/history/page.tsx

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Loading from "@/components/ui/Loading";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import { CheckCircle2, User, AlertCircle, ChevronDown, Calendar, Search, X, Paperclip } from "lucide-react";
import type { ManagerData, HistoryEntry } from "../_shared/types";
import { getManagerStats } from "../_shared/utils";

export default function ManagementHistoryPage() {
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expandedIdxs, setExpandedIdxs] = useState<Set<number>>(new Set());
  const [attachments, setAttachments] = useState<Record<string, { id: string; file_name: string; public_url: string; mime_type: string }[]>>({});
  const datePickerRef = useRef<HTMLDivElement>(null);
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

  const managerRates = useMemo(() => {
    const map = new Map<string, { done: number; total: number; rate: number }>();
    managers.forEach((m) => { const s = getManagerStats(m); map.set(m.id, { ...s }); });
    return map;
  }, [managers]);

  const history = useMemo(() => {
    const entries: HistoryEntry[] = managers.flatMap((m) => {
      const mRate = managerRates.get(m.id)!;
      return m.tasks.flatMap((task) => (task.items ?? []).filter((item) => item.progress?.[0]?.completed_at).map((item) => ({
        manager: m.full_name, managerId: m.id, role: m.role_name, item: item.title, itemId: item.id, task: task.title,
        status: item.progress![0].status ?? "belum", completed_at: item.progress![0].completed_at!,
        notes: item.progress![0].notes ?? null, kendala: item.progress![0].kendala ?? null, admin_notes: item.progress![0].admin_notes ?? null,
        managerRate: mRate.rate, managerDone: mRate.done, managerTotal: mRate.total,
      })));
    }).sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
    return entries;
  }, [managers, managerRates]);

  const filteredHistory = useMemo(() => {
    let result = history;
    const now = new Date(); now.setHours(23, 59, 59, 999);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);

    if (dateFilter === "today") {
      result = result.filter((e) => { const d = new Date(e.completed_at); return d >= todayStart && d <= now; });
    } else if (dateFilter === "week") {
      result = result.filter((e) => { const d = new Date(e.completed_at); return d >= weekStart && d <= now; });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) => e.manager.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || e.item.toLowerCase().includes(q) || e.task.toLowerCase().includes(q));
    }
    if (dateFrom) result = result.filter((e) => new Date(e.completed_at) >= new Date(dateFrom));
    if (dateTo) result = result.filter((e) => new Date(e.completed_at) <= new Date(dateTo + "T23:59:59"));
    return result;
  }, [history, searchQuery, dateFrom, dateTo, dateFilter]);

  const monthlyGroups = useMemo(() => {
    const groups: { label: string; entries: HistoryEntry[] }[] = [];
    for (const entry of filteredHistory) {
      const d = new Date(entry.completed_at);
      const label = `${d.toLocaleDateString("id-ID", { month: "long" })} ${d.getFullYear()}`;
      let group = groups.find((g) => g.label === label);
      if (!group) { group = { label, entries: [] }; groups.push(group); }
      group.entries.push(entry);
    }
    return groups;
  }, [filteredHistory]);

  const toggleExpand = (idx: number, itemId: string) => {
    setExpandedIdxs((prev) => {
      const n = new Set(prev);
      if (n.has(idx)) { n.delete(idx); return n; }
      n.add(idx);
      if (!attachments[itemId]) {
        fetch(`/api/management/tasks/items/${itemId}/attachments`)
          .then((res) => res.ok ? res.json() : null)
          .then((data) => { if (data) setAttachments((p) => ({ ...p, [itemId]: data })); })
          .catch(() => {});
      }
      return n;
    });
  };
  const uniqueManagers = new Set(history.map((e) => e.managerId)).size;
  const bgStyle = {
    background:
      "#26211C url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='0.75' fill='rgba(201,162,39,0.06)'/%3E%3C/svg%3E\") repeat",
  };

    const P = {
    purple: "#7c3aed", purpleLight: "#7c3aed22", purpleMuted: "#a78bfa",
    green: "#34d399", greenLight: "#05966922", greenMuted: "#6ee7b7",
    gray: "#a8a29e", grayLight: "#1C1917", grayBorder: "#c9a22733",
    orange: "#f97316", orangeLight: "#f9731622",
    red: "#f87171", redLight: "#f8717122",
    ink: "#F5EFE3", card: "#2A2522",
  };

  return (
    <div className="flex h-screen" style={bgStyle}>
      <Sidebar role="superadmin" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Title Banner */}
          <div className="mb-6 p-5 rounded-2xl relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.purple}18 0%, transparent 60%)`, border: `1px solid ${P.grayBorder}` }}>
            <div className="absolute top-0 right-0 w-48 h-full pointer-events-none opacity-30" style={{ background: `radial-gradient(ellipse at top right, ${P.purpleMuted} 0%, transparent 70%)` }} />
            <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={{ color: P.purple }}>Management History</p>
                <h2 className="text-[28px] font-bold leading-tight" style={{ color: P.ink }}>Riwayat <span style={{ color: P.purple }}>Aktivitas</span></h2>
              </div>
              <div className="flex items-center gap-4 sm:pb-1">
                {[
                  { label: "Entri", value: filteredHistory.length, color: P.purple },
                  { label: "Managers", value: uniqueManagers, color: P.green },
                  { label: "Selesai", value: filteredHistory.filter((e) => e.status === "selesai").length, color: P.orange },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center"><p className="text-[10px] font-medium" style={{ color: P.gray }}>{label}</p><p className="text-base font-bold" style={{ color }}>{value}</p></div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: P.gray }} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nama / role / task..." className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none transition-colors" style={{ borderColor: P.grayBorder, color: P.ink, background: P.card }} onFocus={(e) => { e.currentTarget.style.borderColor = P.purple; }} onBlur={(e) => { e.currentTarget.style.borderColor = P.grayBorder; }} />
              {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: P.gray }}><X className="h-3 w-3" /></button>}
            </div>
            <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5 shrink-0">
              {(["today", "week", "all"] as const).map((f) => (
                <button key={f} onClick={() => setDateFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${dateFilter === f ? "bg-cocoa text-purple-300 shadow-sm" : "text-white/50 hover:text-cream"}`}>
                  {f === "today" ? "Hari Ini" : f === "week" ? "Minggu Ini" : "Semua"}
                </button>
              ))}
            </div>
            <div className="relative" ref={datePickerRef}>
              <button type="button" onClick={() => setShowDatePicker(!showDatePicker)} className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors" style={{ borderColor: dateFrom || dateTo ? P.purple : P.grayBorder, color: dateFrom || dateTo ? P.purple : P.gray, background: P.card }}>
                <Calendar className="h-3.5 w-3.5" />{dateFrom || dateTo ? <span>{dateFrom ? new Date(dateFrom).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "…"}{" — "}{dateTo ? new Date(dateTo).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "…"}</span> : "Filter"}
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
          </div>

          {filteredHistory.length > 0 && (
            <div className="flex items-center gap-4 rounded-2xl px-4 py-2 mb-6" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: P.gray }}><CheckCircle2 className="h-3.5 w-3.5" style={{ color: P.green }} />{filteredHistory.length} entri log</div>
              <div className="w-px h-4" style={{ background: P.grayBorder }} />
              <div className="flex items-center gap-1.5 text-xs" style={{ color: P.gray }}><User className="h-3.5 w-3.5" style={{ color: P.purple }} />{uniqueManagers} managers</div>
            </div>
          )}

          {isLoading ? <div className="p-12"><Loading variant="skeleton" text="Memuat data..." /></div> : filteredHistory.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}><CheckCircle2 className="mx-auto mb-3 h-10 w-10" style={{ color: P.gray }} /><p style={{ color: P.gray }}>Belum ada riwayat.</p></div>
          ) : (
            <div className="space-y-10">
              {monthlyGroups.map((month) => (
                <div key={month.label}>
                  <div className="flex items-center gap-4 mb-5 sticky top-0 z-10 py-2" style={{ background: bgStyle.background }}>
                    <div className="shrink-0 flex flex-col items-center"><span className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: P.purple }}>{month.label.slice(0, 3)}</span><span className="text-lg font-bold" style={{ color: P.ink, lineHeight: 1 }}>{month.label.split(" ")[1]}</span></div>
                    <div className="flex-1 h-px" style={{ background: P.grayBorder }} />
                  </div>
                  <div className="relative pl-8">
                    <div className="absolute left-[11px] top-2 bottom-2 w-px" style={{ background: P.grayBorder }} />
                    {month.entries.map((entry) => {
                      const globalIdx = history.indexOf(entry);
                      const isExpanded = expandedIdxs.has(globalIdx);
                      const statusColor = entry.status === "selesai" ? P.green : entry.status === "proses" ? P.orange : "#dc2626";
                      const barColor = entry.managerRate >= 80 ? P.green : entry.managerRate >= 50 ? P.purple : "#dc2626";
                      return (
                        <div key={globalIdx} className="relative pb-3 last:pb-0">
                          <div className="absolute left-[-28px] top-1.5 rounded-full border-2" style={{ width: 10, height: 10, borderColor: statusColor, background: "#F9FAFB" }} />
                          <div className="rounded-2xl border p-4 cursor-pointer transition-colors" style={{ background: P.card, borderColor: P.grayBorder }} onClick={() => toggleExpand(globalIdx, entry.itemId)}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: barColor }} /><span className="text-sm font-semibold truncate" style={{ color: P.ink }}>{entry.manager}</span><span className="text-[10px]" style={{ color: P.gray }}>{entry.role}</span></div>
                              <span className="text-[10px] shrink-0" style={{ color: P.gray }}>{new Date(entry.completed_at).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: P.grayBorder }}><div className="h-full rounded-full" style={{ width: `${entry.managerRate}%`, background: barColor }} /></div>
                              <span className="text-[10px] shrink-0" style={{ color: P.gray }}>{entry.managerDone}/{entry.managerTotal}</span>
                              <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium shrink-0" style={{ background: statusColor === P.green ? P.greenLight : statusColor === P.orange ? P.orangeLight : P.redLight, color: statusColor }}>
                                {entry.status === "selesai" ? "Selesai" : entry.status === "proses" ? "Proses" : "Belum"}
                              </span>
                              {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" style={{ color: P.purple }} /> : <ChevronDown className="h-3 w-3 shrink-0 rotate-[-90deg]" style={{ color: P.gray }} />}
                            </div>
                            {isExpanded && (
                              <div className="mt-3 pt-3 space-y-2 text-[11px]" style={{ borderTop: `1px solid ${P.grayBorder}` }}>
                                <div className="flex items-start gap-2"><span className="shrink-0 font-medium" style={{ color: P.gray, width: 90 }}>Task</span><span style={{ color: P.ink }}>{entry.task}</span></div>
                                <div className="flex items-start gap-2"><span className="shrink-0 font-medium" style={{ color: P.gray, width: 90 }}>Sub-task</span><span className="font-semibold" style={{ color: P.ink }}>{entry.item}</span></div>
                                {entry.notes && <div className="flex items-start gap-2"><span className="shrink-0 font-medium" style={{ color: P.gray, width: 90 }}>Catatan</span><span style={{ color: P.ink }}>{entry.notes}</span></div>}
                                {entry.kendala && <div className="flex items-start gap-2"><span className="shrink-0 font-medium flex items-center gap-1" style={{ color: "#dc2626", width: 90 }}><AlertCircle className="h-3 w-3" /> Kendala</span><span style={{ color: "#dc2626" }}>{entry.kendala}</span></div>}
                                {entry.admin_notes && <div className="flex items-start gap-2"><span className="shrink-0 font-medium" style={{ color: P.purple, width: 90 }}>Catatan Admin</span><span style={{ color: P.purple }}>{entry.admin_notes}</span></div>}
                                {(attachments[entry.itemId]?.length ?? 0) > 0 && (
                                  <div className="flex items-start gap-2">
                                    <span className="shrink-0 font-medium flex items-center gap-1" style={{ color: P.purple, width: 90 }}><Paperclip className="h-3 w-3" /> Lampiran</span>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {(attachments[entry.itemId] ?? []).map((f) => {
                                        const isImg = f.mime_type?.startsWith("image/");
                                        return (
                                          <a key={f.id} href={f.public_url} target="_blank" rel="noreferrer"
                                            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium hover:bg-purple-50 transition-colors shrink-0"
                                            style={{ borderColor: P.grayBorder, color: P.purple }}>
                                            {isImg ? (
                                              // eslint-disable-next-line @next/next/no-img-element
                                              <img src={f.public_url} alt={f.file_name} className="w-3.5 h-3.5 rounded object-cover" />
                                            ) : (
                                              <Paperclip className="w-3 h-3" />
                                            )}
                                            <span className="max-w-[80px] truncate">{f.file_name}</span>
                                          </a>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
