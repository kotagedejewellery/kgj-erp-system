// app/dashboard/superadmin/oprprd/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { redirect, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Loading from "@/components/ui/Loading";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  LineChart,
  MapPin,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  ThumbsUp,
  Trophy,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// ============================================================
// Config
// ============================================================

const API_ENDPOINT = "/api/daily-stats-2";

// ============================================================
// Types
// ============================================================

interface DashboardData {
  kpi: {
    totalOrdersAktif: number;
    potensiKeterlambatan: number;
    nilaiBarangWIP: {
      beratEmas: number;
      jumlahPermata: number;
      estimasiRupiah: number;
      avgKarat: number;
    };
    rataCycleTime: number;
    targetCycleTime: number;
    additional: {
      ordersHariIni: number;
      selesaiHariIni: number;
      totalRework: number;
      criticalRework: number;
      completedCount: number;
    };
    trend: {
      currentWeekOrders: number;
      lastWeekOrders: number;
      trendPercent: number;
    };
  };
  operasional: {
    afterSales: {
      totalKonfirmasi: number;
      totalPelunasan: number;
      totalDelivery: number;
      urgentCount: number;
    };
    adminTasks: {
      total: number;
      delayed: number;
      active: number;
    };
    racik: {
      rataShrinkage: number;
      targetShrinkage: number;
      totalBerat: number;
    };
    laser: {
      antrian: number;
      mesinAktif: number;
    };
    qc: {
      passRateAvg: number;
      totalChecks: number;
      failedToday: number;
    };
  };
  produksi: {
    experts: {
      total: number;
      aktif: number;
      totalOrders: number;
    };
    microSetting: {
      total: number;
      inProgress: number;
      waiting: number;
    };

  };
  workshopPulse: {
    today: {
      ordersReceived: number;
      ordersCompleted: number;
      reworksLogged: number;
      activeUsers: number;
    };
    workInProgress: {
      activeOrders: number;
      overdueOrders: number;
    };
    afterProduction: {
      customerCare: number;
      packing: number;
      shipping: number;
    };
  };
  recentActivities: Array<{
    id: string;
    type: "scan" | "qc" | "approval" | "rework";
    orderNumber: string;
    stage: string;
    user: string;
    timestamp: string;
    status?: "success" | "warning" | "error";
    notes?: string;
  }>;
  topPerformers: Array<{
    name: string;
    role: string;
    ordersCompleted: number;
    avgTime: number;
  }>;
  stageDistribution: Array<{
    stage: string;
    count: number;
    color?: string;
  }>;
}

export const dynamic = "force-dynamic";

// ============================================================
// Labels & Config
// ============================================================

const STAGE_LABELS: Record<string, string> = {
  penerimaan_order: "Order Masuk",
  qc_awal: "QC Awal",
  racik_bahan: "Racik",
  lebur_bahan: "Lebur",
  pembentukan_cincin: "Bentuk",
  pemasangan_permata: "Setting",
  pemolesan: "Poles",
  qc_1: "QC 1",
  konfirmasi_awal: "Konfirmasi",
  finishing: "Finishing",
  laser: "Laser",
  qc_2: "QC 2",
  pelunasan: "Pelunasan",
  kelengkapan: "Kelengkapan",
  qc_3: "QC 3",
  packing: "Packing",
  pengiriman: "Kirim",
};

const STAGE_BAR_CLASS: Record<string, string> = {
  penerimaan_order: "bg-sky-400",
  qc_awal: "bg-sky-500",
  racik_bahan: "bg-indigo-400",
  lebur_bahan: "bg-amber-500",
  pembentukan_cincin: "bg-amber-400",
  pemasangan_permata: "bg-violet-500",
  pemolesan: "bg-blue-400",
  qc_1: "bg-emerald-400",
  konfirmasi_awal: "bg-teal-400",
  finishing: "bg-rose-400",
  laser: "bg-violet-400",
  qc_2: "bg-emerald-500",
  pelunasan: "bg-amber-600",
  kelengkapan: "bg-blue-500",
  qc_3: "bg-emerald-600",
  packing: "bg-stone-400",
  pengiriman: "bg-slate-600",
};

const ACTIVITY_ICON: Record<string, LucideIcon> = {
  scan: ScanLine,
  qc: ShieldCheck,
  approval: ThumbsUp,
  rework: RefreshCw,
};

