// app/dashboard/management/history/page.tsx

"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Loading from "@/components/ui/Loading";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import { CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";

interface TaskItem {
  id: string;
  title: string;
  progress: Array<{
    is_completed: boolean; status: string | null; completed_at: string | null;
    admin_notes: string | null; notes: string | null; kendala: string | null;
  }> | null;
}

interface Task {
  id: string;
  title: string;
  items: TaskItem[] | null;
}

interface HistoryEntry {
  item: string;
  task: string;
  status: string;
  completed_at: string;
  notes: string | null;
  kendala: string | null;
  admin_notes: string | null;
}

export default function ManagementHistoryPage() {
  const router = useRouter();
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [expandedIdxs, setExpandedIdxs] = useState<Set<number>>(new Set());
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "all">("all");

  useEffect(() => {
    const u = getClientUser();
    if (!u) { router.push("/login"); return; }
    setClientUser(u);
  }, [router]);

  const { data, isLoading } = useQuery<{ success: boolean; data: Task[] }>({
    queryKey: ["management-tasks"],
    queryFn: () => fetcher("/api/management/tasks"),
    refetchInterval: 30_000,
  });

  const tasks = useMemo(() => data?.data ?? [], [data]);
  const history = useMemo(() => {
    return tasks.flatMap((task) =>
      (task.items ?? [])
        .filter((item) => item.progress?.[0]?.completed_at)
        .map((item) => ({
          item: item.title,
          task: task.title,
          status: item.progress![0].status ?? "belum",
          completed_at: item.progress![0].completed_at!,
          notes: item.progress![0].notes ?? null,
          kendala: item.progress![0].kendala ?? null,
          admin_notes: item.progress![0].admin_notes ?? null,
        })),
    ).sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
  }, [tasks]);

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
    return result;
  }, [history, dateFilter]);

  const monthGroups = useMemo(() => {
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

  const toggleExpand = (idx: number) => setExpandedIdxs((prev) => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  const statusColor = (status: string) => status === "selesai" ? "#059669" : status === "proses" ? "#ea580c" : "#dc2626";
  const statusLabel = (status: string) => status === "selesai" ? "Selesai" : status === "proses" ? "Proses" : "Belum";

  const P = { purple: "#7c3aed", purpleLight: "#7c3aed22", purpleMuted: "#a78bfa", green: "#34d399", greenLight: "#05966922", greenMuted: "#6ee7b7", gray: "#a8a29e", grayLight: "#1C1917", grayBorder: "#c9a22733", orange: "#f97316", orangeLight: "#f9731622", blue: "#60a5fa", blueLight: "#60a5fa22", red: "#f87171", redLight: "#f8717122", ink: "#F5EFE3", card: "#2A2522" };
  const bgStyle = { background: "#26211C url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='0.75' fill='rgba(201,162,39,0.06)'/%3E%3C/svg%3E\") repeat" };

  return (
    <div className="flex h-screen" style={bgStyle}>
      <Sidebar role="management" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="management" />
        <main className="flex-1 overflow-y-auto p-6">

            {/* Gradient Banner */}
            <div className="mb-6 p-5 rounded-2xl relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.purple}18 0%, transparent 60%)`, border: `1px solid ${P.grayBorder}` }}>
              <div className="absolute top-0 right-0 w-48 h-full pointer-events-none opacity-30" style={{ background: `radial-gradient(ellipse at top right, ${P.purpleMuted} 0%, transparent 70%)` }} />
              <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={{ color: P.purple }}>Management History</p>
                <div className="flex items-center gap-2">
                  <h2 className="text-[28px] font-bold leading-tight" style={{ color: P.ink }}>Riwayat <span style={{ color: P.purple }}>Tugas</span></h2>
                  <div className="flex gap-0.5 bg-white/10 rounded-lg p-0.5">
                    {(["today", "week", "all"] as const).map((f) => (
                      <button key={f} onClick={() => setDateFilter(f)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${dateFilter === f ? "bg-cocoa text-purple-300 shadow-sm" : "text-white/50 hover:text-cream"}`}>
                        {f === "today" ? "Hari Ini" : f === "week" ? "Minggu Ini" : "Semua"}
                      </button>
                    ))}
                  </div>
                </div>
                </div>
                <div className="flex items-center gap-3 sm:pb-1">
                  {[{ label: "Entri", value: filteredHistory.length, color: P.purple }, { label: "Selesai", value: filteredHistory.filter((e) => e.status === "selesai").length, color: P.green }, { label: "Belum", value: filteredHistory.filter((e) => e.status !== "selesai").length, color: P.red }].map(({ label, value, color }) => (
                    <div key={label} className="text-center"><p className="text-[10px] font-medium" style={{ color: P.gray }}>{label}</p><p className="text-base font-bold" style={{ color }}>{value}</p></div>
                  ))}
                </div>
              </div>
            </div>

          {isLoading ? <Loading variant="skeleton" text="Memuat data..." /> : history.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}><CheckCircle2 className="mx-auto mb-3 h-10 w-10" style={{ color: P.gray }} /><p style={{ color: P.gray }}>Belum ada riwayat penyelesaian tugas.</p></div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}><CheckCircle2 className="mx-auto mb-3 h-10 w-10" style={{ color: P.gray }} /><p style={{ color: P.gray }}>Tidak ada riwayat untuk filter ini.</p></div>
          ) : (
              <div className="space-y-10">
                {monthGroups.map((month) => (
                  <div key={month.label}>
                    <div className="flex items-center gap-4 mb-5 sticky top-0 z-10 py-2" style={{ background: bgStyle.background }}>
                      <div className="shrink-0 flex flex-col items-center"><span className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: P.purple }}>{month.label.slice(0, 3)}</span><span className="text-lg font-bold" style={{ color: P.ink, lineHeight: 1 }}>{month.label.split(" ")[1]}</span></div>
                      <div className="flex-1 h-px" style={{ background: P.grayBorder }} /><span className="text-[10px]" style={{ color: P.gray }}>{month.entries.length}</span>
                    </div>
                    <div className="relative pl-8">
                      <div className="absolute left-[11px] top-2 bottom-2 w-px" style={{ background: P.grayBorder }} />
                      {month.entries.map((entry) => {
                        const globalIdx = history.indexOf(entry); const isExpanded = expandedIdxs.has(globalIdx); const clr = statusColor(entry.status);
                        return (
                          <div key={globalIdx} className="relative pb-3 last:pb-0">
                            <div className="absolute left-[-28px] top-1.5 rounded-full border-2" style={{ width: 10, height: 10, borderColor: clr, background: P.card }} />
                            <div className="rounded-2xl border p-3 cursor-pointer transition-colors" style={{ background: P.card, borderColor: P.grayBorder }} onClick={() => toggleExpand(globalIdx)}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0"><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: clr }} /><span className="text-sm font-semibold truncate" style={{ color: P.ink }}>{entry.item}</span></div>
                                <span className="text-[10px] shrink-0" style={{ color: P.gray }}>{new Date(entry.completed_at).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium shrink-0" style={{ background: clr === P.green ? P.greenLight : clr === P.orange ? P.orangeLight : P.redLight, color: clr }}>{statusLabel(entry.status)}</span>
                                <span className="text-[10px]" style={{ color: P.gray }}>{entry.task}</span>
                                {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0 ml-auto" style={{ color: P.purple }} /> : <ChevronDown className="h-3 w-3 shrink-0 ml-auto rotate-[-90deg]" style={{ color: P.gray }} />}
                              </div>
                              {isExpanded && (
                                <div className="mt-2 pt-2 space-y-2 text-[11px]" style={{ borderTop: `1px solid ${P.grayBorder}` }}>
                                  <div className="flex items-start gap-2"><span className="shrink-0 font-medium" style={{ color: P.gray, width: 80 }}>Catatan</span><span style={{ color: entry.notes ? P.ink : P.gray }}>{entry.notes || "—"}</span></div>
                                  <div className="flex items-start gap-2"><span className="shrink-0 font-medium flex items-center gap-1" style={{ color: entry.kendala ? P.red : P.gray, width: 80 }}><AlertCircle className="h-3 w-3" /> Kendala</span><span style={{ color: entry.kendala ? P.red : P.gray }}>{entry.kendala || "—"}</span></div>
                                  {entry.admin_notes && <div className="flex items-start gap-2"><span className="shrink-0 font-medium" style={{ color: P.purple, width: 80 }}>Admin</span><span style={{ color: P.purple }}>{entry.admin_notes}</span></div>}
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
