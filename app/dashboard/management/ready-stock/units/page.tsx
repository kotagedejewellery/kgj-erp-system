"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";
import { BRANDS, getBrandName } from "@/lib/legacy/brands";
import { getReadyStockGenderOptions, readyStockGenderLabel } from "@/lib/inventory/ready-stock-gender";
import { MANAGEMENT_ROUTES } from "@/lib/routes";

type Unit = {
  id: string;
  unit_code: string;
  brand_id: number;
  source_product_id: number | null;
  location_id: string;
  location_label: string;
  size: string | null;
  material_label: string | null;
  actual_weight_grams: number | string | null;
  ring_gender: string | null;
  status: string;
  product_label: string;
  cover_image_url: string | null;
};

type Data = {
  units: Unit[];
  locations: { id: string; name: string }[];
  meta: { page: number; page_size: number; total: number };
};

const brandOptions = Object.entries(BRANDS).map(([id, brand]) => ({ id, ...brand }));
const inputClass = "mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

function statusLabel(status: string) {
  return ({ available: "Tersedia", allocated: "Dialokasikan", inspection: "Dalam pemeriksaan", retired: "Dinonaktifkan" } as Record<string, string>)[status] ?? status;
}

export default function ReadyStockUnitsPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [brandId, setBrandId] = useState(searchParams.get("brand_id") ?? "");
  const [sourceProductId, setSourceProductId] = useState(searchParams.get("source_product_id") ?? "");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState("");
  const [ringGender, setRingGender] = useState("");
  const [size, setSize] = useState("");
  const [retiringUnit, setRetiringUnit] = useState<Unit | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);
  const [message, setMessage] = useState("");
  const requestUrl = useMemo(() => {
    const parameters = new URLSearchParams({ page: String(page), page_size: "50" });
    if (query) parameters.set("q", query);
    if (brandId) parameters.set("brand_id", brandId);
    if (sourceProductId) parameters.set("source_product_id", sourceProductId);
    if (locationId) parameters.set("location_id", locationId);
    if (status) parameters.set("status", status);
    if (ringGender) parameters.set("ring_gender", ringGender);
    if (size) parameters.set("size", size);
    return `/api/inventory/ready-stock/units?${parameters.toString()}`;
  }, [brandId, locationId, page, query, ringGender, size, sourceProductId, status]);
  const { data, error, isLoading, refetch } = useQuery<Data>({ queryKey: ["ready-stock-units", requestUrl], queryFn: () => fetcher(requestUrl) });
  const totalPages = Math.max(1, Math.ceil((data?.meta.total ?? 0) / (data?.meta.page_size ?? 50)));
  const updateFilter = (change: () => void) => { change(); setPage(1); };

  const retire = async () => {
    if (!retiringUnit) return;
    setIsRetiring(true);
    try {
      await mutator(`/api/inventory/ready-stock/${retiringUnit.id}`, { method: "DELETE" });
      setMessage(`Unit ${retiringUnit.unit_code} dinonaktifkan. Riwayat mutasinya tetap tersimpan.`);
      setRetiringUnit(null);
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal menonaktifkan unit");
    } finally {
      setIsRetiring(false);
    }
  };

  return <div className="inventory-management flex min-h-screen bg-night">
    <Sidebar role="management" />
    <div className="min-w-0 flex-1">
      <Header userEmail="" role="management" />
      <main className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold text-ivory">Daftar unit fisik</h1><p className="mt-1 text-sm text-white/50">Kelola cincin satu per satu untuk audit, pemindahan gudang, perubahan spesifikasi, dan penonaktifan.</p></div><Link href={MANAGEMENT_ROUTES.READY_STOCK} className="shrink-0 text-sm font-medium text-gold underline underline-offset-4">Kembali ke model Ready-stock</Link></div>
        <nav aria-label="Navigasi ready-stock" className="flex flex-wrap gap-2 border-b border-gold/15 pb-3 text-sm"><Link href={MANAGEMENT_ROUTES.READY_STOCK} className="rounded px-3 py-2 text-cream hover:bg-white/5">Model ready-stock</Link><Link href={MANAGEMENT_ROUTES.READY_STOCK_VARIATIONS} className="rounded px-3 py-2 text-cream hover:bg-white/5">Kelola variasi</Link><span className="rounded bg-gold/15 px-3 py-2 font-medium text-gold">Daftar unit fisik</span></nav>
        {message && <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">{message}</p>}
        <section className="rounded-lg border border-gold/15 bg-cocoa p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm text-cream">Cari kode unit<input value={query} onChange={(event) => updateFilter(() => setQuery(event.target.value))} className={inputClass} /></label><label className="text-sm text-cream">Brand<select value={brandId} onChange={(event) => updateFilter(() => setBrandId(event.target.value))} className={inputClass}><option value="">Semua brand</option>{brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label className="text-sm text-cream">Gudang<select value={locationId} onChange={(event) => updateFilter(() => setLocationId(event.target.value))} className={inputClass}><option value="">Semua gudang</option>{data?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="text-sm text-cream">Status<select value={status} onChange={(event) => updateFilter(() => setStatus(event.target.value))} className={inputClass}><option value="">Semua status</option><option value="available">Tersedia</option><option value="allocated">Dialokasikan</option><option value="inspection">Dalam pemeriksaan</option><option value="retired">Dinonaktifkan</option></select></label><label className="text-sm text-cream">Jenis cincin<select value={ringGender} onChange={(event) => updateFilter(() => setRingGender(event.target.value))} className={inputClass}><option value="">Semua jenis</option>{getReadyStockGenderOptions("unspecified").map((gender) => <option key={gender.value} value={gender.value}>{gender.label}</option>)}</select></label><label className="text-sm text-cream">Ukuran cincin<input value={size} onChange={(event) => updateFilter(() => setSize(event.target.value))} placeholder="Contoh: 16" className={inputClass} /></label></div>{sourceProductId && <div className="mt-4 flex items-center justify-between gap-3 rounded border border-gold/20 bg-carbon px-3 py-2 text-sm text-cream"><span>Filter model dari galeri sedang aktif.</span><button type="button" onClick={() => updateFilter(() => setSourceProductId(""))} className="text-gold underline underline-offset-4">Tampilkan semua model</button></div>}</section>
        {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat unit ready-stock"}</p>
          : isLoading ? <div className="h-96 animate-pulse rounded-lg bg-cocoa" />
            : <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa"><div className="border-b border-gold/10 px-4 py-3 text-sm text-white/50">Menampilkan {data?.units.length ?? 0} dari {data?.meta.total ?? 0} unit fisik.</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-white/45"><tr><th className="p-3">Unit</th><th>Brand</th><th>Model</th><th>Gudang</th><th>Bahan</th><th>Ukuran</th><th>Jenis cincin</th><th>Berat</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{data?.units.length ? data.units.map((unit) => <tr key={unit.id} className="border-t border-white/5 text-cream"><td className="p-3">{unit.unit_code}</td><td>{getBrandName(unit.brand_id)}</td><td><div className="flex items-center gap-2">{unit.cover_image_url && <img src={unit.cover_image_url} alt="" loading="lazy" className="h-9 w-9 rounded object-cover" />}<span>{unit.product_label}</span></div></td><td>{unit.location_label}</td><td>{unit.material_label ?? "—"}</td><td>{unit.size ?? "—"}</td><td>{readyStockGenderLabel(unit.ring_gender)}</td><td>{unit.actual_weight_grams === null ? "Tidak ditimbang" : `${Number(unit.actual_weight_grams).toFixed(3)} g`}</td><td>{statusLabel(unit.status)}</td><td><div className="flex gap-2">{["available", "inspection"].includes(unit.status) ? <><Link href={`${MANAGEMENT_ROUTES.READY_STOCK_NEW}?unit=${unit.id}`} className="text-gold underline underline-offset-4">Ubah</Link><button type="button" onClick={() => setRetiringUnit(unit)} className="text-rose-200 underline underline-offset-4">Nonaktifkan</button></> : <span className="text-xs text-white/40">Terkunci oleh status</span>}</div></td></tr>) : <tr><td colSpan={10} className="p-6 text-center text-sm text-white/50">Tidak ada unit yang sesuai filter.</td></tr>}</tbody></table></div>{totalPages > 1 && <div className="flex items-center justify-end gap-3 border-t border-gold/10 p-3 text-sm text-cream"><button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-gold/30 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40">Sebelumnya</button><span>{page} / {totalPages}</span><button type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded border border-gold/30 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40">Berikutnya</button></div>}</section>}
      </main>
    </div>
    <ConfirmDialog isOpen={Boolean(retiringUnit)} title="Nonaktifkan unit ready-stock?" message={retiringUnit ? `Unit ${retiringUnit.unit_code} tidak akan dihapus. Riwayat mutasinya tetap tersimpan.` : ""} confirmText="Nonaktifkan" variant="warning" isLoading={isRetiring} onConfirm={retire} onCancel={() => setRetiringUnit(null)} />
  </div>;
}
