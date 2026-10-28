"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  FileCheck2,
  FlaskConical,
  Hammer,
  Microscope,
  Users,
  Camera,
  Truck,
  Wrench,
} from "lucide-react";
import type { BottleneckData } from "@/types/bottleneck";
import {
  KpiChip,
  BnRow,
  ROLE_CONFIG,
  QC_LABELS,
  type ProduksiData,
  type OperasionalData,
  type StageBottleneck,
  type ReworkData,
} from "./shared";
import { CollapsibleSection } from "./CollapsibleSection";

export function OverviewTab({
  prodData,
  opData,
  bnData,
  activeExperts,
  avgYield: _avgYield,
  urgentCount,
  qcPassRate,
  criticalBn,
  bnFilter,
  setBnFilter,
  filteredBn,
  prodBnCount,
  opBnCount,
  completedOrders,
  completedCount,
  reworkData,
  onOrderClick,
}: {
  prodData: ProduksiData | null;
  opData: OperasionalData | null;
  bnData: BottleneckData | null;
  activeExperts: number;
  avgYield: number;
  urgentCount: number;
  qcPassRate: number | null;
  criticalBn: number;
  bnFilter: "all" | "production" | "operational" | "completed";
  setBnFilter: (v: "all" | "production" | "operational" | "completed") => void;
  filteredBn: StageBottleneck[];
  prodBnCount: number;
  opBnCount: number;
  completedOrders: Array<{ id: string; order_number: string; customer_name: string; completed_at: string }>;
  completedCount: number;
  reworkData: ReworkData | null;
  onOrderClick: (orderId: string, orderNumber: string) => void;
}) {
  const now = Date.now();
  return (
    <div className="space-y-5">
      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiChip
          label="Order Aktif"
          value={String(bnData?.summary.total_orders ?? 0)}
          icon={Activity}
          accent="sky"
          sub="semua"
        />
        <KpiChip
          label="Selesai"
          value={String(completedCount)}
          icon={CheckCircle2}
          accent="emerald"
          sub="sesuai filter"
        />
        <KpiChip
          label="Tukang Aktif"
          value={`${activeExperts}/${prodData?.experts.length ?? 0}`}
          icon={Users}
          accent="amber"
          sub="produksi"
        />
        <KpiChip
          label="Micro Setting"
          value={`${prodData?.microSetting.filter((m) => m.status === "in_progress").length ?? 0} aktif`}
          icon={Microscope}
          accent="violet"
          sub="produksi"
        />
        <KpiChip
          label="QC Pass Rate"
          value={qcPassRate != null ? `${qcPassRate.toFixed(0)}%` : "—"}
          icon={CheckCircle2}
          accent={
            qcPassRate == null
              ? "slate"
              : qcPassRate >= 80
                ? "emerald"
                : qcPassRate >= 60
                  ? "amber"
                  : "rose"
          }
          sub="operasional"
        />
        <KpiChip
          label="Bottleneck"
          value={criticalBn > 0 ? `${criticalBn} kritis` : "Normal"}
          icon={criticalBn > 0 ? AlertTriangle : CheckCircle2}
          accent={criticalBn > 0 ? "rose" : "emerald"}
          sub="semua"
        />
      </div>

      {/* ── Rework Overview ── */}
      {reworkData && (
        <CollapsibleSection
          header={
            <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-rose-500" />
                <h2 className="text-sm font-semibold text-ivory">
                  Rework
                </h2>
                <span className="text-xs text-white/50">
                  {reworkData.reworkCount} dari {reworkData.totalOrders} order
                </span>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                  reworkData.reworkRate > 20
                    ? "bg-rose-500/10 text-rose-300 ring-rose-400/20"
                    : reworkData.reworkRate > 10
                      ? "bg-amber-500/10 text-amber-300 ring-amber-400/20"
                      : "bg-emerald-500/100/10 text-emerald-300 ring-emerald-400/20"
                }`}
              >
                {reworkData.reworkRate}% rework rate
              </span>
            </header>
          }
        >
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <div className="rounded-md border border-gold/15 bg-carbon/60 p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/50">
                Total Rework
              </p>
              <p className="mt-0.5 text-lg font-bold text-ivory">
                {reworkData.reworkCount}
              </p>
            </div>
            <div className="rounded-md border border-gold/15 bg-carbon/60 p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/50">
                Major
              </p>
              <p className="mt-0.5 text-lg font-bold text-rose-300">
                {reworkData.majorCount}
              </p>
            </div>
            <div className="rounded-md border border-gold/15 bg-carbon/60 p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/50">
                Minor
              </p>
              <p className="mt-0.5 text-lg font-bold text-amber-300">
                {reworkData.minorCount}
              </p>
            </div>
            <div className="rounded-md border border-gold/15 bg-carbon/60 p-3">
              <p className="text-[10px] uppercase tracking-wide text-white/50">
                Rework Rate
              </p>
              <p className="mt-0.5 text-lg font-bold text-ivory">
                {reworkData.reworkRate}%
              </p>
            </div>
          </div>
          {reworkData.topStageRework.length > 0 && (
            <div className="border-t border-gold/10 px-5 py-3">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-white/50">
                Top Rework Flow
              </p>
              <div className="flex flex-wrap gap-2">
                {reworkData.topStageRework.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium text-rose-300 ring-1 ring-inset ring-rose-400/20"
                  >
                    {item.flow}
                    <span className="ml-0.5 font-bold">{item.count}x</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* ── Bottleneck Table ── */}
      <CollapsibleSection
        header={
          <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-ivory">
                Bottleneck — Semua Tahap
              </h2>
              {bnData && (
                <span className="text-xs text-white/50 ml-1">
                  ·{" "}
                  <span className="font-medium text-cream">
                    {bnData.summary.total_orders}
                  </span>{" "}
                  order aktif
                </span>
              )}
            </div>
            {criticalBn > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300 ring-1 ring-inset ring-rose-400/20">
                <AlertTriangle className="h-3 w-3" />
                {criticalBn} kritis
              </span>
            )}
          </header>
        }
      >
        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 border-b border-gold/10 px-5 overflow-x-auto">
          {[
            {
              key: "all" as const,
              label: "Semua",
              count: bnData?.bottlenecks.length ?? 0,
            },
            {
              key: "production" as const,
              label: "Produksi",
              count: prodBnCount,
            },
            {
              key: "operational" as const,
              label: "Operasional",
              count: opBnCount,
            },
            {
              key: "completed" as const,
              label: "Selesai",
              count: completedCount,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setBnFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                bnFilter === tab.key
                  ? "border-gold text-ivory"
                  : "border-transparent text-white/50 hover:text-cream"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  bnFilter === tab.key
                    ? "bg-gold text-night"
                    : tab.count > 0
                      ? "bg-white/10 text-cream"
                      : "bg-carbon text-white/40"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {bnFilter === "completed" ? (
          completedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-300 mb-3" />
              <p className="text-sm text-white/40">
                Belum ada order selesai
              </p>
            </div>
          ) : (
            <>
            <div className="divide-y divide-white/5">
              {completedOrders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => onOrderClick(o.id, o.order_number)}
                  className="flex items-center justify-between w-full text-left px-5 py-3 text-sm hover:bg-carbon transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cream truncate">{o.customer_name || "—"}</p>
                    <p className="text-xs text-white/40 font-mono">{o.order_number}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <div className="text-right">
                      <p className="text-xs text-emerald-300 font-medium">Selesai</p>
                      <p className="text-xs text-white/40">
                        {o.completed_at ? new Date(o.completed_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "—"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30" />
                  </div>
                </button>
              ))}
            </div>
              {completedCount > completedOrders.length && (
                <p className="border-t border-gold/10 px-5 py-2.5 text-xs text-white/40">
                  Menampilkan {completedOrders.length} order selesai terbaru dari {completedCount} order.
                </p>
              )}
            </>
          )
        ) : filteredBn.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-300 mb-3" />
            <p className="text-sm text-white/40">
              Tidak ada bottleneck di kategori ini
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/10 text-xs">
                  <th className="px-5 py-2.5 text-left font-medium text-white/50">
                    Tahap
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium text-white/50">
                    Order
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium text-white/50">
                    Rata² Waktu
                  </th>
                  <th className="px-3 py-2.5 text-center font-medium text-white/50">
                    Terlama
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-white/50">
                    Order Terlambat
                  </th>
                  <th className="px-5 py-2.5 text-center font-medium text-white/50">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBn.map((s) => (
                  <BnRow key={s.stage} stage={s} onOrderClick={onOrderClick} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      {/* ── Snapshots ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Production snapshot */}
        <CollapsibleSection
          header={
            <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Hammer className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-ivory">
                  Produksi — Status Tukang
                </h2>
              </div>
              <span className="text-xs text-white/50">
                <span className="font-medium text-cream">
                  {activeExperts}
                </span>{" "}
                sedang bekerja
              </span>
            </header>
          }
        >
          {!prodData || prodData.experts.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/40">
              Belum ada data tukang
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {prodData.experts.slice(0, 6).map((e) => {
                const cfg = ROLE_CONFIG[e.roleName] ?? {
                  name: e.roleName,
                  Icon: Wrench,
                };
                const { Icon } = cfg;
                const isActive = !!e.activeOrder;
                const mins = e.activeOrder
                  ? Math.floor(
                      (now -
                        new Date(e.activeOrder.startedAt).getTime()) /
                        60_000,
                    )
                  : null;
                return (
                  <div
                    key={e.userId}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-carbon transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isActive ? "bg-emerald-500/10" : "bg-carbon"}`}
                      >
                        <Icon
                          className={`h-3.5 w-3.5 ${isActive ? "text-emerald-300" : "text-white/40"}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-cream truncate">
                          {e.fullName}
                        </p>
                        <p className="text-[11px] text-white/50 truncate">
                          {cfg.name}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right ml-3">
                      {isActive ? (
                        <div>
                          <p className="font-mono text-xs font-semibold text-emerald-300">
                            {e.activeOrder!.orderNumber}
                          </p>
                          <p className="text-[10px] text-white/40">{mins}m</p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-white/40 bg-carbon px-2 py-0.5 rounded-full">
                          Idle
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {prodData.experts.length > 6 && (
                <div className="px-5 py-2 text-center text-xs text-white/40">
                  +{prodData.experts.length - 6} tukang lainnya
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* Operational snapshot */}
        <CollapsibleSection
          header={
            <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-sky-500" />
                <h2 className="text-sm font-semibold text-ivory">
                  Operasional — After Sales & QC
                </h2>
              </div>
            </header>
          }
        >
          {!opData ? (
            <div className="p-8 text-center text-sm text-white/40">
              Belum ada data operasional
            </div>
          ) : (
            <div className="p-5 space-y-4">
              {/* After sales counts */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    icon: Camera,
                    label: "Konfirmasi",
                    count: opData.afterSales.konfirmasi.length,
                    accent: "sky",
                  },
                  {
                    icon: DollarSign,
                    label: "Pelunasan",
                    count: opData.afterSales.pelunasan.length,
                    accent: "amber",
                  },
                  {
                    icon: Truck,
                    label: "Delivery",
                    count: opData.afterSales.delivery.length,
                    accent: "emerald",
                  },
                ].map(({ icon: Icon, label, count, accent }) => (
                  <div
                    key={label}
                    className={`rounded-lg border p-3 ${
                      accent === "sky"
                        ? "border-sky-400/20 bg-sky-500/10"
                        : accent === "amber"
                          ? "border-amber-400/20 bg-amber-500/10"
                          : "border-emerald-400/20 bg-emerald-500/100/10"
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 mb-1 ${
                        accent === "sky"
                          ? "text-sky-300"
                          : accent === "amber"
                            ? "text-amber-300"
                            : "text-emerald-300"
                      }`}
                    />
                    <p className="text-xl font-bold text-ivory tabular-nums">
                      {count}
                    </p>
                    <p className="text-[10px] text-white/50 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {urgentCount > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-rose-400/20 bg-rose-500/10 p-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-300" />
                  <p className="text-xs text-rose-200">
                    <span className="font-semibold">{urgentCount} order</span>{" "}
                    konfirmasi butuh follow up segera (&gt;48 jam)
                  </p>
                </div>
              )}

              {/* QC summary */}
              <div className="border-t border-gold/10 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50 mb-2">
                  QC Pass Rate (7 hari)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["qc_1", "qc_2"] as const).map((qcKey) => {
                    const row = opData.qc.summary.find(
                      (s) => s.qc_type === qcKey,
                    );
                    const rate = row ? Number(row.pass_rate ?? 0) : null;
                    return (
                      <div
                        key={qcKey}
                        className="rounded-md border border-gold/15 bg-carbon/60 p-2.5"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-cream">
                            {QC_LABELS[qcKey]}
                          </span>
                          <span
                            className={`text-sm font-bold ${
                              rate == null
                                ? "text-white/30"
                                : rate >= 80
                                  ? "text-emerald-300"
                                  : rate >= 60
                                    ? "text-amber-300"
                                    : "text-rose-300"
                            }`}
                          >
                            {rate != null ? `${rate.toFixed(0)}%` : "—"}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full ${rate && rate >= 80 ? "bg-emerald-500/100" : rate && rate >= 60 ? "bg-amber-500" : "bg-rose-500"}`}
                            style={{ width: `${rate ?? 0}%` }}
                          />
                        </div>
                        {row && (
                          <p className="mt-1 text-[10px] text-white/50">
                            {row.passed}/{row.total_checks} lulus
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
