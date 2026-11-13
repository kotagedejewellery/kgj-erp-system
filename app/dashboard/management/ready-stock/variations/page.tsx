"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";
import { getReadyStockConditionOptions } from "@/lib/inventory/ready-stock-condition";
import { getReadyStockGenderOptions } from "@/lib/inventory/ready-stock-gender";
import type { ReadyStockModelSummary } from "@/lib/inventory/ready-stock-summary";
import { BRANDS } from "@/lib/legacy/brands";
import { MANAGEMENT_ROUTES } from "@/lib/routes";

type CatalogProduct = { id: number; label: string; cover_image_url: string | null };
type VariationRow = { id: number; size: string; quantity: string };
type Data = {
  locations: { id: string; name: string }[];
  materials: { code: string; name: string; source_material_id: number; requires_unit_weight: boolean }[];
  models: ReadyStockModelSummary[];
};

const brandOptions = Object.entries(BRANDS).map(([id, brand]) => ({ id, ...brand }));
const inputClass = "mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

export default function ReadyStockVariationsPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [brandId, setBrandId] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | "">("");
  const [locationId, setLocationId] = useState("");
  const [condition, setCondition] = useState("good");
  const [ringGender, setRingGender] = useState("");
  const [variations, setVariations] = useState<VariationRow[]>([{ id: 1, size: "", quantity: "" }]);
  const [nextVariationId, setNextVariationId] = useState(2);
  const [removingVariation, setRemovingVariation] = useState<ReadyStockModelSummary | null>(null);
  const [removalQuantity, setRemovalQuantity] = useState("1");
  const [removalReason, setRemovalReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { data, error, isLoading, refetch } = useQuery<Data>({ queryKey: ["ready-stock"], queryFn: () => fetcher("/api/inventory/ready-stock") });
  const { data: catalogData, isFetching: isProductSearching } = useQuery<{ products: CatalogProduct[] }>({
    queryKey: ["inventory-catalog-products", productSearch],
    queryFn: () => fetcher(`/api/inventory/catalog-products?q=${encodeURIComponent(productSearch)}`),
    enabled: productSearch.trim().length >= 2,
  });
  const selectedMaterial = data?.materials.find((material) => material.source_material_id === selectedMaterialId);
  const quantityMaterials = data?.materials.filter((material) => !material.requires_unit_weight) ?? [];
  const catalogProducts = selectedProduct && !catalogData?.products.some((product) => product.id === selectedProduct.id)
    ? [selectedProduct, ...(catalogData?.products ?? [])]
    : (catalogData?.products ?? []);
  const existingVariations = useMemo(() => (data?.models ?? []).filter((model) =>
    model.source_product_id === selectedProduct?.id
    && model.brand_id === Number(brandId)
    && model.source_material_id === selectedMaterialId
    && model.location_id === locationId
    && model.condition === condition
    && model.ring_gender === ringGender,
  ).sort((left, right) => (left.size ?? "").localeCompare(right.size ?? "", "id")), [brandId, condition, data?.models, locationId, ringGender, selectedMaterialId, selectedProduct?.id]);

  const updateVariation = (id: number, field: "size" | "quantity", value: string) => {
    setVariations((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
  };

  const addVariation = (size = "") => {
    setVariations((rows) => rows.some((row) => row.size === size) ? rows : [...rows, { id: nextVariationId, size, quantity: "" }]);
    setNextVariationId((id) => id + 1);
  };

  const removeVariation = (id: number) => {
    setVariations((rows) => rows.length === 1 ? rows : rows.filter((row) => row.id !== id));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct || !selectedMaterialId || selectedMaterial?.requires_unit_weight || !brandId || !locationId) {
      setMessage("Pilih model, brand, bahan, dan gudang terlebih dahulu.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setIsSaving(true);
    try {
      const result = await mutator<{ data: { changed: number } }>("/api/inventory/ready-stock/variations", {
        method: "POST",
        body: {
          brand_id: Number(brandId),
          source_product_id: selectedProduct.id,
          source_material_id: selectedMaterialId,
          location_id: locationId,
          condition,
          ring_gender: ringGender,
          reason: form.get("reason"),
          variations: variations.map(({ size, quantity }) => ({ size, quantity })),
        },
      });
      router.push(`${MANAGEMENT_ROUTES.READY_STOCK}?added=${result.data.changed}`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal mencatat stok per ukuran");
    } finally {
      setIsSaving(false);
    }
  };

  const removeStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!removingVariation || removingVariation.source_material_id === null || removingVariation.location_id === null) return;
    setIsSaving(true);
    try {
      await mutator("/api/inventory/ready-stock/quantity", {
        method: "POST",
        body: {
          brand_id: removingVariation.brand_id,
          source_product_id: removingVariation.source_product_id,
          source_material_id: removingVariation.source_material_id,
          location_id: removingVariation.location_id,
          size: removingVariation.size,
          condition: removingVariation.condition,
          ring_gender: removingVariation.ring_gender,
          quantity_change: -Number(removalQuantity),
          reason: removalReason,
        },
      });
      setMessage("Pengurangan stok berhasil dicatat.");
      setRemovingVariation(null);
      setRemovalQuantity("1");
      setRemovalReason("");
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal mengurangi stok");
    } finally {
      setIsSaving(false);
    }
  };

  const canManageVariations = Boolean(selectedProduct && brandId && selectedMaterialId && locationId && ringGender && !selectedMaterial?.requires_unit_weight);

  return (
    <div className="inventory-management flex min-h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1">
        <Header userEmail="" role="management" />
        <main className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><h1 className="text-2xl font-semibold text-ivory">Kelola stok per ukuran</h1><p className="mt-1 text-sm text-white/50">Untuk bahan tanpa timbang per cincin, seperti Perak. Tambah variasi baru atau kurangi stok tersedia tanpa mengubah unit yang sudah dialokasikan.</p></div>
            <Link href={MANAGEMENT_ROUTES.READY_STOCK} className="shrink-0 text-sm font-medium text-gold underline underline-offset-4">Kembali ke Ready-stock</Link>
          </div>
          {message && <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">{message}</p>}
          {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat data form."}</p> : isLoading ? <div className="h-80 animate-pulse rounded-lg bg-cocoa" /> : <>
            <form onSubmit={submit} className="space-y-6 rounded-lg border border-gold/15 bg-cocoa p-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="text-sm text-cream">Brand<select required value={brandId} onChange={(event) => setBrandId(event.target.value)} className={inputClass}><option value="" disabled>Pilih brand</option>{brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
                <label className="text-sm text-cream">Bahan / kadar<select required value={selectedMaterialId} onChange={(event) => setSelectedMaterialId(event.target.value ? Number(event.target.value) : "")} className={inputClass}><option value="">Pilih bahan</option>{quantityMaterials.map((material) => <option key={material.source_material_id} value={material.source_material_id}>{material.code} — {material.name}</option>)}</select><span className="mt-1 block text-xs text-white/45">Bahan wajib timbang dicatat melalui Tambah unit timbang.</span></label>
                <label className="text-sm text-cream">Cari model<input value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setSelectedProduct(null); }} placeholder="Contoh: S-02 atau Palladium" className={inputClass} /><span className="mt-1 block text-xs text-white/45">Ketik minimal 2 karakter kode atau nama model.</span></label>
                <label className="text-sm text-cream">Pilih model<select required value={selectedProduct?.id ?? ""} onChange={(event) => setSelectedProduct(catalogProducts.find((product) => product.id === Number(event.target.value)) ?? null)} disabled={productSearch.trim().length < 2 || isProductSearching} className={inputClass}><option value="">{productSearch.trim().length < 2 ? "Ketik minimal 2 karakter pada kolom cari" : isProductSearching ? "Mencari model..." : catalogProducts.length ? "Pilih model cincin" : "Model aktif tidak ditemukan"}</option>{catalogProducts.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}</select>{selectedProduct?.cover_image_url && <img src={selectedProduct.cover_image_url} alt={`Foto ${selectedProduct.label}`} className="mt-2 h-24 w-24 rounded object-cover" />}</label>
                <label className="text-sm text-cream">Gudang<select required value={locationId} onChange={(event) => setLocationId(event.target.value)} className={inputClass}><option value="">Pilih gudang</option>{data?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                <label className="text-sm text-cream">Kondisi fisik<select required value={condition} onChange={(event) => setCondition(event.target.value)} className={inputClass}>{getReadyStockConditionOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="mt-1 block text-xs text-white/45">Pilih kondisi standar agar stok yang sama tidak terpecah pada laporan.</span></label>
                <label className="text-sm text-cream">Untuk siapa cincin ini?<select required value={ringGender} onChange={(event) => setRingGender(event.target.value)} className={inputClass}><option value="" disabled>Pilih Pria, Wanita, atau Unisex</option>{getReadyStockGenderOptions().map((gender) => <option key={gender.value} value={gender.value}>{gender.label}</option>)}</select><span className="mt-1 block text-xs text-white/45">Tambahkan setiap jenis cincin sebagai stok terpisah.</span></label>
              </div>

              {canManageVariations && <section className="overflow-hidden rounded-lg border border-gold/15 bg-carbon">
                <div className="border-b border-gold/10 px-4 py-3"><h2 className="font-semibold text-cream">Stok yang sudah tercatat</h2><p className="mt-1 text-sm text-white/50">Hanya stok tersedia yang dapat dikurangi. Stok dialokasikan dan pemeriksaan tetap tercatat.</p></div>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-white/45"><tr><th className="p-3">Ukuran</th><th className="p-3">Tersedia</th><th className="p-3">Dialokasikan</th><th className="p-3">Pemeriksaan</th><th className="p-3">Aksi</th></tr></thead><tbody>{existingVariations.length ? existingVariations.map((variation) => <tr key={`${variation.size}-${variation.condition}`} className="border-t border-white/5 text-cream"><td className="p-3">{variation.size}</td><td className="p-3 tabular-nums">{variation.available_units}</td><td className="p-3 tabular-nums">{variation.allocated_units}</td><td className="p-3 tabular-nums">{variation.inspection_units}</td><td className="p-3"><div className="flex gap-3"><button type="button" onClick={() => addVariation(variation.size ?? "")} className="text-gold underline underline-offset-4">Tambah</button><button type="button" disabled={variation.available_units === 0} onClick={() => { setRemovingVariation(variation); setRemovalQuantity("1"); setRemovalReason(""); }} className="text-rose-200 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40">Kurangi</button></div></td></tr>) : <tr><td colSpan={5} className="p-5 text-center text-sm text-white/50">Belum ada stok untuk pilihan ini. Tambahkan variasi pertama di bawah.</td></tr>}</tbody></table></div>
              </section>}

              <section className="overflow-hidden rounded-lg border border-gold/15 bg-carbon">
                <div className="border-b border-gold/10 px-4 py-3"><h2 className="font-semibold text-cream">Tambah variasi ukuran</h2><p className="mt-1 text-sm text-white/50">Masukkan jumlah stok untuk setiap ukuran baru atau tambahan stok ukuran yang sama.</p></div>
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-white/45"><tr><th className="p-3">Ukuran cincin</th><th className="p-3">Jumlah stok</th><th className="w-20 p-3"><span className="sr-only">Aksi</span></th></tr></thead><tbody>{variations.map((variation) => <tr key={variation.id} className="border-t border-white/5"><td className="p-3"><input required value={variation.size} onChange={(event) => updateVariation(variation.id, "size", event.target.value)} placeholder="Contoh: 16" className={inputClass.replace("mt-1 ", "")} /></td><td className="p-3"><input required inputMode="numeric" min="1" max="1000" value={variation.quantity} onChange={(event) => updateVariation(variation.id, "quantity", event.target.value)} placeholder="Contoh: 3" className={inputClass.replace("mt-1 ", "")} /></td><td className="p-3">{variations.length > 1 && <button type="button" onClick={() => removeVariation(variation.id)} aria-label={`Hapus variasi ukuran ${variation.size || "baru"}`} className="rounded p-2 text-rose-200 hover:bg-rose-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"><Trash2 className="h-4 w-4" /></button>}</td></tr>)}</tbody></table></div>
                <button type="button" onClick={() => addVariation()} className="m-3 inline-flex items-center gap-2 text-sm font-medium text-gold underline underline-offset-4"><Plus className="h-4 w-4" />Tambah variasi ukuran</button>
              </section>
              <label className="block text-sm text-cream">Alasan penambahan<input required name="reason" placeholder="Contoh: tambahan stok hasil opname" className={inputClass} /></label>
              <div className="flex items-center gap-3"><button disabled={isSaving || !canManageVariations} className="rounded bg-gold px-3 py-2 text-sm font-medium text-night disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Menyimpan..." : "Simpan penambahan"}</button><Link href={MANAGEMENT_ROUTES.READY_STOCK} className="text-sm text-gold underline underline-offset-4">Batal</Link></div>
            </form>

            {removingVariation && <section className="rounded-lg border border-rose-400/25 bg-cocoa p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold text-cream">Kurangi stok ukuran {removingVariation.size}</h2><p className="mt-1 text-sm text-white/50">Tersedia {removingVariation.available_units} unit. Pengurangan tidak dapat memakai unit yang sudah dialokasikan.</p></div><button type="button" onClick={() => setRemovingVariation(null)} className="self-start text-sm text-gold underline underline-offset-4">Batal</button></div><form onSubmit={removeStock} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto] sm:items-end"><label className="text-sm text-cream">Jumlah<input required inputMode="numeric" min="1" max={removingVariation.available_units} value={removalQuantity} onChange={(event) => setRemovalQuantity(event.target.value)} className={inputClass} /></label><label className="text-sm text-cream">Alasan<input required value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} placeholder="Contoh: selisih hasil opname" className={inputClass} /></label><button disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded bg-rose-200 px-4 py-2 text-sm font-medium text-night disabled:cursor-not-allowed disabled:opacity-60"><Minus className="h-4 w-4" />{isSaving ? "Menyimpan..." : "Kurangi stok"}</button></form></section>}
          </>}
        </main>
      </div>
    </div>
  );
}
