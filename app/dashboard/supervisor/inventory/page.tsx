"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher } from "@/lib/api";
import { readyStockGenderLabel } from "@/lib/inventory/ready-stock-gender";
import { getBrandName } from "@/lib/legacy/brands";

type Availability = {
  checked_at: string;
  materials: { code: string; name: string; available_grams: string }[];
  ready_stock: {
    brand_id: number;
    source_product_id: number | null;
    source_material_id: number | null;
    size: string | null;
    ring_gender: string;
    available_units: number;
    product_label: string;
    cover_image_url: string | null;
    material_label: string;
  }[];
};

function formatGrams(value: string) {
  return `${Number(value).toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;
}

export default function SupervisorInventoryAvailabilityPage() {
  const [query, setQuery] = useState("");
  const { data, error, isLoading } = useQuery<Availability>({
    queryKey: ["inventory-availability"],
    queryFn: () => fetcher("/api/inventory/availability"),
  });
  const keyword = query.trim().toLowerCase();
  const materials = useMemo(() => (data?.materials ?? []).filter((material) =>
    !keyword || `${material.code} ${material.name}`.toLowerCase().includes(keyword),
  ), [data?.materials, keyword]);
  const readyStock = useMemo(() => (data?.ready_stock ?? []).filter((unit) =>
    !keyword || `${unit.product_label} ${unit.material_label} ${unit.size ?? ""} ${readyStockGenderLabel(unit.ring_gender)} ${getBrandName(unit.brand_id)}`.toLowerCase().includes(keyword),
  ), [data?.ready_stock, keyword]);

  return (
    <div className="flex h-screen bg-night">
      <Sidebar role="supervisor" />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <Header userEmail="" role="supervisor" />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <h1 className="text-2xl font-semibold text-ivory">Ketersediaan Stok</h1>
            <p className="mt-1 text-sm text-white/55">Lihat stok gudang dan cincin jadi yang tersedia saat ini. Tampilan ini tidak memesan atau mengurangi stok.</p>
          </div>

          <label className="block max-w-xl text-sm text-cream">
            Cari bahan, model, brand, ukuran, jenis cincin, atau kadar
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream" />
          </label>

          {error ? (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat ketersediaan stok."}</p>
          ) : isLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-cocoa" />
          ) : (
            <>
              <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa">
                <div className="border-b border-gold/10 px-4 py-3">
                  <h2 className="font-semibold text-cream">Bahan baku di gudang</h2>
                  <p className="mt-1 text-xs text-white/50">Jumlah fisik per bahan di lokasi gudang, tidak termasuk bahan yang sudah berada di WIP.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-white/45"><tr><th className="p-3">Kode</th><th>Material</th><th className="text-right">Tersedia</th></tr></thead>
                    <tbody>{materials.length ? materials.map((material) => <tr key={material.code} className="border-t border-white/5 text-cream"><td className="p-3 font-mono text-xs">{material.code}</td><td>{material.name}</td><td className="pr-3 text-right tabular-nums">{formatGrams(material.available_grams)}</td></tr>) : <tr><td colSpan={3} className="p-6 text-center text-sm text-white/50">Tidak ada bahan yang sesuai.</td></tr>}</tbody>
                  </table>
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa">
                <div className="border-b border-gold/10 px-4 py-3">
                  <h2 className="font-semibold text-cream">Cincin jadi ready-stock</h2>
                  <p className="mt-1 text-xs text-white/50">Hanya unit fisik dengan status tersedia. Jumlah dapat berubah saat approval diproses.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-white/45"><tr><th className="p-3">Model</th><th>Brand</th><th>Bahan / kadar</th><th>Ukuran</th><th>Jenis cincin</th><th className="text-right">Unit tersedia</th></tr></thead>
                    <tbody>{readyStock.length ? readyStock.map((unit) => <tr key={`${unit.brand_id}-${unit.source_product_id}-${unit.source_material_id}-${unit.size}-${unit.ring_gender}`} className="border-t border-white/5 text-cream"><td className="p-3"><div className="flex items-center gap-2">{unit.cover_image_url ? <img src={unit.cover_image_url} alt={`Foto ${unit.product_label}`} className="h-10 w-10 rounded object-cover" /> : <div aria-hidden="true" className="h-10 w-10 rounded bg-carbon" />}<span>{unit.product_label}</span></div></td><td>{getBrandName(unit.brand_id)}</td><td>{unit.material_label}</td><td>{unit.size ?? "—"}</td><td>{readyStockGenderLabel(unit.ring_gender)}</td><td className="pr-3 text-right tabular-nums">{unit.available_units}</td></tr>) : <tr><td colSpan={6} className="p-6 text-center text-sm text-white/50">Tidak ada unit ready-stock yang sesuai.</td></tr>}</tbody>
                  </table>
                </div>
              </section>
              <p className="text-xs text-white/40">Diperbarui: {data?.checked_at ? new Date(data.checked_at).toLocaleString("id-ID") : "—"}</p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
