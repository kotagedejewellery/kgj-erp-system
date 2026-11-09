"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";

type Location = { id: string; code: string; name: string; location_type: "warehouse" | "wip"; is_default: boolean; is_active: boolean; balance_grams: number; stock_unit_count: number };
const inputClass = "mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";

export default function LocationsPage() {
  const [message, setMessage] = useState("");
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [retiringLocation, setRetiringLocation] = useState<Location | null>(null);
  const [isRetiring, setIsRetiring] = useState(false);
  const { data, error, isLoading, refetch } = useQuery<{ locations: Location[] }>({ queryKey: ["inventory-locations"], queryFn: () => fetcher("/api/inventory/locations") });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await mutator(editingLocation ? `/api/inventory/locations/${editingLocation.id}` : "/api/inventory/locations", { method: editingLocation ? "PATCH" : "POST", body: Object.fromEntries(new FormData(event.currentTarget)) });
      event.currentTarget.reset();
      setMessage(editingLocation ? "Gudang diperbarui." : "Gudang ditambahkan.");
      setEditingLocation(null);
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal menyimpan gudang");
    }
  };

  const retire = async () => {
    if (!retiringLocation) return;
    setIsRetiring(true);
    try {
      await mutator(`/api/inventory/locations/${retiringLocation.id}`, { method: "DELETE" });
      setMessage(`Gudang ${retiringLocation.name} dinonaktifkan.`);
      setRetiringLocation(null);
      refetch();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Gagal menonaktifkan gudang");
    } finally {
      setIsRetiring(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1">
        <Header userEmail="" role="management" />
        <main className="space-y-6 p-4 sm:p-6">
          <div><h1 className="text-2xl font-semibold text-ivory">Lokasi Gudang</h1><p className="mt-1 text-sm text-white/50">Tambahkan gudang fisik baru atau nonaktifkan gudang yang sudah kosong. Gudang Utama dan WIP tetap dilindungi.</p></div>
          {message && <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">{message}</p>}
          {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat lokasi"}</p> : isLoading ? <div className="h-56 animate-pulse rounded-lg bg-cocoa" /> : <>
            <form key={editingLocation?.id ?? "new"} onSubmit={submit} className="grid gap-3 rounded-lg border border-gold/15 bg-cocoa p-4 sm:grid-cols-2"><div className="sm:col-span-2 flex items-start justify-between gap-3"><div><h2 className="font-semibold text-cream">{editingLocation ? `Ubah ${editingLocation.name}` : "Tambah gudang"}</h2><p className="mt-1 text-sm text-white/50">Hanya gudang biasa yang dapat ditambahkan dari halaman ini; WIP sistem tidak dapat diubah.</p></div>{editingLocation && <button type="button" onClick={() => setEditingLocation(null)} className="text-sm text-gold underline underline-offset-4">Batal ubah</button>}</div><label className="text-sm text-cream">Kode gudang<input required name="code" defaultValue={editingLocation?.code} placeholder="Contoh: GUDANG-OPR" className={inputClass} /></label><label className="text-sm text-cream">Nama gudang<input required name="name" defaultValue={editingLocation?.name} placeholder="Contoh: Gudang Operasional" className={inputClass} /></label><div><button className="rounded bg-gold px-3 py-2 text-sm font-medium text-night">{editingLocation ? "Simpan perubahan" : "Tambah gudang"}</button></div></form>
            <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-white/45"><tr><th className="p-3">Kode</th><th>Lokasi</th><th>Jenis</th><th>Saldo bahan</th><th>Unit cincin aktif</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{data?.locations.length ? data.locations.map((location) => <tr key={location.id} className="border-t border-white/5 text-cream"><td className="p-3">{location.code}</td><td>{location.name}</td><td>{location.location_type === "wip" ? "WIP" : "Gudang"}{location.is_default && " utama"}</td><td>{Number(location.balance_grams).toFixed(3)} g</td><td>{location.stock_unit_count}</td><td>{location.is_active ? "Aktif" : "Dinonaktifkan"}</td><td>{location.is_active && !location.is_default && location.location_type === "warehouse" ? <div className="flex gap-2"><button type="button" onClick={() => setEditingLocation(location)} className="text-gold underline underline-offset-4">Ubah</button><button type="button" onClick={() => setRetiringLocation(location)} className="text-rose-200 underline underline-offset-4">Nonaktifkan</button></div> : <span className="text-xs text-white/40">Dilindungi</span>}</td></tr>) : <tr><td colSpan={7} className="p-6 text-center text-sm text-white/50">Belum ada lokasi inventory.</td></tr>}</tbody></table></div></section>
          </>}
        </main>
      </div>
      <ConfirmDialog isOpen={Boolean(retiringLocation)} title="Nonaktifkan gudang?" message={retiringLocation ? `Gudang ${retiringLocation.name} hanya dapat dinonaktifkan jika saldo dan unit aktifnya sudah kosong.` : ""} confirmText="Nonaktifkan" variant="warning" isLoading={isRetiring} onConfirm={retire} onCancel={() => setRetiringLocation(null)} />
    </div>
  );
}
