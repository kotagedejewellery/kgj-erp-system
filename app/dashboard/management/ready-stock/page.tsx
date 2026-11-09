"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gem, Plus, RefreshCw } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";
import { BRANDS, getBrandName } from "@/lib/legacy/brands";
import { buildReadyStockGallerySummaries, type ReadyStockGallerySummary, type ReadyStockModelSummary } from "@/lib/inventory/ready-stock-summary";
import { MANAGEMENT_ROUTES } from "@/lib/routes";

type Unit = {
  id: string;
  unit_code: string;
  brand_id: number;
  source_product_id: number | null;
  source_material_id: number | null;
  location_id: string;
  size: string | null;
  material_description: string | null;
  actual_weight_grams: number | string;
  condition: string;
  status: string;
  product_label: string;
  cover_image_url: string | null;
  material_label: string;
};

type Data = {
  units: Unit[];
  locations: { id: string; name: string }[];
  models: ReadyStockModelSummary[];
};

type SelectedModel = Pick<ReadyStockGallerySummary, "source_product_id" | "brand_id" | "label">;

const brandOptions = Object.entries(BRANDS).map(([id, brand]) => ({ id, ...brand }));
const inputClass = "mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

function statusLabel(status: string) {
  return ({ available: "Tersedia", allocated: "Dialokasikan", inspection: "Dalam pemeriksaan", retired: "Dinonaktifkan" } as Record<string, string>)[status] ?? status;
}

function variationLabel(model: ReadyStockModelSummary) {
  const detail = [model.material_description, model.size ? `Ukuran ${model.size}` : null].filter(Boolean).join(" · ");
  return `${detail || "Spesifikasi belum lengkap"} — ${model.available_units} tersedia`;
}

