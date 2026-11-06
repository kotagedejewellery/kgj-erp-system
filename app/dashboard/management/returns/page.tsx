"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";

type Issue = {
  order_id: string;
  issue_type: "custom" | "ready_stock";
  issued_at: string;
  legacy_orders: { kode_order: string } | null;
};

export default function InventoryReturnsPage() {
  const [reasonByOrder, setReasonByOrder] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const { data, error, isLoading, refetch } = useQuery<{ issues: Issue[] }>({
    queryKey: ["inventory-returns"],
    queryFn: () => fetcher("/api/inventory/returns"),
  });
  const issues = data?.issues ?? [];

  const submit = async (event: FormEvent<HTMLFormElement>, orderId: string) => {
    event.preventDefault();
    const reason = reasonByOrder[orderId]?.trim();
    if (!reason) return;
    try {
      await mutator("/api/inventory/returns", { body: { order_id: orderId, reason } });
      setReasonByOrder((current) => ({ ...current, [orderId]: "" }));
      setMessage("Stok telah dikembalikan dan mutasi retur dicatat.");
      refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengembalikan stok");
    }
  };

  return (
    <div className="flex h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <Header userEmail="" role="management" />
        <main className="space-y-6 p-4 sm:p-6">
          <div>
            <h1 className="text-2xl font-semibold text-ivory">Retur Stok</h1>
            <p className="mt-1 text-sm text-white/50">Hanya tampil untuk order yang telah dibatalkan setelah issue inventory.</p>
          </div>

          <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">Pastikan bahan atau cincin telah diperiksa secara fisik dan layak kembali menjadi stok sebelum memproses retur.</p>

          {message && <p className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream" role="status">{message}</p>}
          {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error instanceof Error ? error.message : "Gagal memuat retur"}</p> : isLoading ? <div className="h-48 animate-pulse rounded-lg bg-cocoa" /> : issues.length === 0 ? <p className="rounded-lg border border-gold/15 bg-cocoa p-6 text-sm text-white/50">Tidak ada stok yang masih teralokasi untuk dikembalikan.</p> : <div className="space-y-3">{issues.map((issue) => <form key={issue.order_id} onSubmit={(event) => submit(event, issue.order_id)} className="grid gap-3 rounded-lg border border-gold/15 bg-cocoa p-4 lg:grid-cols-[1fr_2fr_auto]"><div><p className="font-semibold text-cream">{issue.legacy_orders?.kode_order ?? issue.order_id}</p><p className="mt-1 text-xs text-white/45">{issue.issue_type === "custom" ? "Bahan dari WIP" : "Cincin ready-stock"}</p></div><label className="sr-only" htmlFor={`return-reason-${issue.order_id}`}>Alasan retur stok</label><input id={`return-reason-${issue.order_id}`} required value={reasonByOrder[issue.order_id] ?? ""} onChange={(event) => setReasonByOrder((current) => ({ ...current, [issue.order_id]: event.target.value }))} placeholder="Alasan retur wajib diisi" className="rounded border border-gold/20 bg-carbon p-2 text-sm text-cream" /><button className="rounded bg-gold px-3 py-2 text-sm font-medium text-night">Kembalikan stok</button></form>)}</div>}
        </main>
      </div>
    </div>
  );
}
