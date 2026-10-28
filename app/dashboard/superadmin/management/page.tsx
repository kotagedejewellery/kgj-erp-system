// app/dashboard/superadmin/management/page.tsx

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Loading from "@/components/ui/Loading";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import { CheckCircle, Circle, Clock, ExternalLink, Users, X } from "lucide-react";
import { ROLE_DISPLAY } from "./_shared/constants";
import type { ManagerData } from "./_shared/types";
import {
  getManagerStats,
  computeDashboardStats,
  computeStatusSummary,
  sortByRate,
  useAnimatedValue,
  isOverdue,
} from "./_shared/utils";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

export default function ManagementDashboardPage() {
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [drillManager, setDrillManager] = useState<ManagerData | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setClientUser(getClientUser()); setMounted(true); }, []);

  const { data, isLoading } = useQuery<{ success: boolean; data: ManagerData[] }>({
    queryKey: ["superadmin", "management-tasks"],
    queryFn: () => fetcher("/api/superadmin/management-tasks"),
    refetchInterval: 30_000,
  });

  const managers = useMemo(() => {
    const all = data?.data ?? [];
    return all.filter((m) => m.role_name.startsWith("leader_"));
  }, [data]);
  const stats = useMemo(() => computeDashboardStats(managers), [managers]);
  const animatedRate = useAnimatedValue(stats.overallRate);
  const comparison = useMemo(() => sortByRate(managers), [managers]);
  const statusSum = useMemo(() => computeStatusSummary(managers), [managers]);

  const realTrend = useMemo(() => {
    const weeks: { label: string; completed: number }[] = [];
    const now = new Date();
    for (let w = 7; w >= 0; w--) {
      const start = new Date(now);
      start.setDate(start.getDate() - (w * 7 + 6));
      const end = new Date(now);
      end.setDate(end.getDate() - w * 7);
      const count = managers.flatMap((m) =>
        m.tasks.flatMap((t) => (t.items ?? []).filter((item) => {
          const d = item.progress?.[0]?.completed_at;
          if (!d || !item.progress?.[0]?.is_completed) return false;
          const c = new Date(d);
          return c >= start && c <= end;
        }))
      ).length;
      weeks.push({ label: `W${8 - w}`, completed: count });
    }
    return weeks;
  }, [managers]);

  const handleDrillClose = useCallback(() => setDrillManager(null), []);
  const handleEscalateModal = useCallback(async () => {
    if (!drillManager) return;
    const allItems = drillManager.tasks.flatMap((tk) => (tk.items ?? []).map((item) => ({ item, taskTitle: tk.title, deadline: tk.deadline })));
    const overdueItems = allItems.filter((i) => isOverdue(i.deadline ?? null, i.item.progress?.[0]?.status ?? null));
    const taskList = overdueItems.map((i) => `\u25C6 ${i.item.title} (${i.taskTitle})`).join("\n");
    const text = `Eskalasi \u2014 ${drillManager.full_name}\n\nTask overdue:\n${taskList}`;
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
    handleDrillClose();
  }, [drillManager, handleDrillClose]);

  useEffect(() => {
    if (!drillManager) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") handleDrillClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [drillManager, handleDrillClose]);

  const recentActivity = useMemo(() => {
    const all = managers.flatMap((m) =>
      m.tasks.flatMap((t) => (t.items ?? []).map((item) => ({
        item, task: t.title, manager: m.full_name, managerId: m.id,
        completedAt: item.progress?.[0]?.completed_at ?? null,
        status: item.progress?.[0]?.status ?? "belum",
        isCompleted: item.progress?.[0]?.is_completed ?? false,
      })))
    ).filter((a) => a.isCompleted && a.completedAt)
     .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
     .slice(0, 8);
    return all;
  }, [managers]);

  const wowComparison = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const items = managers.flatMap((m) =>
      m.tasks.flatMap((t) => (t.items ?? []).map((item) => ({
        completedAt: item.progress?.[0]?.completed_at ?? null,
        isCompleted: item.progress?.[0]?.is_completed ?? false,
      })))
    );
    const thisWeek = items.filter((i) => i.isCompleted && i.completedAt && new Date(i.completedAt) >= weekAgo).length;
    const lastWeek = items.filter((i) => i.isCompleted && i.completedAt && new Date(i.completedAt) >= twoWeeksAgo && new Date(i.completedAt) < weekAgo).length;
    const delta = thisWeek - lastWeek;
    return { thisWeek, lastWeek, delta };
  }, [managers]);

  const bgParchment = {
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

  const bend = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(6px)",
    transition: "opacity 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1)",
    transitionDelay: `${delay}ms`,
  });

  const cardBase: React.CSSProperties = {
    background: P.card,
    borderRadius: 16,
    border: `1px solid ${P.grayBorder}`,
    padding: 20,
  };

  const totalItems = statusSum.onTrack + statusSum.atRisk + statusSum.overdue;

  const dualBar = useMemo(() => {
    const top = [...comparison].slice(0, 5);
    return top.map((m) => ({
      name: m.manager.full_name.split(" ").slice(0, 2).join(" "),
      done: m.done,
      overdue: m.manager.tasks.flatMap((t) => (t.items ?? []).filter((item) => {
        if (item.progress?.[0]?.is_completed) return false;
        return isOverdue(t.deadline ?? null, item.progress?.[0]?.status ?? null);
      })).length,
    }));
  }, [comparison]);

  const pendingReviews = useMemo(() => {
    return managers.flatMap((m) =>
      m.tasks.flatMap((t) => (t.items ?? []).filter((item) =>
        item.progress?.[0]?.status === "waiting_review"
      ))
    ).length;
  }, [managers]);

  if (!mounted) {
    return (
      <div className="flex h-screen" style={bgParchment}>
        <Sidebar role="superadmin" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header userEmail="" role="superadmin" />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2 h-[100px] rounded-2xl bg-cocoa/60 animate-pulse" />
              <div className="lg:col-span-2 h-[100px] rounded-2xl bg-cocoa/60 animate-pulse" />
              <div className="lg:col-span-2 h-[200px] rounded-2xl bg-cocoa/60 animate-pulse" />
              <div className="h-[200px] rounded-2xl bg-cocoa/60 animate-pulse" />
              <div className="h-[200px] rounded-2xl bg-cocoa/60 animate-pulse" />
              <div className="lg:col-span-2 h-[200px] rounded-2xl bg-cocoa/60 animate-pulse" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={bgParchment}>
      <Sidebar role="superadmin" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
        <main className="flex-1 overflow-y-auto p-6">
          {isLoading ? <div className="p-12"><Loading variant="skeleton" text="Memuat data..." /></div> : managers.length === 0 ? (
            <div className="py-20 flex flex-col items-center" style={{ color: P.gray }}>
              <Users className="w-10 h-10 mb-4 opacity-40" />
              <p className="text-base font-medium mb-2" style={{ color: P.ink }}>Belum ada manager terdaftar</p>
              <p className="text-sm" style={{ color: P.gray }}>Data management akan muncul setelah ada leader yang ditugaskan.</p>
            </div>
          ) : (
            <div>
              <div className="mb-6 p-5 rounded-2xl relative overflow-hidden" style={{ ...bend(0), background: `linear-gradient(135deg, ${P.purple}18 0%, transparent 60%)`, border: `1px solid ${P.grayBorder}` }}>
                <div className="absolute top-0 right-0 w-48 h-full pointer-events-none opacity-30" style={{ background: `radial-gradient(ellipse at top right, ${P.purpleMuted} 0%, transparent 70%)` }} />
                <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: P.purple }}>Management Dashboard</p>
                    </div>
                    <h2 className="text-[28px] font-bold leading-tight" style={{ color: P.ink }}>Performance <span style={{ color: P.purple }}>Overview</span></h2>
                  </div>
                  <div className="flex items-center gap-4 sm:pb-1">
                    {[
                      { label: "Managers", value: managers.length, color: P.purple },
                      { label: "Tasks", value: stats.totalTasks, color: P.green },
                      { label: "Review", value: pendingReviews, color: P.orange },
                      { label: "Done", value: `${stats.overallRate}%`, color: P.gray },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="text-center">
                        <p className="text-[10px] font-medium" style={{ color: P.gray }}>{label}</p>
                        <p className="text-base font-bold" style={{ color }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">

              {/* Hero Stat Card + Stat Cluster */}
              <div className="lg:col-span-2" style={{ ...cardBase, ...bend(0) }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: P.gray }}>Completion Rate</p>
                <div className="flex items-end gap-3">
                  <span className="text-[48px] leading-none font-bold" style={{ color: P.ink }}>{animatedRate}%</span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full mb-1.5 ${wowComparison.delta >= 0 ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
                    {wowComparison.delta >= 0 ? "↑" : "↓"} {Math.abs(wowComparison.delta)}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: P.gray }}>{stats.done} dari {stats.total} items selesai</p>
                <div className="h-2 rounded-full mt-3 overflow-hidden" style={{ background: P.grayLight }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${stats.overallRate}%`, background: `linear-gradient(90deg, ${P.purple}, ${P.purpleMuted})` }} />
                </div>
              </div>
              <div className="lg:col-span-2" style={{ ...cardBase, ...bend(40) }}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Total Items", value: stats.total, color: P.purple, bg: P.purpleLight, icon: "◆", link: undefined as string | undefined },
                    { label: "Completed", value: stats.done, color: P.green, bg: P.greenLight, icon: "✓", link: undefined },
                    { label: "Overdue", value: statusSum.overdue, color: P.red, bg: P.redLight, icon: "!", link: undefined },
                    { label: "Review", value: pendingReviews, color: P.purple, bg: P.purpleLight, icon: "⟳", link: "/dashboard/superadmin/management/monitoring" },
                  ].map(({ label, value, color, bg, icon, link }) => (
                    <a key={label} href={link} className={`rounded-xl p-3 block ${link ? "hover:ring-2 hover:ring-purple-300 transition-all cursor-pointer" : ""}`} style={{ background: bg }}>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold mb-1.5" style={{ background: color, color: "#fff" }}>{icon}</span>
                      <p className="text-[10px] font-medium" style={{ color: P.gray }}>{label}</p>
                      <p className="text-lg font-bold" style={{ color: P.ink }}>{value}</p>
                    </a>
                  ))}
                </div>
              </div>

              {/* Donut + Area Chart + Dual Bar */}
              <div style={{ ...cardBase, ...bend(80) }}>
                <p className="text-[11px] font-semibold mb-3" style={{ color: P.ink }}>Status</p>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={[
                        { name: "On Track", value: statusSum.onTrack, color: P.green },
                        { name: "At Risk", value: statusSum.atRisk, color: P.gray },
                        { name: "Overdue", value: statusSum.overdue, color: P.purple },
                      ]} cx="50%" cy="50%" innerRadius={38} outerRadius={55} dataKey="value" stroke="none">
                        {[{ v: statusSum.onTrack, c: P.green }, { v: statusSum.atRisk, c: P.gray }, { v: statusSum.overdue, c: P.purple }].map((d, i) => d.v > 0 ? <Cell key={i} fill={d.c} /> : null)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-xl font-bold" style={{ color: P.ink }}>{totalItems}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1 mt-2">
                  {[
                    { label: "On Track", count: statusSum.onTrack, color: P.green },
                    { label: "At Risk", count: statusSum.atRisk, color: P.gray },
                    { label: "Overdue", count: statusSum.overdue, color: P.purple },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center gap-2 text-[10px]" style={{ color: P.gray }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      {label} · <span className="font-semibold" style={{ color: P.ink }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2" style={{ ...cardBase, ...bend(120) }}>
                <p className="text-[11px] font-semibold mb-2" style={{ color: P.ink }}>Weekly Completions</p>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={realTrend} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaPurple" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={P.purple} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={P.purple} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: P.gray }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: P.card, border: `1px solid ${P.grayBorder}`, borderRadius: 12, fontSize: 11, boxShadow: `0 4px 12px ${P.purple}10` }} />
                    <Area type="monotone" dataKey="completed" stroke={P.purple} strokeWidth={2} fill="url(#areaPurple)" dot={false} activeDot={{ r: 4, fill: P.purple }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...cardBase, ...bend(160) }}>
                <p className="text-[11px] font-semibold mb-2" style={{ color: P.ink }}>Done vs Overdue</p>
                <div className="overflow-x-auto -mx-1 px-1">
                  <div style={{ minWidth: Math.max(dualBar.length * 70, 200) }}>
                    <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dualBar} margin={{ top: 4, right: 0, left: -8, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: P.gray }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={40} />
                    <Tooltip contentStyle={{ background: P.card, border: `1px solid ${P.grayBorder}`, borderRadius: 12, fontSize: 11 }} />
                    <Bar dataKey="done" fill={P.green} radius={[4, 4, 0, 0]} barSize={12} />
                    <Bar dataKey="overdue" fill={P.purple} radius={[4, 4, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-1">
                  <span className="flex items-center gap-1.5 text-[10px]" style={{ color: P.gray }}><span className="w-2 h-2 rounded-sm" style={{ background: P.green }} /> Done</span>
                  <span className="flex items-center gap-1.5 text-[10px]" style={{ color: P.gray }}><span className="w-2 h-2 rounded-sm" style={{ background: P.purple }} /> Overdue</span>
                </div>
                  </div>
                </div>
              </div>

              {/* Activity Timeline + Highlighted Bar + CTA */}
              <div style={{ ...cardBase, ...bend(200) }}>
                <p className="text-[11px] font-semibold mb-3" style={{ color: P.ink }}>Recent Activity</p>
                {recentActivity.length === 0 ? (
                  <p className="text-xs" style={{ color: P.gray }}>Belum ada aktivitas.</p>
                ) : (
                  <div className="space-y-0 relative max-h-[320px] overflow-y-auto pr-1">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: P.grayBorder }} />
                    {recentActivity.map((a) => {
                      const hoursAgo = Math.round((Date.now() - new Date(a.completedAt!).getTime()) / 3600000);
                      const timeLabel = hoursAgo < 1 ? "Baru saja" : hoursAgo < 24 ? `${hoursAgo}h lalu` : hoursAgo < 48 ? "Kemarin" : `${Math.round(hoursAgo / 24)}h lalu`;
                      const initials = a.manager.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
                      return (
                        <div key={a.item.id} className="flex items-start gap-3 py-2 relative">
                          <span className="w-[14px] h-[14px] rounded-full shrink-0 mt-0.5 z-10" style={{ background: a.status === "selesai" ? P.green : P.purple, border: `2px solid ${P.card}` }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[8px] font-bold text-white" style={{ background: P.purple }}>{initials}</span>
                              <span className="text-xs font-medium truncate" style={{ color: P.ink }}>{a.manager}</span>
                            </div>
                            <p className="text-[11px] mt-0.5" style={{ color: P.gray }}>{a.item.title}</p>
                          </div>
                          <span className="text-[10px] shrink-0 mt-0.5" style={{ color: P.gray }}>{timeLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="lg:col-span-2" style={{ ...cardBase, ...bend(240) }}>
                <p className="text-[11px] font-semibold mb-3" style={{ color: P.ink }}>Team Performance</p>
                <ResponsiveContainer width="100%" height={Math.max(160, comparison.length * 22)}>
                  <BarChart data={comparison.map((m, i) => ({ name: m.manager.full_name.split(" ").slice(0, 2).join(" "), rate: m.rate, isTop: i === 0 }))} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: P.gray }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip contentStyle={{ background: P.card, border: `1px solid ${P.grayBorder}`, borderRadius: 12, fontSize: 11 }}
                      formatter={(v: unknown) => [`${v}%`, "Rate"]} />
                    <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={14} onClick={(d: unknown) => {
                      const n = (d as { name?: string })?.name; if (n) { const f = managers.find((x) => x.full_name.startsWith(n.split(" ")[0])); if (f) setDrillManager(f); }
                    }} style={{ cursor: "pointer" }}>
                      {comparison.map((m, i) => (
                        <Cell key={i} fill={i === 0 ? P.purple : P.purpleMuted} opacity={i === 0 ? 1 : 0.5} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...cardBase, ...bend(280), background: `linear-gradient(135deg, ${P.purple}, #5b21b6)` }}>
                <p className="text-[11px] font-semibold mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>Monitoring</p>
                <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>Pantau detail progress tiap manager</p>
                <a href="/dashboard/superadmin/management/monitoring" className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-[0.96]" style={{ background: P.card, color: P.purple }}>
                  Buka Monitoring <ExternalLink size={12} />
                </a>
              </div>

            </div>

            </div>
          )}
        </main>
      </div>
      {drillManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={(e) => { if (e.target === e.currentTarget) handleDrillClose(); }}>
          <div className="w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}>
            <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: `1px solid ${P.grayBorder}`, background: P.purpleLight }}>
              <div><p className="text-[10px] font-semibold mb-0.5" style={{ color: P.purple }}>Manager Detail</p><p className="text-lg font-bold" style={{ color: P.ink }}>{drillManager.full_name}</p><p className="text-xs" style={{ color: P.gray }}>{ROLE_DISPLAY[drillManager.role_name] ?? drillManager.role_name}</p></div>
              <button onClick={handleDrillClose} className="rounded-lg p-2 transition-all duration-150 active:scale-[0.92] hover:bg-white/5" style={{ color: P.gray }}><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const s = getManagerStats(drillManager);
                const sc = s.rate >= 80 ? P.green : s.rate >= 50 ? P.purple : "#dc2626";
                return (
                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="flex-1"><p className="text-xs font-medium mb-1" style={{ color: P.gray }}>Completion</p><span className="text-3xl font-bold" style={{ color: sc }}>{s.rate}%</span><span className="text-sm ml-2" style={{ color: P.gray }}>{s.done}/{s.total} tasks</span></div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: P.grayLight }}><div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.rate}%`, background: sc }} /></div>
                    {s.rate < 80 && (
                      <button onClick={handleEscalateModal} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-all duration-150 active:scale-[0.96]" style={{ background: P.purple }}>Eskalasi</button>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold mb-3" style={{ color: P.gray }}>Task Breakdown</p>
                      {drillManager.tasks.flatMap((task) => (task.items ?? []).map((item) => {
                        const pg = item.progress?.[0]; const st = pg?.status ?? "belum"; const done = pg?.is_completed;
                        const overdue = isOverdue(task.deadline ?? null, st);
                        const isReview = st === "waiting_review";
                        const isApproved = st === "approved";
                        const isRejected = st === "rejected";
                        const stClr = isApproved || done ? P.green : isRejected ? "#dc2626" : isReview ? P.purple : overdue ? "#dc2626" : st === "proses" ? P.orange : P.gray;
                        const stLabel = isApproved ? "Disetujui" : isRejected ? "Ditolak" : isReview ? "Review" : done ? "Done" : st === "proses" ? "Proses" : "Pending";
                        const adminNote = pg?.admin_notes;
                        return (
                          <div key={item.id} className="flex items-start gap-3 py-3" style={{ borderBottom: `1px solid ${P.grayBorder}` }}>
                            <div className="shrink-0 mt-[3px]">
                              {isApproved || done ? <CheckCircle size={14} color={P.green} /> : isRejected ? <Circle size={14} color="#dc2626" /> : isReview ? <Circle size={14} color={P.purple} /> : overdue ? <Clock size={14} color="#dc2626" /> : <Circle size={14} color={st === "proses" ? P.orange : P.gray} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium" style={{ color: P.ink }}>{item.title}</p>
                              <p className="text-[10px]" style={{ color: P.gray }}>{task.title}</p>
                              {adminNote && (
                                <div className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[10px] leading-relaxed" style={{ background: P.purpleLight, color: P.purple }}>
                                  <span className="font-semibold">Catatan Admin:</span> {adminNote}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] shrink-0 font-semibold" style={{ color: stClr }}>{stLabel}</span>
                          </div>
                        );
                      }))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
