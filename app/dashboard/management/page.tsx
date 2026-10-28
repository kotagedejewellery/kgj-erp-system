// app/dashboard/management/page.tsx

"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Loading from "@/components/ui/Loading";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import { getDeadlineUrgency } from "@/lib/overdue";
import { ClipboardList, CheckCircle2, Clock, AlertTriangle, Calendar } from "lucide-react";

interface TaskItem {
  id: string;
  title: string;
  progress: Array<{ is_completed: boolean; status: string | null; completed_at: string | null }> | null;
}

interface Task {
  id: string;
  title: string;
  deadline: string | null;
  items: TaskItem[] | null;
}

export default function ManagementOverviewPage() {
  const router = useRouter();
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);

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

  const allItems = useMemo(() => tasks.flatMap((t) => t.items ?? []), [tasks]);
  const completed = allItems.filter((i) => i.progress?.[0]?.status === "selesai").length;
  const inProgress = allItems.filter((i) => i.progress?.[0]?.status === "proses").length;
  const pending = allItems.filter((i) => !i.progress?.[0]?.status || i.progress?.[0]?.status === "pending").length;
  const total = allItems.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  const P = { purple: "#7c3aed", purpleLight: "#7c3aed22", purpleMuted: "#a78bfa", green: "#34d399", greenLight: "#05966922", greenMuted: "#6ee7b7", gray: "#a8a29e", grayLight: "#1C1917", grayBorder: "#c9a22733", orange: "#f97316", orangeLight: "#f9731622", blue: "#60a5fa", blueLight: "#60a5fa22", red: "#f87171", redLight: "#f8717122", ink: "#F5EFE3", card: "#2A2522" };
  const bgStyle = { background: "#26211C url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='0.75' fill='rgba(201,162,39,0.06)'/%3E%3C/svg%3E\") repeat" };

  const kpiCards = [
    { label: "Total Tasks", value: tasks.length, icon: ClipboardList, color: P.purple, bg: P.purpleLight },
    { label: "Selesai", value: completed, icon: CheckCircle2, color: P.green, bg: P.greenLight },
    { label: "Proses", value: inProgress, icon: Clock, color: P.orange, bg: P.orangeLight },
    { label: "Belum", value: pending, icon: AlertTriangle, color: P.red, bg: P.redLight },
  ];

  return (
    <div className="flex h-screen" style={bgStyle}>
      <Sidebar role="management" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="management" />
        <main className="flex-1 overflow-y-auto p-6">

            {/* Gradient Banner */}
            <div className="mb-8 p-5 rounded-2xl relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${P.purple}18 0%, transparent 60%)`, border: `1px solid ${P.grayBorder}` }}>
              <div className="absolute top-0 right-0 w-48 h-full pointer-events-none opacity-30" style={{ background: `radial-gradient(ellipse at top right, ${P.purpleMuted} 0%, transparent 70%)` }} />
              <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-1" style={{ color: P.purple }}>Management Overview</p>
                  <h2 className="text-[28px] font-bold leading-tight" style={{ color: P.ink }}>Dashboard <span style={{ color: P.purple }}>Management</span></h2>
                </div>
                <div className="flex items-center gap-3 sm:pb-1">
                  {[{ label: "Total", value: total, color: P.purple }, { label: "Selesai", value: completed, color: P.green }, { label: "Proses", value: inProgress, color: P.orange }, { label: "Progress", value: `${progress}%`, color: P.ink }].map(({ label, value, color }) => (
                    <div key={label} className="text-center"><p className="text-[10px] font-medium" style={{ color: P.gray }}>{label}</p><p className="text-base font-bold" style={{ color }}>{value}</p></div>
                  ))}
                </div>
              </div>
            </div>

            {isLoading ? <Loading variant="skeleton" text="Memuat data..." /> : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {kpiCards.map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="rounded-2xl p-4" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl mb-3" style={{ background: bg }}>
                        <Icon className="h-5 w-5" style={{ color }} />
                      </div>
                      <p className="text-2xl font-bold" style={{ color: P.ink }}>{value}</p>
                      <p className="text-xs mt-0.5" style={{ color: P.gray }}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* Overall Progress */}
                <div className="rounded-2xl p-5 mb-6" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold" style={{ color: P.ink }}>Progress Keseluruhan</p>
                    <p className="text-sm font-bold" style={{ color: P.purple }}>{progress}%</p>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(total || 1)].map((_, i) => {
                      const item = allItems[i];
                      const st = item?.progress?.[0]?.status ?? "belum";
                      const fill = st === "selesai" ? P.green : st === "proses" ? P.purple : P.grayBorder;
                      return <div key={i} className="flex-1 h-2 rounded-full" style={{ background: fill }} />;
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-2"><span className="text-[10px]" style={{ color: P.gray }}>{completed} selesai · {inProgress} proses · {pending} belum</span></div>
                </div>

                {/* Task Cards */}
                {tasks.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}>
                    <ClipboardList className="mx-auto mb-3 h-10 w-10" style={{ color: P.gray }} /><p style={{ color: P.gray }}>Belum ada task.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => {
                      const items = task.items ?? [];
                      const done = items.filter((i) => i.progress?.[0]?.status === "selesai").length;
                      const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
                      const urgency = getDeadlineUrgency(task.deadline);
                      const borderStyle = urgency === "overdue" ? { borderLeft: `3px solid ${P.red}` } : urgency === "today" ? { borderLeft: `3px solid ${P.orange}` } : {};
                      return (
                        <div key={task.id} className="rounded-2xl p-4" style={{ background: P.card, border: `1px solid ${P.grayBorder}`, ...borderStyle }}>
                          <div className="flex items-center justify-between mb-2">
                            <div><p className="font-semibold" style={{ color: P.ink }}>{task.title}</p>
                              {task.deadline && <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: urgency === "overdue" ? P.red : urgency === "today" ? P.orange : P.gray }}><Calendar className="h-3 w-3" />{urgency === "overdue" ? "Terlambat — " : ""}{new Date(task.deadline).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</p>}
                            </div>
                            <div className="text-right shrink-0"><p className="text-sm font-semibold" style={{ color: P.ink }}>{done}/{items.length}</p><p className="text-[10px]" style={{ color: P.gray }}>{pct}%</p></div>
                          </div>
                          <div className="flex gap-1">
                            {items.map((item, i) => { const st = item.progress?.[0]?.status ?? "belum"; const fill = st === "selesai" ? P.green : st === "proses" ? P.purple : P.grayBorder; return <div key={i} className="flex-1 h-1.5 rounded-full" style={{ background: fill }} />; })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
        </main>
      </div>
    </div>
  );
}
