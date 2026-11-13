"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gem, Plus, RefreshCw } from "lucide-react";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";
import { getBrandName } from "@/lib/legacy/brands";
import { type ReadyStockGallerySummary, type ReadyStockModelSummary } from "@/lib/inventory/ready-stock-summary";
import { readyStockGenderLabel } from "@/lib/inventory/ready-stock-gender";
import { MANAGEMENT_ROUTES } from "@/lib/routes";

type Data = { models: ReadyStockGallerySummary[]; meta: { page: number; page_size: number; total: number } };

const inputClass = "mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

function variationLabel(model: ReadyStockModelSummary) {
  const detail = [model.material_description, model.size ? `Ukuran ${model.size}` : null, readyStockGenderLabel(model.ring_gender)].filter(Boolean).join(" · ");
  return `${detail || "Spesifikasi belum lengkap"} — ${model.available_units} tersedia`;
}

export default function ReadyStockPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [modelPage, setModelPage] = useState(1);
  const requestUrl = useMemo(() => {
    const parameters = new URLSearchParams({ page: String(modelPage), page_size: "12" });
    if (modelSearch.trim()) parameters.set("q", modelSearch.trim());
    return `/api/inventory/ready-stock/models?${parameters.toString()}`;
  }, [modelPage, modelSearch]);
  const { data, error, isLoading, refetch } = useQuery<Data>({
    queryKey: ["ready-stock-models", requestUrl],
    queryFn: () => fetcher(requestUrl),
  });

  useEffect(() => {
    const added = Number(searchParams.get("added"));
    if (!Number.isInteger(added) || added <= 0) return;
    setMessage(`${added} unit ready-stock berhasil dicatat.`);
    router.replace(MANAGEMENT_ROUTES.READY_STOCK);
  }, [router, searchParams]);

  const modelPageCount = Math.max(1, Math.ceil((data?.meta.total ?? 0) / (data?.meta.page_size ?? 12)));
  const activeModelPage = Math.min(modelPage, modelPageCount);
  const visibleModels = data?.models ?? [];

  const refreshCatalog = async () => {
    setIsRefreshingCatalog(true);
    try {
      await mutator("/api/inventory/catalog/refresh");
      setMessage("Katalog diperbarui. Model dan foto terbaru siap dipakai.");
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Katalog tidak dapat diperbarui");
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  return <div className="inventory-management flex min-h-screen bg-night">
    <Sidebar role="management" />
    <div className="min-w-0 flex-1">
      <Header userEmail="" role="management" />
      <main className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h1 className="text-2xl font-semibold text-ivory">Ready-stock</h1><p className="mt-1 text-sm text-white/50">Temukan model cincin jadi dan jumlah stok yang tersedia. Pengelolaan variasi dan unit fisik tersedia pada halaman terpisah.</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={refreshCatalog} disabled={isRefreshingCatalog} className="inline-flex items-center gap-2 rounded border border-gold/40 px-3 py-2 text-sm font-medium text-gold disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${isRefreshingCatalog ? "animate-spin" : ""}`} />{isRefreshingCatalog ? "Memperbarui..." : "Perbarui katalog"}</button><Link href={MANAGEMENT_ROUTES.READY_STOCK_VARIATIONS} className="inline-flex items-center gap-2 rounded bg-gold px-3 py-2 text-sm font-medium text-night"><Plus className="h-4 w-4" />Kelola stok per ukuran</Link><Link href={MANAGEMENT_ROUTES.READY_STOCK_NEW} className="inline-flex items-center gap-2 rounded border border-gold/40 px-3 py-2 text-sm font-medium text-gold"><Plus className="h-4 w-4" />Tambah unit timbang</Link><Link href={MANAGEMENT_ROUTES.READY_STOCK_IMPORT} className="inline-flex items-center gap-2 rounded border border-gold/40 px-3 py-2 text-sm font-medium text-gold">Impor stok awal</Link></div>
        </div>

        <nav aria-label="Navigasi ready-stock" className="flex flex-wrap gap-2 border-b border-gold/15 pb-3 text-sm"><span className="rounded bg-gold/15 px-3 py-2 font-medium text-gold">Model ready-stock</span><Link href={MANAGEMENT_ROUTES.READY_STOCK_VARIATIONS} className="rounded px-3 py-2 text-cream hover:bg-white/5">Kelola variasi</Link><Link href={MANAGEMENT_ROUTES.READY_STOCK_UNITS} className="rounded px-3 py-2 text-cream hover:bg-white/5">Daftar unit fisik</Link></nav>
        {message && <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">{message}</p>}

        {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat ready-stock"}</p>
          : isLoading ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-80 animate-pulse rounded-lg bg-cocoa" />)}</div>
            : <section>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold text-cream">Model tersedia</h2><p className="mt-1 text-sm text-white/50">Satu kartu untuk satu model dan brand. Pilih kartu untuk melihat serta mengelola unit fisiknya.</p></div><label className="w-full text-sm text-cream sm:max-w-xs">Cari model<input value={modelSearch} onChange={(event) => { setModelSearch(event.target.value); setModelPage(1); }} className={inputClass} /></label></div>
              {visibleModels.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{visibleModels.map((model) => <ModelCard key={`${model.source_product_id}-${model.brand_id ?? ""}`} model={model} />)}</div> : <div className="rounded-lg border border-gold/15 bg-cocoa p-8 text-center text-sm text-white/50">Belum ada model ready-stock yang sesuai.</div>}
              {modelPageCount > 1 && <div className="mt-4 flex items-center justify-end gap-3 text-sm text-cream"><button type="button" disabled={activeModelPage === 1} onClick={() => setModelPage((page) => Math.max(1, page - 1))} className="rounded border border-gold/30 px-3 py-1 disabled:opacity-40">Sebelumnya</button><span>{activeModelPage} / {modelPageCount}</span><button type="button" disabled={activeModelPage === modelPageCount} onClick={() => setModelPage((page) => Math.min(modelPageCount, page + 1))} className="rounded border border-gold/30 px-3 py-1 disabled:opacity-40">Berikutnya</button></div>}
            </section>}
      </main>
    </div>
  </div>;
}

function ModelCard({ model }: { model: ReadyStockGallerySummary }) {
  const unitQuery = new URLSearchParams({ source_product_id: String(model.source_product_id), brand_id: String(model.brand_id) });
  const variationQuery = new URLSearchParams({ source_product_id: String(model.source_product_id), brand_id: String(model.brand_id) });
  return <article className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa"><div className="aspect-[4/3] bg-carbon">{model.cover_image_url ? <img src={model.cover_image_url} alt={`Foto ${model.label}`} loading="lazy" className="h-full w-full object-cover" /> : <div aria-hidden="true" className="flex h-full items-center justify-center text-gold/50"><Gem className="h-10 w-10" /></div>}</div><div className="space-y-3 p-4"><div><p className="text-sm font-semibold text-cream">{model.label}</p><p className="mt-1 text-xs text-white/50">{model.brand_id ? getBrandName(model.brand_id) : "Brand belum dicatat"}</p></div><div className="flex items-baseline justify-between"><span className="text-xs text-white/50">Unit tersedia</span><strong className="text-xl tabular-nums text-gold">{model.available_units}</strong></div><ul className="space-y-1 text-xs text-white/60">{model.variations.slice(0, 2).map((variation) => <li key={`${variation.source_material_id ?? ""}-${variation.location_id ?? ""}-${variation.size ?? ""}-${variation.condition ?? ""}-${variation.ring_gender ?? ""}`}>{variationLabel(variation)}</li>)}{model.variations.length > 2 && <li>+{model.variations.length - 2} variasi lain</li>}</ul><div className="grid gap-2"><Link href={`${MANAGEMENT_ROUTES.READY_STOCK_VARIATIONS}?${variationQuery.toString()}`} className="block w-full rounded bg-gold px-3 py-2 text-center text-sm font-medium text-night">Kelola stok per ukuran</Link><Link href={`${MANAGEMENT_ROUTES.READY_STOCK_UNITS}?${unitQuery.toString()}`} className="block w-full rounded border border-gold/30 px-3 py-2 text-center text-sm font-medium text-gold">Lihat unit fisik ({model.total_units})</Link></div></div></article>;
}
