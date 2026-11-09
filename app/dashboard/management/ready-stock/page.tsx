"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";
import { BRANDS, getBrandName } from "@/lib/legacy/brands";

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

type ModelSummary = {
  source_product_id: number;
  brand_id: number | null;
  source_material_id: number | null;
  size: string | null;
  material_description: string | null;
  label: string;
  cover_image_url: string | null;
  available_units: number;
  allocated_units: number;
  inspection_units: number;
  total_units: number;
};

type Data = {
  units: Unit[];
  locations: { id: string; name: string }[];
  materials: { code: string; name: string; source_material_id: number }[];
  models: ModelSummary[];
};

type CatalogProduct = { id: number; label: string; cover_image_url: string | null };

const brandOptions = Object.entries(BRANDS).map(([id, brand]) => ({ id, ...brand }));
const inputClass = "mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

function statusLabel(status: string) {
  return ({ available: "Tersedia", allocated: "Dialokasikan", inspection: "Dalam pemeriksaan", retired: "Dinonaktifkan" } as Record<string, string>)[status] ?? status;
}

export default function ReadyStockPage() {
  const [message, setMessage] = useState("");
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [retiringUnit, setRetiringUnit] = useState<Unit | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [modelPage, setModelPage] = useState(1);
  const [unitSearch, setUnitSearch] = useState("");
  const [unitBrand, setUnitBrand] = useState("");
  const [unitStatus, setUnitStatus] = useState("");
  const { data, error, isLoading, refetch } = useQuery<Data>({
    queryKey: ["ready-stock"],
    queryFn: () => fetcher("/api/inventory/ready-stock"),
  });
  const { data: catalogData, isFetching: isProductSearching } = useQuery<{ products: CatalogProduct[] }>({
    queryKey: ["inventory-catalog-products", productSearch],
    queryFn: () => fetcher(`/api/inventory/catalog-products?q=${encodeURIComponent(productSearch)}`),
    enabled: productSearch.trim().length >= 2,
  });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct) {
      setMessage("Cari lalu pilih model cincin terlebih dahulu.");
      return;
    }
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("source_product_id", String(selectedProduct.id));
      await mutator(editingUnit ? `/api/inventory/ready-stock/${editingUnit.id}` : "/api/inventory/ready-stock", {
        method: editingUnit ? "PATCH" : "POST",
        body: Object.fromEntries(formData),
      });
      event.currentTarget.reset();
      setProductSearch("");
      setSelectedProduct(null);
      setMessage(editingUnit ? "Unit ready-stock diperbarui." : "Unit ready-stock ditambahkan.");
      setEditingUnit(null);
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal menyimpan unit");
    }
  };

  const refreshCatalog = async () => {
    setIsRefreshingCatalog(true);
    try {
      await mutator("/api/inventory/catalog/refresh");
      setProductSearch("");
      setSelectedProduct(null);
      setMessage("Katalog diperbarui. Cari kode atau nama model untuk memilih model aktif.");
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Katalog tidak dapat diperbarui");
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  const startEdit = (unit: Unit) => {
    if (!unit.source_product_id || !unit.source_material_id) {
      setMessage("Unit lama tidak memiliki referensi katalog atau bahan yang dapat diedit.");
      return;
    }
    setEditingUnit(unit);
    setSelectedProduct({ id: unit.source_product_id, label: unit.product_label, cover_image_url: unit.cover_image_url });
    setProductSearch(unit.product_label);
    setMessage(`Mengubah unit ${unit.unit_code}. Unit yang sudah dialokasikan tidak dapat diubah.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const visibleModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return (data?.models ?? []).filter((model) => !query || `${model.label} ${model.material_description ?? ""} ${model.size ?? ""}`.toLowerCase().includes(query));
  }, [data?.models, modelSearch]);
  const modelPageSize = 12;
  const modelPageCount = Math.max(1, Math.ceil(visibleModels.length / modelPageSize));
  const modelRows = visibleModels.slice((modelPage - 1) * modelPageSize, modelPage * modelPageSize);

  const visibleUnits = useMemo(() => {
    const query = unitSearch.trim().toLowerCase();
    return (data?.units ?? []).filter((unit) =>
      (!query || `${unit.unit_code} ${unit.product_label} ${unit.material_label}`.toLowerCase().includes(query)) &&
      (!unitBrand || unit.brand_id === Number(unitBrand)) &&
      (!unitStatus || unit.status === unitStatus),
    );
  }, [data?.units, unitBrand, unitSearch, unitStatus]);
  const locationName = (locationId: string) => data?.locations.find((location) => location.id === locationId)?.name ?? "Gudang tidak tersedia";

  return (
    <div className="flex min-h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1">
        <Header userEmail="" role="management" />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <h1 className="text-2xl font-semibold text-ivory">Ready-stock</h1>
            <p className="mt-1 text-sm text-white/50">Catat setiap cincin jadi fisik. Bahan mentah per gram dicatat di Bahan Baku.</p>
          </div>

          {message && <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">{message}</p>}

          {error ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat ready-stock"}</p>
          ) : isLoading ? (
            <div className="h-56 animate-pulse rounded-lg bg-cocoa" />
          ) : (
            <>
              <section className="flex flex-col gap-4 rounded-lg border border-gold/15 bg-cocoa p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-cream">Katalog model</h2>
                  <p className="mt-1 text-sm text-white/50">Perbarui katalog agar pencarian model dan foto berasal dari katalog Yii2 terbaru.</p>
                </div>
                <button type="button" onClick={refreshCatalog} disabled={isRefreshingCatalog} className="rounded border border-gold/40 px-3 py-2 text-sm font-medium text-gold disabled:cursor-not-allowed disabled:opacity-60">
                  {isRefreshingCatalog ? "Memperbarui katalog..." : "Perbarui katalog"}
                </button>
              </section>

              <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa">
                <div className="flex flex-col gap-3 border-b border-gold/10 p-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-cream">Stok per model dan ukuran</h2>
                    <p className="mt-1 text-sm text-white/50">Ringkasan ini menghitung unit fisik. Satu model dengan ukuran berbeda ditampilkan pada baris terpisah.</p>
                  </div>
                  <label className="w-full text-sm text-cream sm:max-w-xs">Cari model atau ukuran<input value={modelSearch} onChange={(event) => { setModelSearch(event.target.value); setModelPage(1); }} className={inputClass} /></label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-white/45"><tr><th className="p-3">Model</th><th>Bahan</th><th>Ukuran</th><th>Tersedia</th><th>Dialokasikan</th><th>Pemeriksaan</th><th>Total</th></tr></thead>
                    <tbody>{modelRows.length ? modelRows.map((model) => <tr key={`${model.source_product_id}-${model.brand_id}-${model.source_material_id}-${model.size}-${model.material_description}`} className="border-t border-white/5 text-cream"><td className="p-3"><div className="flex items-center gap-2">{model.cover_image_url ? <><span className="sr-only">Foto model</span><img src={model.cover_image_url} alt="" className="h-9 w-9 rounded object-cover" /></> : <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded bg-carbon text-[10px] text-white/40">—</span>}<span>{model.label}</span></div></td><td>{model.material_description ?? "—"}</td><td>{model.size ?? "—"}</td><td>{model.available_units}</td><td>{model.allocated_units}</td><td>{model.inspection_units}</td><td className="font-medium">{model.total_units}</td></tr>) : <tr><td colSpan={7} className="p-6 text-center text-sm text-white/50">Belum ada unit ready-stock yang tercatat.</td></tr>}</tbody>
                  </table>
                </div>
                {modelPageCount > 1 && <div className="flex items-center justify-end gap-3 border-t border-gold/10 p-3 text-sm text-cream"><button type="button" disabled={modelPage === 1} onClick={() => setModelPage((page) => page - 1)} className="rounded border border-gold/30 px-3 py-1 disabled:opacity-40">Sebelumnya</button><span>{modelPage} / {modelPageCount}</span><button type="button" disabled={modelPage === modelPageCount} onClick={() => setModelPage((page) => page + 1)} className="rounded border border-gold/30 px-3 py-1 disabled:opacity-40">Berikutnya</button></div>}
              </section>

              <form key={editingUnit?.id ?? "new"} onSubmit={submit} className="grid gap-3 rounded-lg border border-gold/15 bg-cocoa p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="col-span-full flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-cream">{editingUnit ? `Ubah unit ${editingUnit.unit_code}` : "Tambah unit cincin"}</h2><p className="mt-1 text-sm text-white/50">Setiap unit adalah satu cincin fisik; gudang dapat diganti selama unit belum dialokasikan.</p></div>{editingUnit && <button type="button" onClick={() => { setEditingUnit(null); setSelectedProduct(null); setProductSearch(""); }} className="rounded border border-gold/30 px-3 py-2 text-sm text-cream">Batal ubah</button>}</div>
                <label className="text-sm text-cream">Kode unit fisik<input required name="unit_code" defaultValue={editingUnit?.unit_code} className={inputClass} /></label>
                <label className="text-sm text-cream">Brand<select required name="brand_id" defaultValue={editingUnit?.brand_id ?? ""} className={inputClass}><option value="" disabled>Pilih brand</option>{brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
                <label className="text-sm text-cream">1. Cari model<input value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setSelectedProduct(null); }} aria-describedby="model-search-help" placeholder="Contoh: S-02 atau Palladium" className={inputClass} /><span id="model-search-help" className="mt-1 block text-xs text-white/45">Ketik minimal 2 karakter kode atau nama model.</span></label>
                <label className="text-sm text-cream">2. Pilih model<select required value={selectedProduct?.id ?? ""} onChange={(event) => setSelectedProduct(catalogData?.products.find((product) => product.id === Number(event.target.value)) ?? null)} disabled={productSearch.trim().length < 2 || isProductSearching} className={inputClass}><option value="">{productSearch.trim().length < 2 ? "Ketik minimal 2 karakter pada kolom cari" : isProductSearching ? "Mencari model..." : catalogData?.products.length ? "Pilih model cincin" : "Model aktif tidak ditemukan"}</option>{catalogData?.products.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}</select>{productSearch.trim().length >= 2 && !isProductSearching && catalogData?.products.length === 0 && <span role="status" className="mt-1 block text-xs text-white/45">Model aktif tidak ditemukan. Coba kode atau nama lain.</span>}{selectedProduct?.cover_image_url && <><img src={selectedProduct.cover_image_url} alt={`Foto ${selectedProduct.label}`} className="mt-2 h-20 w-20 rounded object-cover" /></>}</label>
                <label className="text-sm text-cream">Bahan / kadar<select required name="source_material_id" defaultValue={editingUnit?.source_material_id ?? ""} className={inputClass}><option value="">Pilih bahan</option>{data?.materials.map((material) => <option key={material.source_material_id} value={material.source_material_id}>{material.code} — {material.name}</option>)}</select>{data?.materials.length === 0 && <span className="mt-1 block text-xs text-white/45">Tambahkan bahan pada Bahan Baku terlebih dahulu.</span>}</label>
                <label className="text-sm text-cream">Ukuran cincin<input required name="size" defaultValue={editingUnit?.size ?? ""} className={inputClass} /></label>
                <label className="text-sm text-cream">Keterangan bahan / kadar<input required name="material_description" defaultValue={editingUnit?.material_description ?? ""} className={inputClass} /></label>
                <label className="text-sm text-cream">Berat aktual (gram)<input required name="actual_weight_grams" type="number" min="0.001" step="0.001" defaultValue={editingUnit?.actual_weight_grams} className={inputClass} /></label>
                <label className="text-sm text-cream">Kondisi fisik<input required name="condition" defaultValue={editingUnit?.condition ?? "good"} placeholder="Contoh: baik" className={inputClass} /></label>
                <label className="text-sm text-cream">Gudang<select required name="location_id" defaultValue={editingUnit?.location_id ?? ""} className={inputClass}><option value="">Pilih gudang</option>{data?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                <div className="self-end"><button className="rounded bg-gold px-3 py-2 text-sm font-medium text-night">{editingUnit ? "Simpan perubahan" : "Simpan unit"}</button></div>
              </form>

              <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa">
                <div className="grid gap-3 border-b border-gold/10 p-4 sm:grid-cols-3"><label className="text-sm text-cream">Cari unit atau model<input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} className={inputClass} /></label><label className="text-sm text-cream">Brand<select value={unitBrand} onChange={(event) => setUnitBrand(event.target.value)} className={inputClass}><option value="">Semua brand</option>{brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label className="text-sm text-cream">Status<select value={unitStatus} onChange={(event) => setUnitStatus(event.target.value)} className={inputClass}><option value="">Semua status</option><option value="available">Tersedia</option><option value="allocated">Dialokasikan</option><option value="inspection">Dalam pemeriksaan</option><option value="retired">Dinonaktifkan</option></select></label></div>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-white/45"><tr><th className="p-3">Unit</th><th>Brand</th><th>Model</th><th>Gudang</th><th>Bahan</th><th>Ukuran</th><th>Berat</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{visibleUnits.length ? visibleUnits.map((unit) => <tr key={unit.id} className="border-t border-white/5 text-cream"><td className="p-3">{unit.unit_code}</td><td>{getBrandName(unit.brand_id)}</td><td><div className="flex items-center gap-2">{unit.cover_image_url && <><img src={unit.cover_image_url} alt="" className="h-9 w-9 rounded object-cover" /></>}<span>{unit.product_label}</span></div></td><td>{locationName(unit.location_id)}</td><td>{unit.material_label}</td><td>{unit.size ?? "—"}</td><td>{Number(unit.actual_weight_grams).toFixed(3)} g</td><td>{statusLabel(unit.status)}</td><td><div className="flex gap-2">{["available", "inspection"].includes(unit.status) ? <><button type="button" onClick={() => startEdit(unit)} className="text-gold underline underline-offset-4">Ubah</button><button type="button" onClick={() => setRetiringUnit(unit)} className="text-rose-200 underline underline-offset-4">Nonaktifkan</button></> : <span className="text-xs text-white/40">Terkunci oleh status</span>}</div></td></tr>) : <tr><td colSpan={9} className="p-6 text-center text-sm text-white/50">Tidak ada unit yang sesuai filter.</td></tr>}</tbody></table></div>
              </section>
            </>
          )}
        </main>
      </div>
      <ConfirmDialog isOpen={Boolean(retiringUnit)} title="Nonaktifkan unit ready-stock?" message={retiringUnit ? `Unit ${retiringUnit.unit_code} tidak akan dihapus. Riwayat mutasinya tetap tersimpan.` : ""} confirmText="Nonaktifkan" variant="warning" isLoading={isRetiring} onConfirm={retire} onCancel={() => setRetiringUnit(null)} />
    </div>
  );
}
