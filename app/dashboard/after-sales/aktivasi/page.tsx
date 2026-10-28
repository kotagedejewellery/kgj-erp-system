"use client";

import { FormEvent, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, Search, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/MobileHeader";
import Sidebar from "@/components/layout/MobileSidebar";
import WarrantyPreparation from "@/components/orders/WarrantyPreparation";
import { ApiError, fetcher } from "@/lib/api";

type PreparationSearchResult = {
  data: {
    order: { id: string; reference: string; current_stage: string };
  };
};

export default function AfterSalesActivationPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [orderReference, setOrderReference] = useState("");

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

  const preparation = useQuery<PreparationSearchResult>({
    queryKey: ["after-sales-warranty-preparation", orderReference],
    queryFn: () => fetcher<PreparationSearchResult>(
      `/api/warranty/preparation?order_reference=${encodeURIComponent(orderReference)}`,
    ),
    enabled: Boolean(orderReference),
    retry: false,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reference = input.trim();
    if (reference) setOrderReference(reference);
  }

  const order = preparation.data?.data.order;

  return (
    <div className="flex h-screen flex-col bg-[#26211c] md:flex-row">
      <Sidebar role="after_sales" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={userName} role="after_sales" logoutPath="/login" onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="min-w-0 space-y-5">
            <div>
              <h1 className="text-xl font-bold text-ivory sm:text-2xl">Aktivasi Garansi</h1>
              <p className="mt-1 text-sm text-white/55">Cari nomor order untuk menyiapkan unit cincin, mengirim Candidate, lalu mengaktifkan Contract.</p>
            </div>

            <form onSubmit={submit} className="flex gap-2">
              <label className="sr-only" htmlFor="warranty-order-search">Nomor order</label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  id="warranty-order-search"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Nomor order, misalnya KGJ-001"
                  className="w-full rounded-lg border border-white/10 bg-[#1C1917] py-2.5 pl-10 pr-3 text-sm text-[#e8e2d4] outline-none placeholder:text-white/30 focus:border-[#c9a227]/70"
                />
              </div>
              <button type="submit" className="rounded-lg bg-[#c9a227] px-4 text-sm font-semibold text-[#1C1917] transition-colors hover:bg-[#dfbb40]">
                Buka order
              </button>
            </form>

            {!orderReference && (
              <div className="rounded-lg border border-dashed border-white/15 bg-[#1C1917] px-4 py-8 text-center text-sm text-white/50">
                Masukkan nomor order untuk memulai Warranty Preparation.
              </div>
            )}

            {preparation.isLoading && <p className="text-sm text-white/50">Memuat order…</p>}
            {preparation.error instanceof ApiError && preparation.error.status === 404 && (
              <div className="flex items-start gap-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Nomor order tidak ditemukan. Periksa kembali nomor ordernya.
              </div>
            )}
            {preparation.error && !(preparation.error instanceof ApiError && preparation.error.status === 404) && (
              <div className="flex items-start gap-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {preparation.error instanceof Error ? preparation.error.message : "Order tidak dapat dimuat."}
              </div>
            )}

            {order && (
              <section className="rounded-lg border border-white/10 bg-[#1C1917] p-4">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <h2 className="font-semibold text-[#f0f4ff]">{order.reference}</h2>
                    <p className="mt-1 text-xs text-white/50">Tahap saat ini: {order.current_stage || "belum tersedia"}</p>
                  </div>
                  <ShieldCheck className="h-5 w-5 shrink-0 text-[#c9a227]" aria-hidden="true" />
                </div>
                <div className="pt-4">
                  <WarrantyPreparation orderId={order.id} currentStage={order.current_stage} />
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
