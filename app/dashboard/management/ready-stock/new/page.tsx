"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";
import { BRANDS } from "@/lib/legacy/brands";
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
  actual_weight_grams: number | string | null;
  condition: string;
  status: string;
  product_label: string;
  cover_image_url: string | null;
};

type Data = {
  units: Unit[];
  locations: { id: string; name: string }[];
  materials: { code: string; name: string; source_material_id: number; requires_unit_weight: boolean }[];
};

type CatalogProduct = { id: number; label: string; cover_image_url: string | null };

const brandOptions = Object.entries(BRANDS).map(([id, brand]) => ({ id, ...brand }));
const inputClass = "mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

export default function ReadyStockUnitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unitId = searchParams.get("unit");
  const [message, setMessage] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | "">("");
  const { data, error, isLoading } = useQuery<Data>({ queryKey: ["ready-stock"], queryFn: () => fetcher("/api/inventory/ready-stock") });
  const editingUnit = unitId ? data?.units.find((unit) => unit.id === unitId) ?? null : null;
  const editingProductId = editingUnit?.source_product_id ?? null;

  useEffect(() => {
    if (!editingUnit || !editingProductId) return;
    setProductSearch(editingUnit.product_label);
    setSelectedProduct({ id: editingProductId, label: editingUnit.product_label, cover_image_url: editingUnit.cover_image_url });
  }, [editingProductId, editingUnit]);

  useEffect(() => {
    setSelectedMaterialId(editingUnit?.source_material_id ?? "");
  }, [editingUnit?.source_material_id]);

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
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("source_product_id", String(selectedProduct.id));
    try {
      await mutator(editingUnit ? `/api/inventory/ready-stock/${editingUnit.id}` : "/api/inventory/ready-stock", {
        method: editingUnit ? "PATCH" : "POST",
        body: Object.fromEntries(formData),
      });
      form.reset();
      router.push(MANAGEMENT_ROUTES.READY_STOCK);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal menyimpan unit");
    }
  };

  const isLegacyUnit = Boolean(editingUnit && (!editingUnit.source_product_id || !editingUnit.source_material_id));
  const cannotEdit = Boolean(editingUnit && !["available", "inspection"].includes(editingUnit.status));
  const missingEditUnit = Boolean(unitId && !isLoading && !editingUnit);
  const selectedMaterial = data?.materials.find((material) => material.source_material_id === selectedMaterialId);
  const weightIsRequired = selectedMaterial?.requires_unit_weight ?? true;

  return (
    <div className="inventory-management flex min-h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1">
        <Header userEmail="" role="management" />
        <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold text-ivory">{editingUnit ? `Ubah unit ${editingUnit.unit_code}` : "Tambah unit cincin"}</h1><p className="mt-1 text-sm text-white/50">Setiap unit adalah satu cincin fisik. Pilih model katalog, lalu catat spesifikasi dan lokasi fisiknya.</p></div><Link href={MANAGEMENT_ROUTES.READY_STOCK} className="shrink-0 text-sm font-medium text-gold underline underline-offset-4">Kembali ke Ready-stock</Link></div>
          {message && <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">{message}</p>}
          {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat data form."}</p> : isLoading ? <div className="h-80 animate-pulse rounded-lg bg-cocoa" /> : missingEditUnit ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">Unit yang ingin diubah tidak ditemukan.</p> : isLegacyUnit ? <p className="rounded-lg border border-gold/20 bg-cocoa p-4 text-sm text-cream">Unit lama ini belum memiliki referensi model katalog atau bahan yang lengkap, sehingga tidak dapat diubah dari halaman ini.</p> : cannotEdit ? <p className="rounded-lg border border-gold/20 bg-cocoa p-4 text-sm text-cream">Unit ini sudah dialokasikan dan tidak dapat diubah.</p> : <form key={editingUnit?.id ?? "new"} onSubmit={submit} className="grid gap-4 rounded-lg border border-gold/15 bg-cocoa p-4 sm:grid-cols-2"><div className="sm:col-span-2"><h2 className="font-semibold text-cream">Model dan spesifikasi unit</h2><p className="mt-1 text-sm text-white/50">Foto berasal dari katalog Yii2; stok fisik tetap dicatat dan dikelola di Main-ERP.</p></div><label className="text-sm text-cream">Kode unit fisik<input required name="unit_code" defaultValue={editingUnit?.unit_code} placeholder="Contoh: SMG-001-A" className={inputClass} /></label><label className="text-sm text-cream">Brand<select required name="brand_id" defaultValue={editingUnit?.brand_id ?? ""} className={inputClass}><option value="" disabled>Pilih brand</option>{brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><label className="text-sm text-cream">Cari model<input value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setSelectedProduct(null); }} aria-describedby="model-search-help" placeholder="Contoh: S-02 atau Palladium" className={inputClass} /><span id="model-search-help" className="mt-1 block text-xs text-white/45">Ketik minimal 2 karakter kode atau nama model.</span></label><label className="text-sm text-cream">Pilih model<select required value={selectedProduct?.id ?? ""} onChange={(event) => setSelectedProduct(catalogData?.products.find((product) => product.id === Number(event.target.value)) ?? null)} disabled={productSearch.trim().length < 2 || isProductSearching} className={inputClass}><option value="">{productSearch.trim().length < 2 ? "Ketik minimal 2 karakter pada kolom cari" : isProductSearching ? "Mencari model..." : catalogData?.products.length ? "Pilih model cincin" : "Model aktif tidak ditemukan"}</option>{catalogData?.products.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}</select>{selectedProduct?.cover_image_url && <img src={selectedProduct.cover_image_url} alt={`Foto ${selectedProduct.label}`} className="mt-2 h-24 w-24 rounded object-cover" />}</label><label className="text-sm text-cream">Bahan / kadar<select required name="source_material_id" value={selectedMaterialId} onChange={(event) => setSelectedMaterialId(event.target.value ? Number(event.target.value) : "")} className={inputClass}><option value="">Pilih bahan</option>{data?.materials.map((material) => <option key={material.source_material_id} value={material.source_material_id}>{material.code} â€” {material.name}</option>)}</select>{data?.materials.length === 0 && <span className="mt-1 block text-xs text-white/45">Tambahkan bahan pada Bahan Baku terlebih dahulu.</span>}</label><label className="text-sm text-cream">Ukuran cincin<input required name="size" defaultValue={editingUnit?.size ?? ""} className={inputClass} /></label><label className="text-sm text-cream">Keterangan bahan / kadar<input required name="material_description" defaultValue={editingUnit?.material_description ?? ""} className={inputClass} /></label><label className="text-sm text-cream">Berat aktual (gram){!weightIsRequired && <span className="ml-1 text-xs text-white/45">(tidak wajib untuk bahan ini)</span>}<input required={weightIsRequired} name="actual_weight_grams" type="number" min="0.001" step="0.001" defaultValue={editingUnit?.actual_weight_grams ?? ""} className={inputClass} />{!weightIsRequired && <span className="mt-1 block text-xs text-white/45">Biarkan kosong bila cincin tidak ditimbang per unit.</span>}</label><label className="text-sm text-cream">Kondisi fisik<input required name="condition" defaultValue={editingUnit?.condition ?? "good"} placeholder="Contoh: baik" className={inputClass} /></label><label className="text-sm text-cream">Gudang<select required name="location_id" defaultValue={editingUnit?.location_id ?? ""} className={inputClass}><option value="">Pilih gudang</option>{data?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><div className="flex items-end gap-3"><button className="rounded bg-gold px-3 py-2 text-sm font-medium text-night">{editingUnit ? "Simpan perubahan" : "Simpan unit"}</button><Link href={MANAGEMENT_ROUTES.READY_STOCK} className="text-sm text-gold underline underline-offset-4">Batal</Link></div></form>}
        </main>
      </div>
    </div>
  );
}
