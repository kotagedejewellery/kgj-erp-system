// app/dashboard/superadmin/oprprd/monitoring/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Loading from "@/components/ui/Loading";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import OrderDetailPopup from "@/components/orders/OrderDetailPopup";
import type { BottleneckData } from "@/types/bottleneck";
import { Search, RefreshCw } from "lucide-react";
import type { Channel } from "pusher-js";
import { BRAND_FILTER_OPTIONS, getBrandFilterCode } from "@/lib/legacy/brands";
import {
  buildUrl,
  ErrorState,
  type ProduksiData,
  type OperasionalData,
  type ReworkData,
} from "./_components/shared";
import { OverviewTab } from "./_components/OverviewTab";
import { FilterPresets } from "./_components/FilterPresets";
export const dynamic = "force-dynamic";

export default function MonitoringPage() {
  const router = useRouter();
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [bnFilter, setBnFilter] = useState<
    "all" | "production" | "operational" | "completed"
  >("all");
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detailOrderNumber, setDetailOrderNumber] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const queryClient = useQueryClient();

  const [refetchInterval, setRefetchInterval] = useState<number | false>(60_000);

  const queries = useQueries({
    queries: [
      {
        queryKey: ["monitoring", "prod", dateFrom, dateTo],
        queryFn: () => fetcher<{ data: ProduksiData }>(buildUrl("/api/production", dateFrom, dateTo)),
        refetchInterval,
      },
      {
        queryKey: ["monitoring", "op", dateFrom, dateTo],
        queryFn: () => fetcher<{ data: OperasionalData }>(buildUrl("/api/operational", dateFrom, dateTo)),
        refetchInterval,
      },
      {
        queryKey: ["monitoring", "bn", dateFrom, dateTo],
        queryFn: () => fetcher<{ data: BottleneckData }>(buildUrl("/api/bottleneck", dateFrom, dateTo)),
        refetchInterval,
      },
      {
        queryKey: ["monitoring", "supervisor", dateFrom, dateTo, brandFilter],
        queryFn: () => {
          const url = buildUrl("/api/supervisor", dateFrom, dateTo);
          return fetcher<{ data: { completedOrders: Array<{ id: string; order_number: string; customer_name: string; completed_at: string }>; completedCount: number } }>(
            `${url}${url.includes("?") ? "&" : "?"}brand=${brandFilter}`,
          );
        },
        refetchInterval,
      },
      {
        queryKey: ["monitoring", "rework", dateFrom, dateTo],
        queryFn: () => fetcher<{ data: ReworkData }>(buildUrl("/api/rework-overview", dateFrom, dateTo)),
        refetchInterval,
      },
    ],
  });

  const [prodQuery, opQuery, bnQuery, supervisorQuery, reworkQuery] = queries;

  const prodData: ProduksiData | null =
    (prodQuery.data as { data: ProduksiData } | undefined)?.data ?? null;
  const opData: OperasionalData | null =
    (opQuery.data as { data: OperasionalData } | undefined)?.data ?? null;
  const bnData: BottleneckData | null =
    (bnQuery.data as { data: BottleneckData } | undefined)?.data ?? null;
  const completedOrders: Array<{ id: string; order_number: string; customer_name: string; completed_at: string }> =
    (supervisorQuery.data as { data: { completedOrders: Array<{ id: string; order_number: string; customer_name: string; completed_at: string }> } } | undefined)?.data?.completedOrders ?? [];
  const completedCount =
    (supervisorQuery.data as { data: { completedCount: number } } | undefined)?.data?.completedCount ?? 0;
  const filteredCompletedOrders = completedOrders.filter((o) => brandFilter === "all" || getBrandFilterCode(o.order_number) === brandFilter);
  const reworkData: ReworkData | null =
    (reworkQuery.data as { data: ReworkData } | undefined)?.data ?? null;

  const initialLoading = queries.some((q) => q.isLoading);
  const hasData = queries.some((q) => !!q.data);
  const anyError = queries.find((q) => q.error);
  const error = !initialLoading && !hasData && anyError ? (anyError.error instanceof Error ? anyError.error.message : "Terjadi kesalahan") : null;

  const refreshAll = () => { queries.forEach((q) => { q.refetch(); }); };

  useEffect(() => {
    const cu = getClientUser();
    if (!cu) {
      router.push("/login");
      return;
    }
    setClientUser(cu);
  }, [router]);

  // Pusher real-time (refetchInterval handles polling fallback)
  useEffect(() => {
    const userId = clientUser?.id;
    let channel: Channel | null = null;

    async function initPusher() {
      if (!userId) return;
      try {
        const { default: Pusher } = await import("pusher-js");
        const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          authEndpoint: "/api/pusher/auth",
        });

        pusher.connection.bind("state_change", (states: { current: string }) => {
          setRefetchInterval(states.current === "connected" ? false : 60_000);
        });

        channel = pusher.subscribe(`private-user-${userId}`);
        channel.bind("new-notification", () => {
          queryClient.invalidateQueries({ queryKey: ["monitoring"] });
        });
      } catch {
        console.warn("[monitoring] Pusher unavailable, using polling fallback");
      }
    }

    initPusher();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [clientUser?.id, queryClient]);

  // Derived summary metrics
  const activeExperts =
    prodData?.experts.filter((e) => e.activeOrder).length ?? 0;
  const avgYield = (() => {
    const rows =
      prodData?.yieldData.filter((r) => r.actual && r.target && r.target > 0) ??
      [];
    if (!rows.length) return 0;
    return (
      rows.reduce((acc, r) => acc + (r.actual! / r.target!) * 100, 0) /
      rows.length
    );
  })();
  const urgentCount =
    opData?.afterSales.konfirmasi.filter((o) => o.hours_elapsed > 48).length ??
    0;
  const qcPassRate = (() => {
    const rows = opData?.qc.summary ?? [];
    if (!rows.length) return null;
    return (
      rows.reduce((acc, r) => acc + Number(r.pass_rate ?? 0), 0) / rows.length
    );
  })();
  const criticalBn =
    bnData?.bottlenecks.filter((b) => b.avg_hours && b.avg_hours > 24).length ??
    0;
  const filteredBn =
    bnFilter === "completed" ? [] :
    bnData?.bottlenecks
      .filter((b) => bnFilter === "all" ? true : b.stage_group === bnFilter)
      .map((b) => ({
        ...b,
        orders: (!searchQuery && brandFilter === "all") ? b.orders : b.orders.filter(
          (o) => {
            const matchSearch = !searchQuery || o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) || (o.customer_name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
            const matchBrand = brandFilter === "all" || getBrandFilterCode(o.order_number) === brandFilter;
            return matchSearch && matchBrand;
          }
        ),
      }))
      .filter((b) => (searchQuery || brandFilter !== "all") ? b.orders.length > 0 : true) ?? [];
  const prodBnCount =
    bnData?.bottlenecks.filter((b) => b.stage_group === "production").length ??
    0;
  const opBnCount =
    bnData?.bottlenecks.filter((b) => b.stage_group === "operational").length ??
    0;

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await fetch("/api/legacy/sync", { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setSyncMsg(j.error ?? "Sync gagal");
      } else {
        setSyncMsg(
          `Sync selesai: ${j.synced ?? 0} baru, ${j.skipped ?? 0} dilewati${j.errors ? `, ${j.errors} error` : ""}`,
        );
        queryClient.invalidateQueries({ queryKey: ["monitoring"] });
      }
    } catch {
      setSyncMsg("Sync gagal — periksa koneksi");
    } finally {
      setSyncing(false);
    }
  }

    return (
    <div className="flex h-screen bg-[#26211c]">
      <Sidebar role="superadmin" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Page Header */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-2xl font-bold text-ivory tracking-tight">
                Monitoring OPR-PRD
              </h2>
              <p className="text-sm text-white/40 mt-0.5">
                Pantau operasional & produksi secara terpadu
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#c9a227]/30 bg-[#c9a227]/10 px-3 py-1.5 text-xs font-medium text-[#e8d9a0] transition-colors hover:bg-[#c9a227]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Tarik order terbaru dari sistem Yii2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Menyinkron..." : "Sync Yii2"}
                </button>
                {syncMsg && (
                  <span className="text-[11px] text-white/50">{syncMsg}</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari order / customer..."
                  className="w-52 rounded-md border border-[#c9a227]/10 bg-carbon px-3 py-1.5 pl-8 text-xs text-cream shadow-sm placeholder:text-white/20 focus:border-gold/50 focus:outline-none"
                />
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-36 rounded-md border border-[#c9a227]/10 bg-carbon px-2.5 py-1.5 text-xs text-cream shadow-sm focus:border-gold/50 focus:outline-none"
                  title="Dari tanggal"
                />
                <span className="text-xs text-white/40">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-36 rounded-md border border-[#c9a227]/10 bg-carbon px-2.5 py-1.5 text-xs text-cream shadow-sm focus:border-gold/50 focus:outline-none"
                  title="Sampai tanggal"
                />
                <FilterPresets
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  dateFrom={dateFrom}
                  setDateFrom={setDateFrom}
                  dateTo={dateTo}
                  setDateTo={setDateTo}
                  bnFilter={bnFilter}
                  setBnFilter={(v) => setBnFilter(v as "all" | "production" | "operational" | "completed")}
                />
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="rounded-md border border-[#c9a227]/10 bg-carbon px-2 py-1.5 text-xs text-cream focus:border-gold/50 focus:outline-none"
                >
                  <option value="all">Semua Brand</option>
                  {BRAND_FILTER_OPTIONS.map((brand) => (
                    <option key={brand.value} value={brand.value}>{brand.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Content — single unified view */}
          {initialLoading ? (
            <Loading variant="skeleton" text="Memuat data monitoring..." />
          ) : error ? (
            <ErrorState error={error} onRetry={refreshAll} />
          ) : (
            <OverviewTab
              prodData={prodData}
              opData={opData}
              bnData={bnData}
              activeExperts={activeExperts}
              avgYield={avgYield}
              urgentCount={urgentCount}
              qcPassRate={qcPassRate}
              criticalBn={criticalBn}
              bnFilter={bnFilter}
              setBnFilter={setBnFilter}
              filteredBn={filteredBn}
              prodBnCount={prodBnCount}
              opBnCount={opBnCount}
              completedOrders={filteredCompletedOrders}
              completedCount={completedCount}
              reworkData={reworkData}
              onOrderClick={(orderId, orderNumber) => {
                setDetailOrderId(orderId);
                setDetailOrderNumber(orderNumber);
              }}
            />
          )}
        </main>
        {detailOrderId && (
          <OrderDetailPopup
            orderId={detailOrderId}
            orderNumber={detailOrderNumber}
            onClose={() => setDetailOrderId(null)}
          />
        )}
      </div>
    </div>
  );
}
