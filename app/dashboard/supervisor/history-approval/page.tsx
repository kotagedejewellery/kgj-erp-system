// app/dashboard/supervisor/history-approval/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import Sidebar from "@/components/layout/MobileSidebar";
import Header from "@/components/layout/MobileHeader";
import OrderDetailPopup from "@/components/orders/OrderDetailPopup";
import { BRAND_FILTER_OPTIONS } from "@/lib/legacy/brands";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";

interface ApprovalItem {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string | null;
  stage: string;
  stage_label: string;
  action: "approve" | "reject" | "return";
  remarks: string | null;
  decided_by: string | null;
  decided_at: string;
  brand: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupervisorApprovalHistoryPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [brand, setBrand] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailNumber, setDetailNumber] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (!res.ok) {
        router.push("/workshop/login");
        return;
      }
      const json = await res.json();
      setUserEmail(json.data.username || json.data.full_name || "");
    })();
  }, [router]);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{
    data: { items: ApprovalItem[]; next_offset: number | null };
  }>({
    queryKey: ["approval-history", brand],
    queryFn: ({ pageParam }) =>
      fetcher<{ data: { items: ApprovalItem[]; next_offset: number | null } }>(
        `/api/supervisor/approval-history?brand=${brand}&limit=50&offset=${pageParam}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (page) => page.data.next_offset,
  });

  const items = data?.pages.flatMap((page) => page.data.items) ?? [];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#26211c]">
      <Sidebar
        role="supervisor"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userEmail={userEmail}
          role="supervisor"
          logoutPath="/workshop/login"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-ivory">
                Riwayat Persetujuan
              </h1>
              <p className="mt-0.5 text-xs sm:text-sm text-white/50">
                Keputusan persetujuan dan validasi yang Anda buat
              </p>
            </div>
            <div className="flex items-center gap-2">
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
              <button
                onClick={() => refetch()}
                className="rounded-lg border border-gold/15 bg-carbon px-2.5 py-2 text-xs text-cream hover:bg-cocoa transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gold/10 bg-cocoa overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#26211c]/80 border-b border-gold/10">
                  <tr>
                    {["Order", "Customer", "Tahap", "Keputusan", "Tanggal", "Alasan"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/50 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-white/40 text-sm">
                        Memuat data...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-white/40 text-sm">
                        Belum ada riwayat persetujuan.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setDetailId(item.order_id);
                          setDetailNumber(item.order_number);
                        }}
                        className="hover:bg-[#26211c]/50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-cream">{item.order_number}</td>
                        <td className="px-4 py-3 text-cream">{item.customer_name ?? "—"}</td>
                        <td className="px-4 py-3 text-white/70">{item.stage_label}</td>
                        <td className="px-4 py-3">
                          {item.action === "approve" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300 text-xs font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Disetujui
                            </span>
                          ) : item.action === "return" ? (
                            <span className="inline-flex items-center gap-1 text-amber-300 text-xs font-medium">
                              <RefreshCw className="h-3.5 w-3.5" /> Dikembalikan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-300 text-xs font-medium">
                              <XCircle className="h-3.5 w-3.5" /> Ditolak
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/50">{formatDateTime(item.decided_at)}</td>
                        <td className="px-4 py-3 text-white/50 max-w-[200px] truncate">
                          {item.remarks ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {hasNextPage && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-md border border-gold/15 bg-cocoa px-4 py-2 text-xs font-medium text-cream transition hover:bg-[#26211c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFetchingNextPage ? "Memuat riwayat..." : "Muat riwayat lainnya"}
              </button>
            </div>
          )}
        </main>
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
