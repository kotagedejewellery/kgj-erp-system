"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, CheckCircle2, CircleAlert, Factory, Gem, RefreshCw, Warehouse } from "lucide-react";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import { fetcher } from "@/lib/api";
import { inventoryMutationLabel } from "@/lib/inventory/mutation-history";

type InventorySummary = {
  warehouse_grams: number;
  wip_grams: number;
  available_stock_units: number;
  material_count: number;
};

type Mutation = {
  id: string;
  mutation_type: string;
  quantity_grams: number | string;
  reason: string | null;
  created_at: string;
};

type InventoryResponse = {
  summary: InventorySummary;
  mutations: Mutation[];
  is_enabled: boolean;
  activation: {
    has_default_warehouse: boolean;
    has_default_wip: boolean;
    has_mapped_material_with_stock: boolean;
    catalog_model_count: number;
    ready_stock_unit_count: number;
    can_activate: boolean;
  };
};

function formatGrams(value: number) {
  return `${value.toLocaleString("id-ID", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;
}

function labelMutation(type: string) {
  return inventoryMutationLabel(type);
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Warehouse;
}) {
  return (
    <div className="rounded-lg border border-gold/15 bg-cocoa p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/50">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ivory">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function InventoryDashboardPage() {
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  useEffect(() => setClientUser(getClientUser()), []);

  const { data, error, isLoading, isRefetching, refetch } = useQuery<InventoryResponse>({
    queryKey: ["inventory-summary"],
    queryFn: () => fetcher("/api/inventory/summary"),
  });
  const activateInventory = async () => {
    if (!data || data.is_enabled || !data.activation.can_activate || !confirm("Aktifkan inventory untuk approval baru? Order pada Approval Penerimaan Order akan memerlukan sumber stok.")) return;
    const response = await fetch("/api/inventory/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_enabled: true }) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      alert(body.error ?? "Gagal memperbarui aktivasi inventory");
      return;
    }
    refetch();
  };

  return (
    <div className="flex h-screen bg-night">
      <Sidebar role="management" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="management" />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-ivory">Inventory</h1>
              <p className="mt-1 text-sm text-white/50">Stok bahan, WIP, dan cincin jadi yang tersedia.</p>
            </div>
            <div className="flex items-center gap-2">
              {data?.is_enabled ? (
                <span className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-100">Inventory aktif</span>
              ) : (
                <button type="button" onClick={activateInventory} disabled={!data?.activation.can_activate} className="rounded-md border border-gold/20 bg-cocoa px-3 py-2 text-xs font-medium text-cream disabled:opacity-50">Aktifkan inventory</button>
              )}
              <button type="button" onClick={() => refetch()} disabled={isRefetching} className="inline-flex items-center gap-2 rounded-md border border-gold/20 bg-cocoa px-3 py-2 text-xs font-medium text-cream transition hover:border-gold/45 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />Perbarui</button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-lg border border-gold/15 bg-cocoa" />)}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-5 text-sm text-amber-100">
              <p className="font-medium">Dashboard inventory belum dapat dimuat.</p>
              <p className="mt-1 text-amber-100/75">{error instanceof Error ? error.message : "Terjadi kesalahan saat memuat inventory."}</p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {!data.is_enabled && <section className="rounded-lg border border-gold/15 bg-cocoa p-4"><h2 className="font-semibold text-cream">Sebelum aktivasi</h2><p className="mt-1 text-sm text-white/50">Aktivasi berlaku untuk approval baru. Ready-stock tetap opsional bila pilot dimulai dari order custom.</p><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><ReadinessItem ready={data.activation.has_default_warehouse} label="Gudang Utama aktif" /><ReadinessItem ready={data.activation.has_default_wip} label="Lokasi WIP aktif" /><ReadinessItem ready={data.activation.has_mapped_material_with_stock} label="Bahan pesanan sudah terhubung dan memiliki stok" /><ReadinessItem ready={data.activation.catalog_model_count > 0} optional label={`Katalog model diperbarui (${data.activation.catalog_model_count})`} /><ReadinessItem ready={data.activation.ready_stock_unit_count > 0} optional label={`Unit ready-stock tercatat (${data.activation.ready_stock_unit_count})`} /></div></section>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Total gram gudang" value={formatGrams(data.summary.warehouse_grams)} icon={Warehouse} />
                <MetricCard label="Material di WIP" value={formatGrams(data.summary.wip_grams)} icon={Factory} />
                <MetricCard label="Cincin ready-stock" value={data.summary.available_stock_units} icon={Gem} />
                <MetricCard label="Material aktif" value={data.summary.material_count} icon={Boxes} />
              </div>

              <section className="overflow-hidden rounded-lg border border-gold/15 bg-cocoa">
                <div className="border-b border-gold/10 px-4 py-3">
                  <h2 className="text-sm font-semibold text-cream">Mutasi terbaru</h2>
                </div>
                {data.mutations.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-white/45">Belum ada mutasi inventory.</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {data.mutations.map((mutation) => (
                      <div key={mutation.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-cream">{labelMutation(mutation.mutation_type)}</p>
                          <p className="truncate text-xs text-white/45">{mutation.reason || "—"}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums text-ivory">{formatGrams(Number(mutation.quantity_grams))}</p>
                          <p className="text-xs text-white/45">{new Date(mutation.created_at).toLocaleString("id-ID")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function ReadinessItem({ ready, label, optional = false }: { ready: boolean; label: string; optional?: boolean }) {
  const Icon = ready ? CheckCircle2 : CircleAlert;
  return <p className={ready ? "flex items-center gap-2 text-emerald-100" : "flex items-center gap-2 text-amber-100"}><Icon className="h-4 w-4 shrink-0" />{label}{optional && <span className="text-xs text-white/45">(opsional)</span>}</p>;
}
