// components/orders/OrderHistoryList.tsx
// Shared order history list — search + status/brand/stage filter + table.
// Each row opens OrderDetailPopup.

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { Search, RefreshCw } from "lucide-react";
import OrderDetailPopup from "@/components/orders/OrderDetailPopup";
import { STAGE_SEQUENCE, STAGE_LABELS } from "@/lib/stages";
import { BRAND_FILTER_OPTIONS } from "@/lib/legacy/brands";

interface HistoryOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  current_stage: string;
  stage_label: string;
  status: string;
  brand: string;
  deadline: string | null;
  tgl_order: string | null;
  updated_at: string | null;
  completed_at: string | null;
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  completed: { label: "Selesai", cls: "bg-emerald-500/10 text-emerald-300" },
  waiting_approval: { label: "Menunggu Approval", cls: "bg-amber-500/10 text-amber-300" },
  rework: { label: "Rework", cls: "bg-rose-500/10 text-rose-300" },
  in_progress: { label: "Proses", cls: "bg-blue-500/10 text-blue-300" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function OrderHistoryList({ scope = "all" }: { scope?: "all" | "mine" }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [brand, setBrand] = useState("all");
  const [stage, setStage] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailNumber, setDetailNumber] = useState("");

  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (brand !== "all") params.set("brand", brand);
  if (scope === "mine") params.set("scope", scope);
  if (stage) params.set("stage", stage);
  if (q) params.set("q", q);
  params.set("limit", "100");
  const queryString = params.toString();

  const { data, isLoading, isFetching, refetch } = useQuery<{
    data: { orders: HistoryOrder[]; total: number };
  }>({
    queryKey: ["orders-history", queryString],
    queryFn: () => fetcher<{ data: { orders: HistoryOrder[]; total: number } }>(
      `/api/orders/history?${queryString}`,
    ),
  });

  const orders = data?.data.orders ?? [];
  const total = data?.data.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari order / customer..."
            className="w-full rounded-lg border border-gold/15 bg-carbon py-2 pl-9 pr-3 text-sm text-cream placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gold/15 bg-carbon px-2.5 py-2 text-xs text-cream focus:border-gold/50 focus:outline-none"
        >
          <option value="all">Semua Status</option>
          <option value="active">Berjalan</option>
          <option value="completed">Selesai</option>
        </select>

        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="rounded-lg border border-gold/15 bg-carbon px-2.5 py-2 text-xs text-cream focus:border-gold/50 focus:outline-none"
        >
          <option value="all">Semua Brand</option>
          {BRAND_FILTER_OPTIONS.map((brand) => (
            <option key={brand.value} value={brand.value}>{brand.label}</option>
          ))}
        </select>

        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="rounded-lg border border-gold/15 bg-carbon px-2.5 py-2 text-xs text-cream focus:border-gold/50 focus:outline-none"
        >
          <option value="">Semua Tahap</option>
          {STAGE_SEQUENCE.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s] ?? s}
            </option>
          ))}
        </select>

        <button
          onClick={() => refetch()}
          className="rounded-lg border border-gold/15 bg-carbon px-2.5 py-2 text-xs text-cream hover:bg-cocoa transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <p className="text-xs text-white/40">{total} order ditemukan</p>

      {/* Table */}
      <div className="rounded-xl border border-gold/10 bg-cocoa overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#26211c]/80 border-b border-gold/10">
              <tr>
                {["Order", "Customer", "Tahap", "Status", "Brand", "Deadline", "Update"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-white/40 text-sm">
                    Memuat data...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-white/40 text-sm">
                    Tidak ada order yang sesuai.
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const st = STATUS_STYLES[o.status] ?? { label: o.status, cls: "bg-white/10 text-cream" };
                  return (
                    <tr
                      key={o.id}
                      onClick={() => {
                        setDetailId(o.id);
                        setDetailNumber(o.order_number);
                      }}
                      className="hover:bg-[#26211c]/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-cream">{o.order_number}</td>
                      <td className="px-4 py-3 text-cream">{o.customer_name ?? "—"}</td>
                      <td className="px-4 py-3 text-white/70">{o.stage_label}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-white/70">{o.brand}</span>
                      </td>
                      <td className="px-4 py-3 text-white/70">{formatDate(o.deadline)}</td>
                      <td className="px-4 py-3 text-white/50">{formatDate(o.completed_at ?? o.updated_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailId && (
        <OrderDetailPopup
          orderId={detailId}
          orderNumber={detailNumber}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
