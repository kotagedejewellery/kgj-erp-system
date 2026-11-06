"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  size: string | null;
  actual_weight_grams: number | string;
  status: string;
  product_label: string;
  cover_image_url: string | null;
  material_label: string;
};

type ModelSummary = {
  source_product_id: number;
  label: string;
  cover_image_url: string | null;
  available_units: number;
  allocated_units: number;
  allocation_count: number;
};

type Data = {
  units: Unit[];
  locations: { id: string; name: string }[];
  materials: { code: string; name: string; source_material_id: number }[];
  models: ModelSummary[];
};

type CatalogProduct = { id: number; label: string; cover_image_url: string | null };

const brandOptions = Object.entries(BRANDS).map(([id, brand]) => ({ id, ...brand }));
const inputClass = "w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

function statusLabel(status: string) {
  return ({ available: "Tersedia", allocated: "Dialokasikan", inspection: "Dalam pemeriksaan" } as Record<string, string>)[status] ?? status;
}

export default function ReadyStockPage() {
  const [message, setMessage] = useState("");
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
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
      await mutator("/api/inventory/ready-stock", {
        body: Object.fromEntries(formData),
      });
      event.currentTarget.reset();
      setProductSearch("");
      setSelectedProduct(null);
      setMessage("Unit ready-stock ditambahkan.");
      refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menambah unit");
    }
  };

  const refreshCatalog = async () => {
    setIsRefreshingCatalog(true);
    try {
      const result = await mutator<{ categories: number; products: number }>("/api/inventory/catalog/refresh");
      setProductSearch("");
      setSelectedProduct(null);
      setMessage(`Katalog diperbarui: ${result.products} model dan ${result.categories} kategori tersedia.`);
      refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Katalog tidak dapat diperbarui");
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  const visibleUnits = useMemo(() => {
    const query = unitSearch.trim().toLowerCase();
    return (data?.units ?? []).filter((unit) =>
      (!query || `${unit.unit_code} ${unit.product_label} ${unit.material_label}`.toLowerCase().includes(query)) &&
      (!unitBrand || unit.brand_id === Number(unitBrand)) &&
      (!unitStatus || unit.status === unitStatus),
    );
  }, [data?.units, unitBrand, unitSearch, unitStatus]);

  return (
    <div className="flex h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <Header userEmail="" role="management" />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <h1 className="text-2xl font-semibold text-ivory">Ready-stock</h1>
            <p className="mt-1 text-sm text-white/50">
              Catat setiap cincin jadi fisik. Bahan mentah per gram dicatat di Bahan Baku.
            </p>
          </div>

          {message && (
            <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">
              {message}
            </p>
          )}

          {error ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error instanceof Error ? error.message : "Gagal memuat ready-stock"}
            </p>
          ) : isLoading ? (
            <div className="h-56 animate-pulse rounded-lg bg-cocoa" />
          ) : (
            <>
              <section className="flex flex-col gap-4 rounded-lg border border-gold/15 bg-cocoa p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-cream">Pilih model dari katalog</h2>
                  <p className="mt-1 text-sm text-white/50">Perbarui katalog agar pencarian model dan foto berasal dari katalog Yii2 terbaru.</p>
                </div>
                <button type="button" onClick={refreshCatalog} disabled={isRefreshingCatalog} className="rounded border border-gold/40 px-3 py-2 text-sm font-medium text-gold disabled:cursor-not-allowed disabled:opacity-60">
                  {isRefreshingCatalog ? "Memperbarui katalog..." : "Perbarui katalog"}
                </button>
              </section>

              {data?.models.length ? (
                <section aria-label="Ringkasan model ready-stock" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.models.map((model) => (
                    <article key={model.source_product_id} className="flex min-w-0 gap-3 rounded-lg border border-gold/15 bg-cocoa p-3">
                      {model.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={model.cover_image_url} alt={`Foto ${model.label}`} className="h-20 w-20 shrink-0 rounded object-cover" />
                      ) : <div aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-carbon text-xs text-white/35">Tanpa foto</div>}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-cream" title={model.label}>{model.label}</p>
                        <p className="mt-2 text-xs text-white/50">Tersedia: <span className="text-cream">{model.available_units}</span> · Dialokasikan: <span className="text-cream">{model.allocated_units}</span></p>
                        <p className="mt-1 text-xs text-white/50">Total dialokasikan: <span className="text-cream">{model.allocation_count}</span></p>
                      </div>
                    </article>
                  ))}
                </section>
              ) : (
                <p className="text-sm text-white/50">Belum ada cincin jadi yang tercatat. Setelah memilih model dari katalog, masukkan setiap cincin fisik satu per satu.</p>
              )}

              <form onSubmit={submit} className="grid gap-3 rounded-lg border border-gold/15 bg-cocoa p-4 sm:grid-cols-2 lg:grid-cols-3">
                <h2 className="col-span-full font-semibold text-cream">Tambah unit cincin</h2>
                <label className="text-sm text-cream">Kode unit fisik<input required name="unit_code" className={inputClass} /></label>
                <label className="text-sm text-cream">
                  Brand
                  <select required name="brand_id" defaultValue="" className={inputClass}>
                    <option value="" disabled>Pilih brand</option>
                    {brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                  </select>
                </label>
                <label className="text-sm text-cream">
                  Cari model cincin
                  <input
                    value={productSearch}
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      setSelectedProduct(null);
                    }}
                    placeholder="Ketik minimal 2 huruf kode atau nama model"
                    className={inputClass}
                  />
                </label>
                <label className="text-sm text-cream">
                  Model cincin
                  <select
                    required
                    value={selectedProduct?.id ?? ""}
                    onChange={(event) => setSelectedProduct(catalogData?.products.find((product) => product.id === Number(event.target.value)) ?? null)}
                    disabled={productSearch.trim().length < 2 || isProductSearching}
                    className={inputClass}
                  >
                    <option value="">{isProductSearching ? "Mencari model..." : "Pilih model cincin"}</option>
                    {catalogData?.products.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
                  </select>
                  {selectedProduct?.cover_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedProduct.cover_image_url} alt={`Foto ${selectedProduct.label}`} className="mt-2 h-24 w-24 rounded object-cover" />
                  )}
                </label>
                <label className="text-sm text-cream">
                  Bahan / kadar
                  <select required name="source_material_id" className={inputClass}>
                    <option value="">Pilih bahan</option>
                    {data?.materials.map((material) => <option key={material.source_material_id} value={material.source_material_id}>{material.code} — {material.name}</option>)}
                  </select>
                  {data?.materials.length === 0 && <span className="mt-1 block text-xs text-white/45">Tambahkan bahan pada Bahan Baku terlebih dahulu.</span>}
                </label>
                <label className="text-sm text-cream">Ukuran cincin<input required name="size" className={inputClass} /></label>
                <label className="text-sm text-cream">Keterangan bahan / kadar<input required name="material_description" className={inputClass} /></label>
                <label className="text-sm text-cream">Berat aktual (gram)<input required name="actual_weight_grams" type="number" min="0.001" step="0.001" className={inputClass} /></label>
                <label className="text-sm text-cream">
                  Gudang
                  <select required name="location_id" className={inputClass}>
                    <option value="">Pilih gudang</option>
                    {data?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                  </select>
                </label>
                <div className="self-end"><button className="rounded bg-gold px-3 py-2 text-sm font-medium text-night">Simpan unit</button></div>
              </form>

              <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa">
                <div className="grid gap-3 border-b border-gold/10 p-4 sm:grid-cols-3">
                  <label className="text-sm text-cream">Cari unit atau model<input value={unitSearch} onChange={(event) => setUnitSearch(event.target.value)} className="mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream" /></label>
                  <label className="text-sm text-cream">Brand<select value={unitBrand} onChange={(event) => setUnitBrand(event.target.value)} className="mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream"><option value="">Semua brand</option>{brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
                  <label className="text-sm text-cream">Status<select value={unitStatus} onChange={(event) => setUnitStatus(event.target.value)} className="mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream"><option value="">Semua status</option><option value="available">Tersedia</option><option value="allocated">Dialokasikan</option><option value="inspection">Dalam pemeriksaan</option></select></label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-white/45"><tr><th className="p-3">Unit</th><th>Brand</th><th>Model</th><th>Bahan</th><th>Ukuran</th><th>Berat</th><th>Status</th></tr></thead>
                    <tbody>{visibleUnits.length ? visibleUnits.map((unit) => <tr key={unit.id} className="border-t border-white/5 text-cream"><td className="p-3">{unit.unit_code}</td><td>{getBrandName(unit.brand_id)}</td><td><div className="flex items-center gap-2">{unit.cover_image_url && <><span className="sr-only">Foto model</span>{/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={unit.cover_image_url} alt="" className="h-9 w-9 rounded object-cover" />
                    </>}<span>{unit.product_label}</span></div></td><td>{unit.material_label}</td><td>{unit.size ?? "—"}</td><td>{Number(unit.actual_weight_grams).toFixed(3)} g</td><td>{statusLabel(unit.status)}</td></tr>) : <tr><td colSpan={7} className="p-6 text-center text-sm text-white/50">Tidak ada unit yang sesuai filter.</td></tr>}</tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
