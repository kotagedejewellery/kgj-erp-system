"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher } from "@/lib/api";
import { filterMutationHistory, INVENTORY_MUTATION_LABELS, inventoryMutationLabel } from "@/lib/inventory/mutation-history";

type Mutation = {
  id: string;
  mutation_type: string;
  quantity_grams: number | string;
  reason: string | null;
  created_at: string;
  material_label: string | null;
  stock_unit_label: string | null;
  order_code: string | null;
  actor_name: string | null;
  from_location_label: string | null;
  to_location_label: string | null;
};

function formatGrams(value: number | string) {
  return `${Number(value).toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;
}

export default function MutationHistoryPage() {
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const { data, error, isLoading } = useQuery<{ mutations: Mutation[] }>({
    queryKey: ["inventory-mutations", type, from, to],
    queryFn: () => fetcher(`/api/inventory/mutations?${params.toString()}`),
  });
  const mutations = useMemo(
    () => filterMutationHistory(data?.mutations ?? [], { type, query }),
    [data?.mutations, query, type],
  );

  return (
    <div className="inventory-management flex h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <Header userEmail="" role="management" />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <h1 className="text-2xl font-semibold text-ivory">Riwayat Mutasi</h1>
            <p className="mt-1 text-sm text-white/50">Jejak stok awal, issue, alokasi, dan retur. Data tidak dapat diubah dari halaman ini.</p>
          </div>

          <section className="grid gap-3 rounded-lg border border-gold/15 bg-cocoa p-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-cream">Cari order, bahan, unit, atau pengguna<input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream" /></label>
            <label className="text-sm text-cream">Jenis mutasi<select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream"><option value="">Semua jenis</option>{Object.entries(INVENTORY_MUTATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-sm text-cream">Dari tanggal<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream" /></label>
            <label className="text-sm text-cream">Sampai tanggal<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream" /></label>
          </section>

          {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat riwayat mutasi"}</p> : isLoading ? <div className="h-64 animate-pulse rounded-lg bg-cocoa" /> : <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa"><div className="border-b border-gold/10 px-4 py-3 text-sm text-white/50">Menampilkan maksimal 200 mutasi terbaru.</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-white/45"><tr><th className="p-3">Waktu</th><th>Jenis</th><th>Referensi</th><th>Perpindahan</th><th>Jumlah</th><th>Catatan</th><th>Dicatat oleh</th></tr></thead><tbody>{mutations.length ? mutations.map((mutation) => <tr key={mutation.id} className="border-t border-white/5 text-cream"><td className="p-3 whitespace-nowrap">{new Date(mutation.created_at).toLocaleString("id-ID")}</td><td>{inventoryMutationLabel(mutation.mutation_type)}</td><td>{mutation.order_code ?? mutation.stock_unit_label ?? mutation.material_label ?? "—"}</td><td>{mutation.from_location_label || mutation.to_location_label ? `${mutation.from_location_label ?? "Luar sistem"} → ${mutation.to_location_label ?? "Luar sistem"}` : "—"}</td><td className="whitespace-nowrap">{formatGrams(mutation.quantity_grams)}</td><td>{mutation.reason ?? "—"}</td><td>{mutation.actor_name ?? "Sistem"}</td></tr>) : <tr><td colSpan={7} className="p-6 text-center text-sm text-white/50">Tidak ada mutasi yang sesuai.</td></tr>}</tbody></table></div></section>}
        </main>
      </div>
    </div>
  );
}