export default function ReadyStockPage() {
  const [message, setMessage] = useState("");
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [retiringUnit, setRetiringUnit] = useState<Unit | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [modelPage, setModelPage] = useState(1);
  const [unitSearch, setUnitSearch] = useState("");
  const [unitBrand, setUnitBrand] = useState("");
  const [unitStatus, setUnitStatus] = useState("");
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null);
  const { data, error, isLoading, refetch } = useQuery<Data>({
    queryKey: ["ready-stock"],
    queryFn: () => fetcher("/api/inventory/ready-stock"),
  });

  const modelCards = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return buildReadyStockGallerySummaries(data?.models ?? []).filter((model) =>
      !query || [model.label, ...model.variations.flatMap((variation) => [variation.material_description ?? "", variation.size ?? ""])].join(" ").toLowerCase().includes(query),
    );
  }, [data?.models, modelSearch]);
  const modelPageSize = 12;
  const modelPageCount = Math.max(1, Math.ceil(modelCards.length / modelPageSize));
  const activeModelPage = Math.min(modelPage, modelPageCount);
  const visibleModels = modelCards.slice((activeModelPage - 1) * modelPageSize, activeModelPage * modelPageSize);

  const visibleUnits = useMemo(() => {
    const query = unitSearch.trim().toLowerCase();
    return (data?.units ?? []).filter((unit) =>
      (!selectedModel || (unit.source_product_id === selectedModel.source_product_id && unit.brand_id === selectedModel.brand_id)) &&
      (!query || `${unit.unit_code} ${unit.product_label} ${unit.material_label}`.toLowerCase().includes(query)) &&
      (!unitBrand || unit.brand_id === Number(unitBrand)) &&
      (!unitStatus || unit.status === unitStatus),
    );
  }, [data?.units, selectedModel, unitBrand, unitSearch, unitStatus]);
  const locationName = (locationId: string) => data?.locations.find((location) => location.id === locationId)?.name ?? "Gudang tidak tersedia";

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

  const retire = async () => {
    if (!retiringUnit) return;
    setIsRetiring(true);
    try {
      await mutator(`/api/inventory/ready-stock/${retiringUnit.id}`, { method: "DELETE" });
      setMessage(`Unit ${retiringUnit.unit_code} dinonaktifkan dan tetap tersimpan pada riwayat mutasi.`);
      setRetiringUnit(null);
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal menonaktifkan unit");
    } finally {
      setIsRetiring(false);
    }
  };

  const showUnits = (model: ReadyStockGallerySummary) => {
    setSelectedModel({ source_product_id: model.source_product_id, brand_id: model.brand_id, label: model.label });
    setUnitSearch("");
    setUnitBrand("");
    setUnitStatus("");
    requestAnimationFrame(() => document.getElementById("unit-fisik")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="inventory-management flex min-h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1">
        <Header userEmail="" role="management" />
        <main className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-ivory">Ready-stock</h1>
              <p className="mt-1 text-sm text-white/50">Lihat model cincin jadi, spesifikasi, dan jumlah unit fisik yang tersedia.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={refreshCatalog} disabled={isRefreshingCatalog} className="inline-flex items-center gap-2 rounded border border-gold/40 px-3 py-2 text-sm font-medium text-gold disabled:cursor-not-allowed disabled:opacity-60">
                <RefreshCw className={`h-4 w-4 ${isRefreshingCatalog ? "animate-spin" : ""}`} />
                {isRefreshingCatalog ? "Memperbarui..." : "Perbarui katalog"}
              </button>
              <Link href={MANAGEMENT_ROUTES.READY_STOCK_NEW} className="inline-flex items-center gap-2 rounded bg-gold px-3 py-2 text-sm font-medium text-night"><Plus className="h-4 w-4" />Tambah unit cincin</Link>
            </div>
          </div>

          {message && <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">{message}</p>}

          {error ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat ready-stock"}</p>
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-80 animate-pulse rounded-lg bg-cocoa" />)}</div>
          ) : (
            <>
              <section>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div><h2 className="font-semibold text-cream">Model tersedia</h2><p className="mt-1 text-sm text-white/50">Satu kartu untuk satu model dan brand. Variasi ukuran atau bahan tetap dihitung di dalamnya.</p></div>
                  <label className="w-full text-sm text-cream sm:max-w-xs">Cari model, bahan, atau ukuran<input value={modelSearch} onChange={(event) => { setModelSearch(event.target.value); setModelPage(1); }} className={inputClass} /></label>
                </div>
                {visibleModels.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{visibleModels.map((model) => (
                  <article key={`${model.source_product_id}-${model.brand_id ?? ""}`} className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa">
                    <div className="aspect-[4/3] bg-carbon">{model.cover_image_url ? <img src={model.cover_image_url} alt={`Foto ${model.label}`} loading="lazy" className="h-full w-full object-cover" /> : <div aria-hidden="true" className="flex h-full items-center justify-center text-gold/50"><Gem className="h-10 w-10" /></div>}</div>
                    <div className="space-y-3 p-4">
                      <div><p className="text-sm font-semibold text-cream">{model.label}</p><p className="mt-1 text-xs text-white/50">{model.brand_id ? getBrandName(model.brand_id) : "Brand belum dicatat"}</p></div>
                      <div className="flex items-baseline justify-between"><span className="text-xs text-white/50">Unit tersedia</span><strong className="text-xl tabular-nums text-gold">{model.available_units}</strong></div>
                      <ul className="space-y-1 text-xs text-white/60">{model.variations.slice(0, 2).map((variation) => <li key={`${variation.source_material_id ?? ""}-${variation.size ?? ""}`}>{variationLabel(variation)}</li>)}{model.variations.length > 2 && <li>+{model.variations.length - 2} variasi lain</li>}</ul>
                      <button type="button" onClick={() => showUnits(model)} className="w-full rounded border border-gold/30 px-3 py-2 text-sm font-medium text-gold">Lihat unit fisik ({model.total_units})</button>
                    </div>
                  </article>
                ))}</div> : <div className="rounded-lg border border-gold/15 bg-cocoa p-8 text-center text-sm text-white/50">Belum ada model ready-stock yang sesuai.</div>}
                {modelPageCount > 1 && <div className="mt-4 flex items-center justify-end gap-3 text-sm text-cream"><button type="button" disabled={activeModelPage === 1} onClick={() => setModelPage((page) => Math.max(1, page - 1))} className="rounded border border-gold/30 px-3 py-1 disabled:opacity-40">Sebelumnya</button><span>{activeModelPage} / {modelPageCount}</span><button type="button" disabled={activeModelPage === modelPageCount} onClick={() => setModelPage((page) => Math.min(modelPageCount, page + 1))} className="rounded border border-gold/30 px-3 py-1 disabled:opacity-40">Berikutnya</button></div>}
              </section>

              <section id="unit-fisik" className="scroll-mt-6 overflow-hidden rounded-lg border border-gold/15 bg-cocoa">
                <div className="border-b border-gold/10 p-4"><h2 className="font-semibold text-cream">Daftar unit fisik</h2><p className="mt-1 text-sm text-white/50">Kelola unit satu per satu, termasuk perubahan gudang sebelum unit dialokasikan.</p>{selectedModel && <div className="mt-3 flex items-center justify-between gap-3 rounded border border-gold/20 bg-carbon px-3 py-2 text-sm text-cream"><span>Menampilkan unit: {selectedModel.label}</span><button type="button" onClick={() => setSelectedModel(null)} className="shrink-0 text-gold underline underline-offset-4">Tampilkan semua</button></div>}<div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-sm text-cream">Cari unit atau model<input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} className={inputClass} /></label><label className="text-sm text-cream">Brand<select value={unitBrand} onChange={(event) => setUnitBrand(event.target.value)} className={inputClass}><option value="">Semua brand</option>{brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label className="text-sm text-cream">Status<select value={unitStatus} onChange={(event) => setUnitStatus(event.target.value)} className={inputClass}><option value="">Semua status</option><option value="available">Tersedia</option><option value="allocated">Dialokasikan</option><option value="inspection">Dalam pemeriksaan</option><option value="retired">Dinonaktifkan</option></select></label></div></div>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-white/45"><tr><th className="p-3">Unit</th><th>Brand</th><th>Model</th><th>Gudang</th><th>Bahan</th><th>Ukuran</th><th>Berat</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{visibleUnits.length ? visibleUnits.map((unit) => <tr key={unit.id} className="border-t border-white/5 text-cream"><td className="p-3">{unit.unit_code}</td><td>{getBrandName(unit.brand_id)}</td><td><div className="flex items-center gap-2">{unit.cover_image_url && <img src={unit.cover_image_url} alt="" loading="lazy" className="h-9 w-9 rounded object-cover" />}<span>{unit.product_label}</span></div></td><td>{locationName(unit.location_id)}</td><td>{unit.material_label}</td><td>{unit.size ?? "â€”"}</td><td>{Number(unit.actual_weight_grams).toFixed(3)} g</td><td>{statusLabel(unit.status)}</td><td><div className="flex gap-2">{["available", "inspection"].includes(unit.status) ? <><Link href={`${MANAGEMENT_ROUTES.READY_STOCK_NEW}?unit=${unit.id}`} className="text-gold underline underline-offset-4">Ubah</Link><button type="button" onClick={() => setRetiringUnit(unit)} className="text-rose-200 underline underline-offset-4">Nonaktifkan</button></> : <span className="text-xs text-white/40">Terkunci oleh status</span>}</div></td></tr>) : <tr><td colSpan={9} className="p-6 text-center text-sm text-white/50">Tidak ada unit yang sesuai filter.</td></tr>}</tbody></table></div>
              </section>
            </>
          )}
        </main>
      </div>
      <ConfirmDialog isOpen={Boolean(retiringUnit)} title="Nonaktifkan unit ready-stock?" message={retiringUnit ? `Unit ${retiringUnit.unit_code} tidak akan dihapus. Riwayat mutasinya tetap tersimpan.` : ""} confirmText="Nonaktifkan" variant="warning" isLoading={isRetiring} onConfirm={retire} onCancel={() => setRetiringUnit(null)} />
    </div>
  );
}