// ============================================================
// Formatters
// ============================================================

function _formatRupiah(value: number): string {
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(0)}Jt`;
  }
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffMins < 1) return "baru saja";
  if (diffMins < 60) return `${diffMins}m lalu`;
  if (diffHours < 24) return `${diffHours}j lalu`;
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// Page
// ============================================================

export function OwnerDashboardContent() {
  const router = useRouter();
  // Dibaca di useEffect (bukan initializer useState) agar render pertama di
  // client identik dengan SSR — menghindari hydration mismatch di Header.
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    const user = getClientUser();
    setClientUser(user);
    if (!user) {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    setChartReady(true);
  }, []);

  const {
    data: rawData,
    isLoading: loading,
    error,
    dataUpdatedAt,
    refetch,
    isRefetching,
  } = useQuery<DashboardData>({
    queryKey: ["oprprd-dashboard"],
    queryFn: async () => {
      const res = await fetcher<{ data: DashboardData }>(API_ENDPOINT);
      return res.data;
    },
    refetchInterval: 30_000,
  });

  const data = rawData ?? null;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const isOverCycle = data?.kpi.rataCycleTime
    ? data.kpi.rataCycleTime > data.kpi.targetCycleTime
    : false;
  const trendIsPositive = data?.kpi.trend.trendPercent
    ? data.kpi.trend.trendPercent > 0
    : false;

  return (
    <div className="flex h-screen bg-night">
      <Sidebar role="superadmin" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
        <main className="flex-1 overflow-y-auto p-6">
          {/* ========== Page Header ========== */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-playfair text-2xl font-semibold tracking-wide text-ivory">
                Operasional & Produksi
              </h1>
              <p className="mt-0.5 text-xs text-white/40">
                Ringkasan harian workshop — order, kualitas, dan performa tukang
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-xs text-white/40">
                  Diperbarui {lastUpdated.toLocaleTimeString("id-ID")}
                </span>
              )}
              <button
                onClick={() => refetch()}
                disabled={isRefetching}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/15 bg-cocoa px-3 py-1.5 text-xs font-medium text-cream transition hover:border-gold/40 hover:bg-white/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-gold/70 ${isRefetching ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>

          {/* ========== Content ========== */}
          {loading ? (
            <Loading variant="skeleton" text="Memuat data dashboard..." />
          ) : error ? (
            <DashboardError error={error instanceof Error ? error.message : "Terjadi kesalahan"} onRetry={() => refetch()} />
          ) : !data ? null : (
            <div className="space-y-6">
              {/* ========== ROW 1: HERO KPI CARDS ========== */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  label="Order Aktif"
                  value={data.kpi.totalOrdersAktif.toString()}
                  icon={ClipboardList}
                  accent="sky"
                  subtitle={
                    trendIsPositive
                      ? `+${data.kpi.trend.trendPercent.toFixed(0)}% dari minggu lalu`
                      : `${data.kpi.trend.trendPercent.toFixed(0)}% dari minggu lalu`
                  }
                  trend={trendIsPositive ? "up" : "down"}
                />
                <KpiCard
                  label="Risiko Terlambat"
                  value={data.kpi.potensiKeterlambatan.toString()}
                  icon={AlertTriangle}
                  accent={data.kpi.potensiKeterlambatan > 0 ? "amber" : "slate"}
                  subtitle={
                    data.kpi.potensiKeterlambatan > 0
                      ? `${((data.kpi.potensiKeterlambatan / data.kpi.totalOrdersAktif) * 100).toFixed(0)}% dari total aktif`
                      : "Semua order on track"
                  }
                />
                <KpiCard
                  label="Cycle Time"
                  value={`${data.kpi.rataCycleTime.toFixed(1)}`}
                  unit="hari"
                  icon={Clock}
                  accent={isOverCycle ? "rose" : "emerald"}
                  subtitle={`Target ${data.kpi.targetCycleTime} hari`}
                />
                <KpiCard
                  label="QC Pass Rate"
                  value={`${data.operasional.qc.passRateAvg.toFixed(1)}`}
                  unit="%"
                  icon={ShieldCheck}
                  accent={data.operasional.qc.passRateAvg >= 80 ? "emerald" : "amber"}
                  subtitle={`${data.operasional.qc.failedToday} gagal hari ini`}
                />
              </div>

              {/* ========== ROW 2: WORKSHOP PULSE + STAGE DIST ========== */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Left — Workshop Pulse */}
                <section className="rounded-lg border border-gold/15 bg-cocoa transition-colors hover:border-gold/25">
                  <header className="flex items-center gap-2 border-b border-gold/10 px-5 py-3.5">
                    <BarChart3 className="h-3.5 w-3.5 text-gold/70" />
                    <h3 className="font-playfair text-[15px] font-semibold tracking-wide text-ivory">
                      Workshop Pulse
                    </h3>
                    <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-white/35">
                      Data live · WIB
                    </span>
                  </header>
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                        Aktivitas Hari Ini
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <MiniStat label="Order Dibuat" value={data.workshopPulse.today.ordersReceived} accent="sky" />
                        <MiniStat label="Order Selesai" value={data.workshopPulse.today.ordersCompleted} accent="emerald" />
                        <MiniStat label="Rework Dicatat" value={data.workshopPulse.today.reworksLogged} accent="rose" />
                        <MiniStat label="Pengguna Aktif" value={data.workshopPulse.today.activeUsers} accent="slate" />
                      </div>
                    </div>

                    <hr className="border-gold/10" />

                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                        Pekerjaan Berjalan
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <MiniStat label="Order Aktif" value={data.workshopPulse.workInProgress.activeOrders} accent="violet" />
                        <MiniStat label="Lewat Estimasi" value={data.workshopPulse.workInProgress.overdueOrders} accent={data.workshopPulse.workInProgress.overdueOrders > 0 ? "rose" : "emerald"} />
                      </div>
                      {data.workshopPulse.workInProgress.overdueOrders > 0 && (
                        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-rose-400/20 bg-rose-500/10 px-2.5 py-1.5">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-rose-300" />
                          <p className="text-[11px] text-rose-200">
                            {data.workshopPulse.workInProgress.overdueOrders} order melewati tanggal estimasi selesai
                          </p>
                        </div>
                      )}
                    </div>

                    <hr className="border-gold/10" />

                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                        Setelah Produksi
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <MiniStat label="Customer Care" value={data.workshopPulse.afterProduction.customerCare} accent="sky" />
                        <MiniStat label="Packing" value={data.workshopPulse.afterProduction.packing} accent="amber" />
                        <MiniStat label="Pengiriman" value={data.workshopPulse.afterProduction.shipping} accent="emerald" />
                      </div>
                    </div>

                    <p className="border-t border-gold/10 pt-3 text-[10px] leading-relaxed text-white/35">
                      Berdasarkan order Yii2, tracking stage, riwayat aktivitas, dan log rework.
                    </p>
                  </div>
                </section>

                {/* Right — Stage Distribution (horizontal bar chart) */}
                <section className="rounded-lg border border-gold/15 bg-cocoa transition-colors hover:border-gold/25">
                  <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gold/70" />
                      <h3 className="font-playfair text-[15px] font-semibold tracking-wide text-ivory">
                        Distribusi per Stage
                      </h3>
                    </div>
                    {data.stageDistribution.length > 0 && (
                      <span className="text-[10px] tabular-nums text-white/40">
                        {data.stageDistribution.reduce((a, b) => a + b.count, 0)} order
                      </span>
                    )}
                  </header>
                  <div className="p-5">
                    {data.stageDistribution.length === 0 ? (
                      <p className="py-12 text-center text-xs text-white/40">
                        Belum ada data distribusi
                      </p>
                    ) : chartReady ? (
                      <>
                        <div className="h-[220px] w-full min-w-0">
                          <ResponsiveContainer width="100%" height="100%" minHeight={220}>
                            <BarChart
                              data={data.stageDistribution
                                .sort((a, b) => b.count - a.count)
                                .slice(0, 12)}
                              margin={{ top: 0, right: 4, bottom: 0, left: -8 }}
                              layout="vertical"
                            >
                              <XAxis
                                type="number"
                                allowDecimals={false}
                                tick={{ fontSize: 10, fill: "#A69A82" }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                type="category"
                                dataKey="stage"
                                tickFormatter={(s) => STAGE_LABELS[s] ?? s}
                                tick={{ fontSize: 11, fill: "#A69A82" }}
                                axisLine={false}
                                tickLine={false}
                                width={78}
                              />
                              <Tooltip
                                formatter={(value) => [value, "Order"]}
                                labelFormatter={(s) => STAGE_LABELS[s as string] ?? s}
                                cursor={{ fill: "rgba(201, 162, 39, 0.08)" }}
                                contentStyle={{
                                  fontSize: 11,
                                  borderRadius: 6,
                                  backgroundColor: "#1C1917",
                                  border: "1px solid rgba(201, 162, 39, 0.25)",
                                  color: "#E8E2D4",
                                }}
                                labelStyle={{ color: "#F5EFE3" }}
                                itemStyle={{ color: "#E8E2D4" }}
                              />
                              <Bar
                                dataKey="count"
                                fill="#C9A227"
                                radius={[0, 3, 3, 0]}
                                maxBarSize={24}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {data.stageDistribution.length > 12 && (
                          <p className="mt-2 text-center text-[10px] text-white/40">
                            +{data.stageDistribution.length - 12} stage lainnya
                          </p>
                        )}
                        {/* Stage color chips */}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {data.stageDistribution
                            .sort((a, b) => b.count - a.count)
                            .slice(0, 6)
                            .map((s) => (
                              <span
                                key={s.stage}
                                className="inline-flex items-center gap-1 rounded-full border border-gold/10 bg-carbon px-2 py-0.5 text-[10px] text-white/50"
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${STAGE_BAR_CLASS[s.stage] ?? "bg-white/40"}`}
                                />
                                {STAGE_LABELS[s.stage] ?? s.stage}: {s.count}
                              </span>
                            ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-[220px]" />
                    )}
                  </div>
                </section>
              </div>

              {/* ========== ROW 3: ACTIVITIES & TOP PERFORMERS ========== */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <SectionCard icon={LineChart} title="Aktivitas Terbaru">
                  {data.recentActivities.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/40">
                      Belum ada aktivitas
                    </p>
                  ) : (
                    <div className="max-h-[300px] space-y-0 overflow-y-auto pr-1">
                      {data.recentActivities.map((activity) => (
                        <ActivityRow key={activity.id} activity={activity} />
                      ))}
                    </div>
                  )}
                </SectionCard>

                  <SectionCard icon={Trophy} title="Top Performers">
                  {data.topPerformers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/40">
                      Belum ada data performer
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {data.topPerformers.slice(0, 5).map((performer, idx) => (
                        <PerformerRow
                          key={`${performer.name}-${idx}`}
                          rank={idx + 1}
                          {...performer}
                        />
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================
// Sub: KpiCard
// ============================================================

function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  accent,
  subtitle,
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  accent: "sky" | "amber" | "violet" | "rose" | "emerald" | "slate";
  subtitle?: React.ReactNode;
  trend?: "up" | "down";
}) {
  const accentMap = {
    sky: {
      iconBg: "bg-sky-500/10",
      iconText: "text-sky-300",
      ring: "ring-sky-400/20",
    },
    amber: {
      iconBg: "bg-amber-500/10",
      iconText: "text-amber-300",
      ring: "ring-amber-400/20",
    },
    violet: {
      iconBg: "bg-violet-500/10",
      iconText: "text-violet-300",
      ring: "ring-violet-400/20",
    },
    rose: {
      iconBg: "bg-rose-500/10",
      iconText: "text-rose-300",
      ring: "ring-rose-400/20",
    },
    emerald: {
      iconBg: "bg-emerald-500/10",
      iconText: "text-emerald-300",
      ring: "ring-emerald-400/20",
    },
    slate: {
      iconBg: "bg-white/5",
      iconText: "text-white/50",
      ring: "ring-white/10",
    },
  };

  const a = accentMap[accent];

  return (
    <div className="rounded-lg border border-gold/15 bg-cocoa p-5 transition-colors hover:border-gold/25">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-white/50">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <p className="text-3xl font-semibold tabular-nums text-ivory">
              {value}
            </p>
            {unit && <p className="text-sm text-white/50">{unit}</p>}
          </div>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${a.iconBg} ${a.ring}`}
        >
          <Icon className={`h-5 w-5 ${a.iconText}`} />
        </div>
      </div>

      {subtitle && (
        <p className="mt-2 text-[11px] text-white/40">
          {trend && (
            <span
              className={`mr-1 inline-flex items-center gap-0.5 ${trend === "up" ? "text-emerald-300" : "text-rose-300"}`}
            >
              {trend === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            </span>
          )}
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Sub: SectionCard — frame standar untuk section
// ============================================================

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gold/15 bg-cocoa transition-colors hover:border-gold/25">
      <header className="flex items-center gap-2 border-b border-gold/10 px-5 py-3.5">
        <Icon className="h-3.5 w-3.5 text-gold/70" />
        <h3 className="font-playfair text-[15px] font-semibold tracking-wide text-ivory">{title}</h3>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

// ============================================================
// Sub: ActivityRow
// ============================================================

function ActivityRow({
  activity,
}: {
  activity: DashboardData["recentActivities"][number];
}) {
  const Icon = ACTIVITY_ICON[activity.type] ?? ClipboardList;
  const iconToneMap = {
    scan: "text-sky-400",
    qc: "text-emerald-400",
    approval: "text-violet-400",
    rework: "text-amber-400",
  };

  const StatusIcon =
    activity.status === "success"
      ? CheckCircle2
      : activity.status === "warning"
        ? AlertTriangle
        : activity.status === "error"
          ? XCircle
          : null;

  const statusTone =
    activity.status === "success"
      ? "text-emerald-500"
      : activity.status === "warning"
        ? "text-amber-500"
        : activity.status === "error"
          ? "text-rose-500"
          : "";

  return (
    <div className="flex items-center gap-3 border-b border-white/5 py-2 text-sm last:border-0">
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${iconToneMap[activity.type] ?? "text-white/40"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-cream">
            {activity.orderNumber}
          </span>
          <span className="text-[11px] text-white/40">
            {STAGE_LABELS[activity.stage] ?? activity.stage}
          </span>
        </div>
        <p className="truncate text-[11px] text-white/50">
          {activity.user} · {formatRelativeTime(activity.timestamp)}
        </p>
      </div>
      {StatusIcon && (
        <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${statusTone}`} />
      )}
    </div>
  );
}

