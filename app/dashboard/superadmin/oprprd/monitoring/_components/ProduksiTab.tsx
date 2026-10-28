"use client";

import { BarChart3, Gem, Microscope } from "lucide-react";
import {
  ExpertCard,
  MicroStatusBadge,
  EmptyState,
  fmtGemstone,
  type ProduksiData,
} from "./shared";
import { CollapsibleSection } from "./CollapsibleSection";

export function ProduksiTab({ data, searchQuery }: { data: ProduksiData | null; searchQuery: string }) {
  if (!data) return <EmptyState text="Data produksi tidak tersedia" />;

  const q = searchQuery.toLowerCase().trim();

  const filteredExperts = !q
    ? data.experts
    : data.experts.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.roleName.toLowerCase().includes(q) ||
          (e.activeOrder?.orderNumber ?? "").toLowerCase().includes(q),
      );

  const filteredMicro = !q
    ? data.microSetting
    : data.microSetting.filter(
        (m) =>
          m.order_number.toLowerCase().includes(q) ||
          (m.staff_name ?? "").toLowerCase().includes(q),
      );

  const filteredYield = !q
    ? data.yieldData
    : data.yieldData.filter((r) =>
        r.order_number.toLowerCase().includes(q),
      );

  const activeExperts = data.experts.filter((e) => e.activeOrder).length;
  const yieldRows = filteredYield.filter(
    (r) => r.actual && r.target && r.target > 0,
  );
  const avgYield = yieldRows.length
    ? yieldRows.reduce((acc, r) => acc + (r.actual! / r.target!) * 100, 0) /
      yieldRows.length
    : 0;
  const totalTarget = data.yieldData.reduce(
    (acc, r) => acc + (r.target ?? 0),
    0,
  );
  const totalActual = data.yieldData.reduce(
    (acc, r) => acc + (r.actual ?? 0),
    0,
  );

  return (
    <div className="space-y-5">
      {/* Expert Cards */}
      <CollapsibleSection
        header={
          <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ivory">
                Jewelry Expert & Tukang
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <span className="text-xs text-white/50">
              <span className="font-medium text-cream">{activeExperts}</span>{" "}
              dari{" "}
              <span className="font-medium text-cream">
                {data.experts.length}
              </span>{" "}
              aktif
            </span>
          </header>
        }
      >
        {filteredExperts.length === 0 ? (
          <div className="p-10 text-center text-sm text-white/40">
            {q ? "Tidak ditemukan" : "Belum ada data tukang aktif"}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredExperts.map((e) => (
              <ExpertCard key={e.userId} expert={e} />
            ))}
          </div>
          )}
        </CollapsibleSection>

      {/* Micro Setting + Yield */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Micro Setting */}
        <CollapsibleSection
          header={
            <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Microscope className="h-4 w-4 text-violet-500" />
                <h2 className="text-sm font-semibold text-ivory">
                  Micro Setting
                </h2>
              </div>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
                {filteredMicro.length} order
              </span>
            </header>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/10 text-xs">
                  <th className="px-5 py-2.5 text-left font-medium text-white/50">
                    Order
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-white/50">
                    Permata
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-white/50">
                    Tukang
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium text-white/50">
                    Berat
                  </th>
                  <th className="px-5 py-2.5 text-left font-medium text-white/50">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMicro.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-sm text-white/40"
                    >
                      {q ? "Tidak ditemukan" : "Tidak ada order micro setting"}
                    </td>
                  </tr>
                ) : (
                  filteredMicro.slice(0, 10).map((order) => (
                    <tr
                      key={order.order_id}
                      className="border-b border-white/5 last:border-0 hover:bg-carbon transition-colors"
                    >
                      <td className="px-5 py-2.5 font-mono text-xs text-cream">
                        {order.order_number}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Gem className="h-3 w-3 shrink-0 text-violet-400" />
                          <span className="text-xs text-white/70">
                            {fmtGemstone(order.gemstone_info)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-white/70">
                        {order.staff_name ?? (
                          <span className="text-white/40">Menunggu</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-white/70">
                        {order.weight_before != null &&
                        order.weight_after != null ? (
                          <span>
                            {order.weight_before.toFixed(2)} →{" "}
                            <span className="font-medium text-ivory">
                              {order.weight_after.toFixed(2)}
                            </span>
                            g
                          </span>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        <MicroStatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {data.microSetting.length > 10 && (
            <div className="border-t border-gold/10 px-5 py-2.5 text-center">
              <p className="text-xs text-white/40">
                +{data.microSetting.length - 10} order lainnya
              </p>
            </div>
          )}
        </CollapsibleSection>

        {/* Yield Material */}
        <CollapsibleSection
          header={
            <header className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-white/40" />
                <h2 className="text-sm font-semibold text-ivory">
                  Yield Material
                </h2>
              </div>
              <span className="text-xs text-white/50">7 hari terakhir</span>
            </header>
          }
        >
          {filteredYield.length === 0 ? (
            <div className="p-10 text-center">
              <BarChart3 className="mx-auto mb-3 h-10 w-10 text-white/20" />
              <p className="text-sm text-white/40">{q ? "Tidak ditemukan" : "Belum ada data yield"}</p>
            </div>
          ) : (
            <div className="p-5">
              <div className="mb-5 grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Rata-rata Yield",
                    value: `${avgYield.toFixed(1)}%`,
                    accent:
                      avgYield >= 95
                        ? "emerald"
                        : avgYield >= 90
                          ? "amber"
                          : "rose",
                  },
                  {
                    label: "Total Target",
                    value: `${totalTarget.toFixed(1)}g`,
                    accent: "slate",
                  },
                  {
                    label: "Total Aktual",
                    value: `${totalActual.toFixed(1)}g`,
                    accent: "slate",
                  },
                ].map(({ label, value, accent }) => (
                  <div
                    key={label}
                    className="rounded-md border border-gold/15 bg-carbon/60 p-2.5"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-white/50">
                      {label}
                    </p>
                    <p
                      className={`mt-0.5 text-base font-semibold ${
                        accent === "emerald"
                          ? "text-emerald-300"
                          : accent === "amber"
                            ? "text-amber-300"
                            : accent === "rose"
                              ? "text-rose-300"
                              : "text-ivory"
                      }`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5">
                {filteredYield.slice(0, 7).map((item, idx) => {
                  const pct =
                    item.actual && item.target && item.target > 0
                      ? (item.actual / item.target) * 100
                      : 0;
                  const color =
                    pct >= 95
                      ? "bg-emerald-500"
                      : pct >= 90
                        ? "bg-amber-500"
                        : "bg-rose-500";
                  const textColor =
                    pct >= 95
                      ? "text-emerald-300"
                      : pct >= 90
                        ? "text-amber-300"
                        : "text-rose-300";
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 truncate font-mono text-xs text-white/50">
                        {item.order_number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-white/70">
                            {item.target?.toFixed(2) ?? "—"}g →{" "}
                            <span className="font-medium text-ivory">
                              {item.actual?.toFixed(2) ?? "—"}g
                            </span>
                          </span>
                          <span className={`font-semibold ${textColor}`}>
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all ${color}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
