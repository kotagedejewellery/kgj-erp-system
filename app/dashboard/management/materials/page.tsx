"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";

type Material = { id: string; code: string; name: string; source_material_id: number | null; source_material_name: string | null; waste_percent: number | string; is_active: boolean };
type Location = { id: string; name: string; location_type: string; is_active: boolean };
type Balance = { material_id: string; location_id: string; quantity_grams: number | string };
type Data = { materials: Material[]; locations: Location[]; balances: Balance[]; sourceMaterials: { id: number; name: string }[] };

const inputClass = "mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

export default function MaterialsPage() {
  const [message, setMessage] = useState("");
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [retiringMaterial, setRetiringMaterial] = useState<Material | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);
  const { data, error, refetch, isLoading } = useQuery<Data>({ queryKey: ["inventory-materials"], queryFn: () => fetcher("/api/inventory/materials") });

  const submit = async (event: FormEvent<HTMLFormElement>, url: string, method: "POST" | "PATCH" = "POST") => {
    event.preventDefault();
    try {
      await mutator(url, { method, body: Object.fromEntries(new FormData(event.currentTarget)) });
      event.currentTarget.reset();
      setEditingMaterial(null);
      setMessage("Data inventory disimpan.");
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal menyimpan data");
    }
  };

  const retire = async () => {
    if (!retiringMaterial) return;
    setIsRetiring(true);
    try {
      await mutator(`/api/inventory/materials/${retiringMaterial.id}`, { method: "DELETE" });
      setMessage(`Material ${retiringMaterial.name} dinonaktifkan. Riwayatnya tidak dihapus.`);
      setRetiringMaterial(null);
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal menonaktifkan material");
    } finally {
      setIsRetiring(false);
    }
  };

  const warehouses = data?.locations.filter((location) => location.location_type === "warehouse" && location.is_active) ?? [];
  const activeMaterials = data?.materials.filter((material) => material.is_active) ?? [];
  const balance = (materialId: string) => data?.balances.filter((item) => item.material_id === materialId && warehouses.some((location) => location.id === item.location_id)).reduce((sum, item) => sum + Number(item.quantity_grams), 0) ?? 0;
  const sourceStatus = (material: Material) => material.source_material_id === null ? "Belum terhubung" : material.source_material_name ? `Terhubung ke ${material.source_material_name}` : "Referensi order tidak ditemukan";

  return (
    <div className="flex min-h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1">
        <Header userEmail="" role="management" />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <h1 className="text-2xl font-semibold text-ivory">Bahan Baku</h1>
            <p className="mt-1 text-sm text-white/50">Kelola bahan fisik dalam gram. Halaman ini bukan nilai uang dan bukan daftar cincin jadi.</p>
          </div>
          {message && <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">{message}</p>}
          {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat material"}</p> : isLoading ? <div className="h-56 animate-pulse rounded-lg bg-cocoa" /> : <>
            <section className="flex flex-col gap-3 rounded-lg border border-gold/15 bg-cocoa p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-cream">Daftarkan bahan, lalu catat berat fisik awalnya di gudang. Untuk cincin jadi beserta foto model, gunakan Ready-stock.</p><div className="flex gap-4"><Link href="/dashboard/management/locations" className="shrink-0 text-sm font-medium text-gold underline underline-offset-4">Kelola gudang</Link><Link href="/dashboard/management/ready-stock" className="shrink-0 text-sm font-medium text-gold underline underline-offset-4">Buka Ready-stock</Link></div></section>
            <div className="grid gap-4 lg:grid-cols-2">
              <form key={editingMaterial?.id ?? "new"} onSubmit={(event) => submit(event, editingMaterial ? `/api/inventory/materials/${editingMaterial.id}` : "/api/inventory/materials", editingMaterial ? "PATCH" : "POST")} className="space-y-3 rounded-lg border border-gold/15 bg-cocoa p-4">
                <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-cream">{editingMaterial ? `Ubah ${editingMaterial.name}` : "Daftarkan bahan"}</h2><p className="mt-1 text-sm text-white/50">Lakukan sekali untuk setiap jenis bahan, misalnya Perak 925 atau Palladium.</p></div>{editingMaterial && <button type="button" onClick={() => setEditingMaterial(null)} className="text-sm text-gold underline underline-offset-4">Batal ubah</button>}</div>
                <label className="block text-sm text-cream">Kode internal<input required name="code" defaultValue={editingMaterial?.code} placeholder="Contoh: PRK-925" className={inputClass} /></label>
                <label className="block text-sm text-cream">Nama bahan<input required name="name" defaultValue={editingMaterial?.name} placeholder="Contoh: Perak 925" className={inputClass} /></label>
                <label className="block text-sm text-cream">Bahan yang dipilih pada pesanan<select name="source_material_id" defaultValue={editingMaterial?.source_material_id ?? ""} className={inputClass}><option value="">Tidak dihubungkan ke order</option>{data?.sourceMaterials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select><span className="mt-1 block text-xs text-white/45">Pilih agar bahan custom dan ready-stock dapat dicocokkan otomatis dengan pesanan.</span>{data?.sourceMaterials.length === 0 && <span className="mt-1 block text-xs text-amber-100">Belum ada bahan dari order aktif yang dapat dipilih.</span>}</label>
                <label className="block text-sm text-cream">Susut produksi (%)<input name="waste_percent" type="number" min="0" step="0.0001" defaultValue={editingMaterial?.waste_percent ?? "0"} className={inputClass} /><span className="mt-1 block text-xs text-white/45">Isi 0 jika belum ada ketentuan susut produksi.</span></label>
                <button className="rounded bg-gold px-3 py-2 text-sm font-medium text-night">{editingMaterial ? "Simpan perubahan" : "Simpan bahan"}</button>
              </form>
              <form onSubmit={(event) => submit(event, "/api/inventory/opening-balance")} className="space-y-3 rounded-lg border border-gold/15 bg-cocoa p-4"><h2 className="font-semibold text-cream">Catat stok fisik awal</h2><p className="text-sm text-white/50">Setelah bahan tersimpan, catat hasil timbang fisik di gudang. Ini bukan nominal rupiah.</p><label className="block text-sm text-cream">Bahan baku<select required name="material_id" className={inputClass} disabled={!activeMaterials.length}><option value="">Pilih bahan</option>{activeMaterials.map((material) => <option key={material.id} value={material.id}>{material.code} — {material.name}</option>)}</select></label><label className="block text-sm text-cream">Gudang<select required name="location_id" className={inputClass}><option value="">Pilih gudang</option>{warehouses.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="block text-sm text-cream">Berat fisik (gram)<input required name="quantity_grams" type="number" min="0.001" step="0.001" className={inputClass} /></label><label className="block text-sm text-cream">Catatan<input name="reason" placeholder="Contoh: Hasil timbang awal gudang" className={inputClass} /></label>{activeMaterials.length === 0 && <p className="text-sm text-amber-100">Simpan bahan terlebih dahulu sebelum mencatat stok fisik.</p>}<button disabled={!activeMaterials.length || !warehouses.length} className="rounded bg-gold px-3 py-2 text-sm font-medium text-night disabled:cursor-not-allowed disabled:opacity-60">Catat stok awal</button></form>
            </div>
            <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-white/45"><tr><th className="p-3">Kode</th><th>Bahan baku</th><th>Hubungan pesanan</th><th>Susut</th><th>Stok gudang</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{data?.materials.length ? data.materials.map((material) => <tr key={material.id} className="border-t border-white/5 text-cream"><td className="p-3">{material.code}</td><td>{material.name}</td><td>{sourceStatus(material)}</td><td>{material.waste_percent}%</td><td>{balance(material.id).toFixed(3)} g</td><td>{material.is_active ? "Aktif" : "Dinonaktifkan"}</td><td><div className="flex gap-2">{material.is_active ? <><button type="button" onClick={() => { setEditingMaterial(material); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-gold underline underline-offset-4">Ubah</button><button type="button" onClick={() => setRetiringMaterial(material)} className="text-rose-200 underline underline-offset-4">Nonaktifkan</button></> : <span className="text-xs text-white/40">Riwayat tersimpan</span>}</div></td></tr>) : <tr><td colSpan={7} className="p-6 text-center text-sm text-white/50">Belum ada bahan baku. Mulai dengan mendaftarkan satu bahan di atas.</td></tr>}</tbody></table></div></section>
          </>}
        </main>
      </div>
      <ConfirmDialog isOpen={Boolean(retiringMaterial)} title="Nonaktifkan material?" message={retiringMaterial ? `Material ${retiringMaterial.name} tidak dihapus. Aksi hanya tersedia bila stok dan unit aktifnya kosong.` : ""} confirmText="Nonaktifkan" variant="warning" isLoading={isRetiring} onConfirm={retire} onCancel={() => setRetiringMaterial(null)} />
    </div>
  );
}