// ============================================================
// Sub: PerformerRow
// ============================================================

function PerformerRow({
  rank,
  name,
  role,
  ordersCompleted,
  avgTime,
}: {
  rank: number;
  name: string;
  role: string;
  ordersCompleted: number;
  avgTime: number;
}) {
  const isTopThree = rank <= 3;

  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2.5 last:border-0">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            isTopThree
              ? "bg-gold/15 text-gold"
              : "bg-white/10 text-white/50"
          }`}
        >
          {rank}
        </span>
        <div>
          <p className="text-sm font-medium text-cream">{name}</p>
          <p className="text-[11px] text-white/50">{role}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums text-ivory">
          {ordersCompleted}
        </p>
        <p className="text-[11px] text-white/50">
          {avgTime.toFixed(1)} hari/order
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Sub: MiniStat — compact stat pill for the Workshop Pulse card
// ============================================================

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: "sky" | "amber" | "violet" | "rose" | "emerald" | "slate";
}) {
  const toneMap: Record<string, string> = {
    sky: "text-sky-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
    rose: "text-rose-300",
    emerald: "text-emerald-300",
    slate: "text-cream",
  };
  return (
    <div className="rounded-md border border-gold/10 bg-carbon/60 px-3 py-2">
      <p className="text-[10px] text-white/40">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${toneMap[accent]}`}>
        {value}
      </p>
    </div>
  );
}

// ============================================================
// Skeleton
// ============================================================

function _DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-night">
      <header className="border-b border-gold/15 bg-cocoa">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="h-5 w-40 animate-pulse rounded bg-mocha" />
          <div className="h-7 w-24 animate-pulse rounded bg-mocha" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border border-gold/15 bg-cocoa"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-lg border border-gold/15 bg-cocoa"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-lg border border-gold/15 bg-cocoa"
            />
          ))}
        </div>
      </main>
    </div>
  );
}

// ============================================================
// Error
// ============================================================

function DashboardError({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-night p-6">
      <div className="max-w-md rounded-lg border border-rose-400/20 bg-cocoa p-8 text-center shadow-lg shadow-black/20">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10">
          <AlertTriangle className="h-6 w-6 text-rose-300" />
        </div>
        <h2 className="mb-1 text-base font-semibold text-ivory">
          Gagal memuat dashboard
        </h2>
        <p className="mb-5 text-sm text-white/70">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-gold/15 bg-cocoa px-4 py-2 text-sm font-medium text-cream shadow-sm transition hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Coba Lagi
        </button>
      </div>
    </div>
  );
}

export default function OprprdDashboardRedirect() {
  redirect("/dashboard/superadmin");
}
