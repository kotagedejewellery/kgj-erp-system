"use client";

import {
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCheck2,
  FlaskConical,
  Loader2,
  ScanLine,
  Truck,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  KanbanCol,
  Badge,
  MetricPill,
  EmptyState,
  fmtCurrency,
  fmtTime,
  getSLA,
  DELIVERY_LABELS,
  QC_LABELS,
  getStageLabel,
  type OperasionalData,
} from "./shared";
import { CollapsibleSection } from "./CollapsibleSection";

export function OperasionalTab({ data, searchQuery }: { data: OperasionalData | null; searchQuery: string }) {
  if (!data) return <EmptyState text="Data operasional tidak tersedia" />;

  const q = searchQuery.toLowerCase().trim();

  const filteredKonfirmasi = !q
    ? data.afterSales.konfirmasi
    : data.afterSales.konfirmasi.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q),
      );

  const filteredPelunasan = !q
    ? data.afterSales.pelunasan
    : data.afterSales.pelunasan.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q),
      );

  const filteredDelivery = !q
    ? data.afterSales.delivery
    : data.afterSales.delivery.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q),
      );

  const filteredAdminTasks = !q
    ? data.adminTasks
    : data.adminTasks.filter(
        (t) =>
          t.order_number.toLowerCase().includes(q) ||
          t.stage.toLowerCase().includes(q) ||
          (t.executed_by ?? "").toLowerCase().includes(q),
      );

  return (
    <div className="space-y-5">
      {/* After Sales Kanban */}
      <CollapsibleSection
        header={
          <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ivory">
                After Sales & Konfirmasi Customer
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
          </header>
        }
      >
        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
          <KanbanCol
            icon={<Camera className="h-4 w-4 text-sky-600" />}
            title="Menunggu Konfirmasi"
            count={filteredKonfirmasi.length}
            accent="sky"
          >
            {filteredKonfirmasi.map((order) => {
              const sla = getSLA(order.hours_elapsed);
              return (
                <article
                  key={order.order_number}
                  className="rounded-md border border-gold/15 bg-cocoa p-3 transition hover:border-gold/40"
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <p className="font-mono text-xs font-semibold text-ivory">
                      {order.order_number}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${sla.cls}`}
                    >
                      {sla.label}
                    </span>
                  </div>
                  <p className="mb-2 truncate text-xs text-white/70">
                    {order.customer_name ?? "—"}
                  </p>
                  <div className="space-y-1 border-t border-gold/10 pt-2 text-[11px] text-white/50">
                    {order.dp_amount != null && (
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-3 w-3" />
                        <span>DP {fmtCurrency(order.dp_amount)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>Menunggu {order.hours_elapsed.toFixed(1)} jam</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </KanbanCol>

          <KanbanCol
            icon={<DollarSign className="h-4 w-4 text-amber-300" />}
            title="Menunggu Pelunasan"
            count={filteredPelunasan.length}
            accent="amber"
          >
            {filteredPelunasan.map((order) => (
              <article
                key={order.order_number}
                className="rounded-md border border-gold/15 bg-cocoa p-3 transition hover:border-gold/40"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <p className="font-mono text-xs font-semibold text-ivory">
                    {order.order_number}
                  </p>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-inset ring-amber-400/20">
                    {order.payment_status === "lunas" ? "Lunas" : "Menunggu"}
                  </span>
                </div>
                <p className="mb-2 truncate text-xs text-white/70">
                  {order.customer_name ?? "—"}
                </p>
                <dl className="space-y-1 border-t border-gold/10 pt-2 text-[11px]">
                  <div className="flex justify-between">
                    <dt className="text-white/50">Total</dt>
                    <dd className="font-medium text-ivory">
                      {fmtCurrency(order.total_price)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/50">DP</dt>
                    <dd className="text-cream">
                      {fmtCurrency(order.dp_paid)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-gold/10 pt-1">
                    <dt className="text-white/50">Sisa</dt>
                    <dd className="font-semibold text-rose-300">
                      {fmtCurrency(order.remaining_amount)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </KanbanCol>

          <KanbanCol
            icon={<Truck className="h-4 w-4 text-emerald-300" />}
            title="Menunggu Pickup / Kirim"
            count={filteredDelivery.length}
            accent="emerald"
          >
            {filteredDelivery.map((order) => (
              <article
                key={order.order_number}
                className="rounded-md border border-gold/15 bg-cocoa p-3 transition hover:border-gold/40"
              >
                <p className="mb-0.5 font-mono text-xs font-semibold text-ivory">
                  {order.order_number}
                </p>
                <p className="mb-2 truncate text-xs text-white/70">
                  {order.customer_name ?? "—"}
                </p>
                <div className="space-y-1.5 border-t border-gold/10 pt-2 text-[11px] text-white/70">
                  <div className="flex items-center gap-1.5">
                    <Truck className="h-3 w-3 text-white/40" />
                    <span>
                      {DELIVERY_LABELS[order.delivery_method ?? ""] ??
                        order.delivery_method ??
                        "—"}
                    </span>
                  </div>
                  {order.tracking_number && (
                    <div className="rounded bg-carbon p-1.5 font-mono text-[10px]">
                      <span className="font-semibold">
                        {order.courier_name}:
                      </span>{" "}
                      {order.tracking_number}
                    </div>
                  )}
                  {order.shipped_at && (
                    <p className="text-[11px] text-white/40">
                      Dikirim {fmtTime(order.shipped_at)}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </KanbanCol>
        </div>
      </CollapsibleSection>

      {/* Admin Tasks + Racik/Laser */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Admin Tasks */}
        <CollapsibleSection
          header={
            <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-white/40" />
                <h2 className="text-sm font-semibold text-ivory">
                  Packing, Pengiriman & Tugas Admin
                </h2>
              </div>
              <span className="text-xs text-white/50">
                {filteredAdminTasks.length} tugas
              </span>
            </header>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/10 text-xs">
                  <th className="px-5 py-2.5 text-left font-medium text-white/50">
                    Tahap
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-white/50">
                    Order
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-white/50">
                    PIC
                  </th>
                  <th className="px-5 py-2.5 text-left font-medium text-white/50">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAdminTasks.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 text-center text-sm text-white/40"
                    >
                      {q ? "Tidak ditemukan" : "Tidak ada tugas aktif"}
                    </td>
                  </tr>
                ) : (
                  filteredAdminTasks.slice(0, 10).map((task, idx) => (
                    <tr
                      key={`${task.order_id}-${idx}`}
                      className={`border-b border-white/5 last:border-0 hover:bg-carbon transition-colors ${task.is_delayed ? "bg-rose-50/30" : ""}`}
                    >
                      <td className="px-5 py-2.5">
                        <span
                          className={`text-sm ${task.is_delayed ? "font-medium text-rose-200" : "text-cream"}`}
                        >
                          {getStageLabel(task.stage)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-white/70">
                        {task.order_number}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-white/70">
                        {task.executed_by ?? (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        {task.is_delayed ? (
                          <Badge
                            tone="rose"
                            icon={<AlertTriangle className="h-3 w-3" />}
                          >
                            Terlambat
                          </Badge>
                        ) : task.is_active ? (
                          <Badge
                            tone="emerald"
                            icon={<Loader2 className="h-3 w-3 animate-spin" />}
                          >
                            Aktif
                          </Badge>
                        ) : (
                          <Badge
                            tone="slate"
                            icon={<CheckCircle2 className="h-3 w-3" />}
                          >
                            Selesai
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredAdminTasks.length > 10 && (
            <div className="border-t border-gold/10 px-5 py-2.5 text-center text-xs text-white/40">
              +{filteredAdminTasks.length - 10} tugas lainnya
            </div>
          )}
        </CollapsibleSection>

        {/* Racik & Laser */}
        <CollapsibleSection
          header={
            <header className="border-b border-gold/10 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-ivory">
                Racik Bahan & Laser Engraving
              </h2>
            </header>
          }
        >

          {/* Racik */}
          <div className="border-b border-gold/10 px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-medium text-cream">
                  Racik Bahan
                </h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-white/50">
                  Rata Deviasi
                </p>
                <p className="text-sm font-semibold text-ivory">
                  {data.racik.rataDeviasi.toFixed(2)}%
                </p>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <MetricPill
                label="Berat Teoritis"
                value={`${data.racik.totalBeratTeoritis.toFixed(2)} g`}
              />
              <MetricPill
                label="Rata Buffer"
                value={`${data.racik.rataBuffer.toFixed(2)} g`}
              />
            </div>
            <div className="space-y-1.5">
              {data.racik.logs.length === 0 ? (
                <p className="py-3 text-center text-xs text-white/40">
                  Belum ada aktivitas racik 7 hari terakhir
                </p>
              ) : (
                data.racik.logs.slice(0, 4).map((log, idx) => {
                  const dev =
                    log.target_weight && log.total_weight
                      ? (Math.abs(log.total_weight - log.target_weight) /
                          log.target_weight) *
                        100
                      : null;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-md bg-carbon px-2.5 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-medium text-ivory">
                          {log.order_number}
                        </p>
                        <p className="truncate text-[11px] text-white/50">
                          {log.staff_name} ·{" "}
                          {log.total_weight?.toFixed(2) ?? "—"}/
                          {log.target_weight?.toFixed(2) ?? "—"} g
                        </p>
                      </div>
                      {dev != null && (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            dev > 5
                              ? "bg-rose-50 text-rose-200 ring-1 ring-inset ring-rose-400/20"
                              : dev > 2
                                ? "bg-amber-50 text-amber-300 ring-1 ring-inset ring-amber-400/20"
                                : "bg-emerald-50 text-emerald-300 ring-1 ring-inset ring-emerald-400/20"
                          }`}
                        >
                          {dev.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Laser */}
          <div className="px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-violet-500" />
                <h3 className="text-sm font-medium text-cream">
                  Laser Engraving
                </h3>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-white/50">
                  Antrian
                </p>
                <p className="text-sm font-semibold text-ivory">
                  {data.laser.antrianUkir}
                </p>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <MetricPill
                label="Mesin Aktif"
                value={
                  data.laser.mesinAktif.length > 0
                    ? `${data.laser.mesinAktif.length} unit`
                    : "Idle"
                }
              />
              <MetricPill
                label="Rata Waktu"
                value={`${Math.round(data.laser.rataWaktuPengerjaan)}s`}
              />
            </div>
            {data.laser.mesinAktif.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {data.laser.mesinAktif.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200"
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                    {m}
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              {data.laser.recentResults.length === 0 ? (
                <p className="py-3 text-center text-xs text-white/40">
                  Belum ada hasil laser 7 hari terakhir
                </p>
              ) : (
                data.laser.recentResults.slice(0, 4).map((r, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md bg-carbon px-2.5 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono font-medium text-ivory">
                        {r.order_number}
                      </p>
                      <p className="truncate text-[11px] text-white/50">
                        {r.ring_identity_number ?? "—"}
                      </p>
                    </div>
                    <span className="ml-2 rounded-full bg-cocoa px-2 py-0.5 text-[10px] text-white/70 ring-1 ring-inset ring-white/10">
                      {r.font_style ?? "regular"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* QC Overview */}
      <CollapsibleSection
        header={
          <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ivory">
              Quality Control Overview
            </h2>
            <span className="text-xs text-white/50">7 hari terakhir</span>
          </header>
        }
      >
        <div className="grid grid-cols-2 gap-3 border-b border-gold/10 p-5 sm:grid-cols-4">
          {(["qc_1", "qc_2"] as const).map((qcKey) => {
            const row = data.qc.summary.find((s) => s.qc_type === qcKey) ?? {
              total_checks: 0,
              passed: 0,
              failed: 0,
              pass_rate: 0,
            };
            const rate = Number(row.pass_rate ?? 0);
            const isLow = rate < 70 && row.total_checks > 0;
            return (
              <div
                key={qcKey}
                className="rounded-lg border border-gold/15 bg-cocoa p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-cream">
                    {QC_LABELS[qcKey]}
                  </span>
                  <span
                    className={`text-lg font-semibold ${isLow ? "text-rose-300" : row.total_checks === 0 ? "text-white/30" : "text-emerald-300"}`}
                  >
                    {row.total_checks === 0 ? "—" : `${rate.toFixed(0)}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${isLow ? "bg-rose-500" : "bg-emerald-500"}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-white/50">
                  {row.passed}/{row.total_checks} lulus
                  {row.failed > 0 && (
                    <span className="ml-1 text-rose-300">
                      · {row.failed} gagal
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        </div>
        <div className="p-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-white/50">
            Aktivitas QC Terbaru
          </p>
          <div className="max-h-60 space-y-0 overflow-y-auto">
            {data.qc.activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/40">
                Belum ada aktivitas QC
              </p>
            ) : (
              data.qc.activity.slice(0, 12).map((a, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 border-b border-white/5 py-2 last:border-0 text-sm"
                >
                  {a.result === "passed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  )}
                  <span className="w-24 shrink-0 text-xs text-white/50">
                    {fmtTime(a.finished_at)}
                  </span>
                  <span className="w-28 shrink-0 font-mono text-xs text-cream">
                    {a.order_number}
                  </span>
                  <span className="w-32 shrink-0 truncate text-xs text-white/50">
                    {a.executed_by ?? "—"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      a.stage === "qc_1"
                        ? "bg-amber-50 text-amber-300 ring-1 ring-inset ring-amber-400/20"
                        : "bg-emerald-50 text-emerald-300 ring-1 ring-inset ring-emerald-400/20"
                    }`}
                  >
                    {QC_LABELS[a.stage] ?? a.stage}
                  </span>
                  {a.notes && (
                    <span className="min-w-0 flex-1 truncate text-xs text-white/40">
                      {a.notes}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
          </div>
        </CollapsibleSection>
    </div>
  );
}
