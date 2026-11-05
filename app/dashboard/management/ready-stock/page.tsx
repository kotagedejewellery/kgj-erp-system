"use client";

import { FormEvent, useState } from "react";
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
  material_label: string;
};

type Data = {
  units: Unit[];
  locations: { id: string; name: string }[];
  materials: { code: string; name: string; source_material_id: number }[];
};

type CatalogProduct = { id: number; label: string };

const brandOptions = Object.entries(BRANDS).map(([id, brand]) => ({ id, ...brand }));
const inputClass = "w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

export default function ReadyStockPage() {
  const [message, setMessage] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
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

  return (
    <div className="flex h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <Header userEmail="" role="management" />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <h1 className="text-2xl font-semibold text-ivory">Ready-stock</h1>
            <p className="mt-1 text-sm text-white/50">
              Daftarkan setiap cincin jadi fisik yang tersedia untuk dialokasikan.
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
                </label>
                <label className="text-sm text-cream">
                  Bahan / kadar
                  <select required name="source_material_id" className={inputClass}>
                    <option value="">Pilih bahan</option>
                    {data?.materials.map((material) => <option key={material.source_material_id} value={material.source_material_id}>{material.code} — {material.name}</option>)}
                  </select>
                  {data?.materials.length === 0 && <span className="mt-1 block text-xs text-white/45">Tambahkan bahan pada Material & Saldo terlebih dahulu.</span>}
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-white/45"><tr><th className="p-3">Unit</th><th>Brand</th><th>Produk</th><th>Bahan</th><th>Ukuran</th><th>Berat</th><th>Status</th></tr></thead>
                    <tbody>{data?.units.map((unit) => <tr key={unit.id} className="border-t border-white/5 text-cream"><td className="p-3">{unit.unit_code}</td><td>{getBrandName(unit.brand_id)}</td><td>{unit.product_label}</td><td>{unit.material_label}</td><td>{unit.size ?? "—"}</td><td>{Number(unit.actual_weight_grams).toFixed(3)} g</td><td>{unit.status}</td></tr>)}</tbody>
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
