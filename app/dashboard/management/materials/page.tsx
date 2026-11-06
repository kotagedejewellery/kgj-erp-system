"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";

type Material = {
  id: string;
  code: string;
  name: string;
  source_material_id: number | null;
  source_material_name: string | null;
  waste_percent: number | string;
  is_active: boolean;
};

type Location = {
  id: string;
  name: string;
  location_type: string;
  is_active: boolean;
};

type Balance = {
  material_id: string;
  location_id: string;
  quantity_grams: number | string;
};

type Data = {
  materials: Material[];
  locations: Location[];
  balances: Balance[];
  sourceMaterials: { id: number; name: string }[];
};

const inputClass = "w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

export default function MaterialsPage() {
  const [message, setMessage] = useState("");
  const { data, error, refetch, isLoading } = useQuery<Data>({
    queryKey: ["inventory-materials"],
    queryFn: () => fetcher("/api/inventory/materials"),
  });

  const submit = async (event: FormEvent<HTMLFormElement>, url: string) => {
    event.preventDefault();
    try {
      await mutator(url, { body: Object.fromEntries(new FormData(event.currentTarget)) });
      event.currentTarget.reset();
      setMessage("Data inventory disimpan.");
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal menyimpan data");
    }
  };

  const warehouses = data?.locations.filter(
    (location) => location.location_type === "warehouse" && location.is_active,
  ) ?? [];
  const balance = (materialId: string) => data?.balances
    .filter((item) => item.material_id === materialId && warehouses.some((location) => location.id === item.location_id))
    .reduce((sum, item) => sum + Number(item.quantity_grams), 0) ?? 0;
  const sourceStatus = (material: Material) => {
    if (material.source_material_id === null) return "Belum terhubung";
    if (material.source_material_name) return `Terhubung ke ${material.source_material_name}`;
    return "Referensi order tidak ditemukan";
  };

  return (
    <div className="flex h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <Header userEmail="" role="management" />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <h1 className="text-2xl font-semibold text-ivory">Bahan Baku</h1>
            <p className="mt-1 text-sm text-white/50">Kelola bahan fisik dalam gram. Halaman ini bukan nilai uang dan bukan daftar cincin jadi.</p>
          </div>

          {message && <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">{message}</p>}

          {error ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error instanceof Error ? error.message : "Gagal memuat material"}
            </p>
          ) : isLoading ? (
            <div className="h-56 animate-pulse rounded-lg bg-cocoa" />
          ) : (
            <>
              <section className="flex flex-col gap-3 rounded-lg border border-gold/15 bg-cocoa p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-cream">Daftarkan bahan, lalu catat berat fisik awalnya di gudang. Untuk cincin jadi beserta foto model, gunakan Ready-stock.</p>
                <Link href="/dashboard/management/ready-stock" className="shrink-0 text-sm font-medium text-gold underline underline-offset-4">Buka Ready-stock</Link>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <form onSubmit={(event) => submit(event, "/api/inventory/materials")} className="space-y-3 rounded-lg border border-gold/15 bg-cocoa p-4">
                  <h2 className="font-semibold text-cream">Daftarkan bahan</h2>
                  <p className="text-sm text-white/50">Lakukan sekali untuk setiap jenis bahan, misalnya Perak 925 atau Palladium.</p>
                  <label className="block text-sm text-cream">Kode internal<input required name="code" placeholder="Contoh: PRK-925" className={inputClass} /></label>
                  <label className="block text-sm text-cream">Nama bahan<input required name="name" placeholder="Contoh: Perak 925" className={inputClass} /></label>
                  <label className="block text-sm text-cream">
                    Bahan yang dipilih pada pesanan
                    <select name="source_material_id" defaultValue="" className={inputClass}>
                      <option value="">Tidak dihubungkan ke order</option>
                      {data?.sourceMaterials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
                    </select>
                    <span className="mt-1 block text-xs text-white/45">Pilih agar bahan custom dan ready-stock dapat dicocokkan otomatis dengan pesanan.</span>
                    {data?.sourceMaterials.length === 0 && <span className="mt-1 block text-xs text-amber-100">Belum ada bahan dari order aktif yang dapat dipilih.</span>}
                  </label>
                  <label className="block text-sm text-cream">Susut produksi (%)<input name="waste_percent" type="number" min="0" step="0.0001" defaultValue="0" className={inputClass} /><span className="mt-1 block text-xs text-white/45">Isi 0 jika belum ada ketentuan susut produksi.</span></label>
                  <button className="rounded bg-gold px-3 py-2 text-sm font-medium text-night">Simpan bahan</button>
                </form>

                <form onSubmit={(event) => submit(event, "/api/inventory/opening-balance")} className="space-y-3 rounded-lg border border-gold/15 bg-cocoa p-4">
                  <h2 className="font-semibold text-cream">Catat stok fisik awal</h2>
                  <p className="text-sm text-white/50">Setelah bahan tersimpan, catat hasil timbang fisik di gudang. Ini bukan nominal rupiah.</p>
                  <label className="block text-sm text-cream">Bahan baku<select required name="material_id" className={inputClass} disabled={!data?.materials.length}><option value="">Pilih bahan</option>{data?.materials.map((material) => <option key={material.id} value={material.id}>{material.code} — {material.name}</option>)}</select></label>
                  <label className="block text-sm text-cream">Gudang<select required name="location_id" className={inputClass}><option value="">Pilih gudang</option>{warehouses.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                  <label className="block text-sm text-cream">Berat fisik (gram)<input required name="quantity_grams" type="number" min="0.001" step="0.001" className={inputClass} /></label>
                  <label className="block text-sm text-cream">Catatan<input name="reason" placeholder="Contoh: Hasil timbang awal gudang" className={inputClass} /></label>
                  {data?.materials.length === 0 && <p className="text-sm text-amber-100">Simpan bahan terlebih dahulu sebelum mencatat stok fisik.</p>}
                  <button disabled={!data?.materials.length || !warehouses.length} className="rounded bg-gold px-3 py-2 text-sm font-medium text-night disabled:cursor-not-allowed disabled:opacity-60">Catat stok awal</button>
                </form>
              </div>

              <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-white/45"><tr><th className="p-3">Kode</th><th>Bahan baku</th><th>Hubungan pesanan</th><th>Susut</th><th>Stok gudang (gram)</th></tr></thead>
                    <tbody>{data?.materials.length ? data.materials.map((material) => <tr key={material.id} className="border-t border-white/5 text-cream"><td className="p-3">{material.code}</td><td>{material.name}</td><td>{sourceStatus(material)}</td><td>{material.waste_percent}%</td><td>{balance(material.id).toFixed(3)} g</td></tr>) : <tr><td colSpan={5} className="p-6 text-center text-sm text-white/50">Belum ada bahan baku. Mulai dengan mendaftarkan satu bahan di atas.</td></tr>}</tbody>
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
