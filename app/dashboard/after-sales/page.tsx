"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CircleAlert, ClipboardList, RefreshCw, ShieldCheck } from "lucide-react";
import Header from "@/components/layout/MobileHeader";
import Sidebar from "@/components/layout/MobileSidebar";
import { ApiError, fetcher } from "@/lib/api";
import { AFTER_SALES_ROUTES } from "@/lib/routes";

type Summary = {
  data: {
    active_contracts: number;
    expiring_within_30_days: number;
    pending_activations: number;
    active_claims: number;
    activation_queue: { order_reference: string; status: "pending" | "failed"; updated_at: string }[];
    last_synced_at: string | null;
  };
};

function formatDateTime(value: string | null) {
  if (!value) return "belum ada data";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AfterSalesDashboardPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (!result?.data) {
          router.push("/login");
          return;
        }
        setUserName(result.data.username || result.data.full_name || "");
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const summary = useQuery<Summary>({
    queryKey: ["after-sales-warranty-summary"],
    queryFn: () => fetcher<Summary>("/api/warranty/after-sales-summary"),
    retry: false,
  });

  const metrics = summary.data ? [
    { label: "Contract aktif", value: summary.data.data.active_contracts, detail: "Masih dalam masa garansi" },
    { label: "Aktivasi antre", value: summary.data.data.pending_activations, detail: "Menunggu pengiriman atau retry" },
    { label: "Claim berjalan", value: summary.data.data.active_claims, detail: "Belum selesai atau dibatalkan" },
    { label: "Mendekati berakhir", value: summary.data.data.expiring_within_30_days, detail: "Berakhir dalam 30 hari" },
  ] : [];

  return (
    <div className="flex h-screen flex-col bg-[#26211c] md:flex-row">
      <Sidebar role="after_sales" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={userName} role="after_sales" logoutPath="/login" onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="min-w-0 space-y-6">
            <header>
              <h1 className="text-xl font-bold text-ivory sm:text-2xl">Dashboard Garansi</h1>
              <p className="mt-1 text-sm text-white/65">Ringkasan pekerjaan Garansi untuk seluruh tim After Sales.</p>
            </header>

            {summary.isLoading && (
              <section className="animate-pulse rounded-lg border border-white/10 bg-[#1C1917]">
                <div className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                  {["contract", "activation", "claim", "expiry"].map((key) => <div key={key} className="h-28 p-4"><div className="h-3 w-28 rounded bg-white/10" /><div className="mt-4 h-7 w-16 rounded bg-white/10" /></div>)}
                </div>
              </section>
            )}

            {summary.error && (
              <div className="flex items-start gap-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p>{summary.error instanceof Error ? summary.error.message : "Ringkasan Garansi tidak dapat dimuat."}</p>
                  {summary.error instanceof ApiError && summary.error.status === 403 && <p className="mt-1 text-rose-100/80">Hubungi Super Admin bila akses After Sales belum dipetakan.</p>}
                </div>
              </div>
            )}

            {summary.data && (
              <section className="overflow-hidden rounded-lg border border-white/10 bg-[#1C1917]">
                <dl className="grid divide-y divide-white/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="p-4">
                      <dt className="text-xs text-white/50">{metric.label}</dt>
                      <dd className="mt-2 text-2xl font-semibold text-[#f0f4ff]">{metric.value}</dd>
                      <p className="mt-1 text-xs text-white/55">{metric.detail}</p>
                    </div>
                  ))}
                </dl>
                <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
                  <p className="text-xs text-white/45">Sinkronisasi Warranty terakhir: {formatDateTime(summary.data.data.last_synced_at)}</p>
                  <button type="button" onClick={() => void summary.refetch()} disabled={summary.isFetching} className="inline-flex min-h-8 items-center gap-1.5 rounded px-2 text-xs font-medium text-[#c9a227] hover:bg-white/5 disabled:cursor-wait disabled:opacity-60">
                    <RefreshCw className={`h-3.5 w-3.5 ${summary.isFetching ? "animate-spin" : ""}`} />
                    Muat ulang
                  </button>
                </div>
              </section>
            )}

            <section className="border-t border-white/10 pt-5">
              <h2 className="text-base font-semibold text-[#f0f4ff]">Tindakan utama</h2>
              <p className="mt-1 text-sm text-white/60">Lanjutkan pekerjaan tanpa berpindah ke dashboard SPV atau Workshop.</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <Link href={AFTER_SALES_ROUTES.AKTIVASI} className="group flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-[#1C1917] p-4 transition-colors hover:border-[#c9a227]/50 hover:bg-[#2a2522]">
                  <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#c9a227]" /><div><h3 className="font-medium text-[#e8e2d4]">Aktivasi Garansi</h3><p className="mt-1 text-sm text-white/60">Siapkan unit, validasi Candidate, lalu aktifkan Contract.</p></div></div>
                  <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-[#c9a227]" />
                </Link>
                <Link href={AFTER_SALES_ROUTES.GARANSI} className="group flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-[#1C1917] p-4 transition-colors hover:border-[#c9a227]/50 hover:bg-[#2a2522]">
                  <div className="flex gap-3"><ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-[#c9a227]" /><div><h3 className="font-medium text-[#e8e2d4]">Cari Contract dan Claim</h3><p className="mt-1 text-sm text-white/60">Periksa benefit, kuota, riwayat Claim, atau buat Claim baru.</p></div></div>
                  <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-[#c9a227]" />
                </Link>
              </div>
            </section>

            {summary.data && summary.data.data.activation_queue.length > 0 && (
              <section className="overflow-hidden rounded-lg border border-amber-300/20 bg-[#1C1917]">
                <div className="border-b border-amber-300/15 px-4 py-3">
                  <h2 className="text-base font-semibold text-amber-100">Aktivasi perlu diperiksa</h2>
                  <p className="mt-1 text-sm text-white/60">Lima aktivasi terbaru yang masih menunggu pengiriman atau retry.</p>
                </div>
                <div className="divide-y divide-white/10">
                  {summary.data.data.activation_queue.map((activation) => (
                    <Link key={activation.order_reference} href={`${AFTER_SALES_ROUTES.AKTIVASI}?order_reference=${encodeURIComponent(activation.order_reference)}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/5">
                      <div><p className="text-sm font-medium text-[#e8e2d4]">{activation.order_reference}</p><p className="mt-0.5 text-xs text-white/50">Diperbarui {formatDateTime(activation.updated_at)}</p></div>
                      <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-medium text-amber-100">{activation.status === "failed" ? "Perlu retry" : "Menunggu kirim"}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
