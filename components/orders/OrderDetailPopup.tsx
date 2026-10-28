// components/orders/OrderDetailPopup.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { X, RefreshCw, AlertTriangle } from "lucide-react";
import { getStageLabel } from "@/lib/stages";
import { getStageDeadlineStatus } from "@/lib/stage-deadlines";
import { formatAddsOnList } from "@/lib/adds-on";
import { getOrderDetailTabs, type OrderDetailView } from "@/lib/orders/order-detail-view";
import StageTimeline from "@/components/orders/StageTimeline";
import EstimatedCompletion from "@/components/analytics/EstimatedCompletion";
import WarrantyPreparation from "@/components/orders/WarrantyPreparation";

export interface OrderDetail {
  order: {
    id: string;
    order_number: string;
    no_nota: string | null;
    produk_nama: string | null;
    produk_sku: string | null;
    produk_spesifikasi: string | null;
    jenis_order: string | null;
    customer_name: string;
    customer_wa: string | null;
    customer_email: string | null;
    customer_instagram: string | null;
    customer_hobby: string | null;
    customer_job: string | null;
    tgl_chat: string | null;
    tgl_order: string | null;
    tgl_acara: string | null;
    deadline: string | null;
    deadline_tukang: string | null;
    acara: string | null;
    kebutuhan_acara: string | null;
    alat_ukur: string | null;
    ukuran_pria: string | null;
    ukiran_pria: string | null;
    jenis_cincin_pria: string | null;
    keterangan_pria: string[] | null;
    ukuran_wanita: string | null;
    ukiran_wanita: string | null;
    jenis_cincin_wanita: string | null;
    keterangan_wanita: string[] | null;
    font: string | null;
    laser_position: string | null;
    harga: number | null;
    subtotal: number | null;
    diskon: number | null;
    ongkir: number | null;
    dp_amount: number | null;
    jenis_pembayaran: string | null;
    jumlah_bayar: number | null;
    sisa_bayar: number | null;
    proses_produksi: string | null;
    order_via: string | null;
    sumber_media: string | null;
    kategori: string | null;
    transfer_ke_bank: string | null;
    jenis_cincin_features: string[] | null;
    dari_artis_detail: string | null;
    pengiriman: string | null;
    box: string | null;
    alamat_pengiriman: string | null;
    kelurahan: string | null;
    kecamatan: string | null;
    kabupaten_kota: string | null;
    provinsi: string | null;
    kodepos: string | null;
    reference_image_pria_url: string | null;
    reference_image_wanita_url: string | null;
    current_stage: string;
    status: string;
    form_status: string | null;
    created_at: string;
    updated_at: string;
    created_by_name: string | null;
    catatan: string | null;
  };
  transitions: Array<{
    from_stage: string | null;
    to_stage: string;
    reason: string | null;
    transitioned_at: string;
  }>;
  stageResults: Array<{
    id: string;
    stage: string;
    attempt_number: number;
    data: Record<string, unknown>;
    notes: string | null;
    started_at: string;
    finished_at: string;
    users: { full_name: string } | null;
  }>;
  deliveries: Array<{
    id: string;
    delivery_method: string;
    status: string;
    courier_name: string | null;
    tracking_number: string | null;
    dispatched_at: string | null;
    delivered_at: string | null;
  }>;
  approvals: Array<{
    id: string;
    stage: string;
    decision: string;
    remarks: string | null;
    decided_at: string;
    users: { full_name: string } | null;
  }>;
  scanEvents: Array<{
    id: string;
    stage: string;
    action: string;
    scanned_at: string;
    users: { full_name: string } | null;
  }>;
}

const STAGE_COLORS: Record<string, string> = {
  production: "bg-amber-100 text-amber-800 border-amber-200",
  operational: "bg-blue-100 text-blue-800 border-blue-200",
  other: "bg-slate-100 text-[#e8e2d4] border-slate-200",
};

function formatCurrency(val: number | null) {
  return val != null ? `Rp ${val.toLocaleString("id-ID")}` : "\u2014";
}

function formatDate(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "\u2014";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="bg-[#1C1917] rounded p-2 text-xs">
      <span className="text-white/40">{label}</span>
      <p className="font-medium text-[#e8e2d4] mt-0.5">{value}</p>
    </div>
  );
}

function RingSpecSection({
  title,
  ukuran,
  jenis,
  ukiran,
  keterangan,
}: {
  title: string;
  ukuran: string | null;
  jenis: string | null;
  ukiran: string | null;
  keterangan: string[] | null;
}) {
  const hasData =
    ukuran || jenis || ukiran || (keterangan && keterangan.length > 0);
  if (!hasData) return null;
  return (
    <div className="rounded-lg bg-[#1C1917] p-3 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {ukuran && (
          <div>
            <span className="text-white/40">Ukuran</span>
            <p className="font-semibold text-[#e8e2d4]">{ukuran}</p>
          </div>
        )}
        {jenis && (
          <div>
            <span className="text-white/40">Jenis</span>
            <p className="font-semibold text-[#e8e2d4]">{jenis}</p>
          </div>
        )}
      </div>
      {ukiran && (
        <div className="text-xs">
          <span className="text-white/40">Ukiran</span>
          <p className="font-mono font-semibold text-[#e8e2d4]">{ukiran}</p>
        </div>
      )}
      {keterangan && keterangan.length > 0 && (
        <div className="text-xs">
          <span className="text-white/40">Keterangan</span>
          <ul className="mt-0.5 space-y-0.5">
            {keterangan.map((k, _i) => (
              <li key={_i} className="text-white/40">
                {"\u2022"} {k}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function OrderDetailPopup({
  orderId,
  orderNumber,
  onClose,
  view = "tracking",
}: {
  orderId: string;
  orderNumber: string;
  onClose: () => void;
  view?: OrderDetailView;
}) {
  const [tab, setTab] = useState<"info" | "stages" | "approvals">("info");
  const tabs = getOrderDetailTabs(view);

  const { data: detailRes, isLoading, error } = useQuery<{ data: OrderDetail }>({
    queryKey: ["order-detail", orderId],
    queryFn: () => fetcher<{ data: OrderDetail }>(`/api/order-detail?order_id=${orderId}`),
  });
  const detail = detailRes?.data ?? null;

  const o = detail?.order;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-xl bg-[#2a2522] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#2a2522] border-b border-slate-100 px-5 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-3">
              <span className="font-mono text-xs font-semibold text-white/40">
                {orderNumber}
              </span>
              <h3 className="text-sm font-semibold text-[#f0f4ff] mt-0.5 truncate">
                {o?.customer_name || "Memuat..."}
              </h3>
              {view === "intake" ? (
                <span className="inline-block rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-200 mt-1">
                  Menunggu Validasi SPV CS
                </span>
              ) : o && (
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium mt-1 ${
                    STAGE_COLORS[
                      detail?.transitions?.length ? "operational" : "other"
                    ]
                  }`}
                >
                  {getStageLabel(o.current_stage)}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/40 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-400 mb-2" />
            <p className="text-sm text-white/40">
              {error instanceof Error ? error.message : "Gagal memuat"}
            </p>
          </div>
        ) : detail && o ? (
          <>
            {/* Tabs */}
            <div className="flex border-b border-slate-100 px-5">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    tab === t
                      ? "border-slate-800 text-[#f0f4ff]"
                      : "border-transparent text-white/40 hover:text-[#e8e2d4]"
                  }`}
                >
                  {t === "info"
                    ? "Info Order"
                    : t === "stages"
                      ? "Riwayat Tahap"
                      : "Persetujuan"}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {/* ── INFO TAB ── */}
              {tab === "info" && (
                <>
                  {/* Customer */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
                      Pelanggan
                    </p>
                    <div className="rounded-lg bg-[#1C1917] p-3 space-y-1">
                      <p className="text-sm font-semibold text-[#f0f4ff]">
                        {o.customer_name}
                      </p>
                      {o.customer_wa && (
                        <p className="text-xs text-white/40">
                          WhatsApp: {o.customer_wa}
                        </p>
                      )}
                      {o.customer_email && (
                        <p className="text-xs text-white/40">
                          Email: {o.customer_email}
                        </p>
                      )}
                      {o.customer_instagram && (
                        <p className="text-xs text-white/40">
                          Instagram: {o.customer_instagram}
                        </p>
                      )}
                      {o.customer_job && (
                        <p className="text-xs text-white/40">
                          Pekerjaan: {o.customer_job}
                        </p>
                      )}
                      {o.customer_hobby && (
                        <p className="text-xs text-white/40">
                          Hobi: {o.customer_hobby}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Produk (checkout dari katalog) */}
                  {o.produk_nama && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
                        Produk
                      </p>
                      <div className="rounded-lg bg-[#1C1917] p-3 space-y-1.5">
                        <p className="text-sm font-semibold text-[#f0f4ff]">
                          {o.produk_nama}
                        </p>
                        {o.produk_sku && (
                          <p className="font-mono text-xs text-white/40">
                            SKU: {o.produk_sku}
                          </p>
                        )}
                        {o.produk_spesifikasi && (
                          <div
                            className="text-xs text-white/60 leading-relaxed max-w-none [&_h2]:text-[10px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-white/40 [&_h2]:mb-1 [&_blockquote]:mb-0.5 [&_p]:mb-1"
                            dangerouslySetInnerHTML={{
                              __html: o.produk_spesifikasi,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {o.proses_produksi && (
                    <InfoRow label="Proses Produksi" value={o.proses_produksi} />
                  )}

                  {/* Ring specs */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
                      Spesifikasi Cincin
                    </p>
                    <div className="space-y-2">
                      <RingSpecSection
                        title="Pria"
                        ukuran={o.ukuran_pria}
                        jenis={o.jenis_cincin_pria}
                        ukiran={o.ukiran_pria}
                        keterangan={o.keterangan_pria}
                      />
                      <RingSpecSection
                        title="Wanita"
                        ukuran={o.ukuran_wanita}
                        jenis={o.jenis_cincin_wanita}
                        ukiran={o.ukiran_wanita}
                        keterangan={o.keterangan_wanita}
                      />
                      {(o.font || o.laser_position) && (
                        <div className="grid grid-cols-2 gap-2">
                          <InfoRow label="Font" value={o.font} />
                          <InfoRow
                            label="Posisi Laser"
                            value={o.laser_position}
                          />
                        </div>
                      )}
                      {o.alat_ukur && (
                        <InfoRow label="Alat Ukur" value={o.alat_ukur} />
                      )}
                    </div>
                  </div>

                  <WarrantyPreparation orderId={orderId} currentStage={o.current_stage} />

                  {/* Reference images */}
                  {(o.reference_image_pria_url ||
                    o.reference_image_wanita_url) && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
                        Foto Referensi
                      </p>
                      <div className="flex gap-2">
                        {o.reference_image_pria_url && (
                          <a
                            href={o.reference_image_pria_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-1/2 rounded-lg border border-blue-200 bg-[#c9a227]/10 py-2 text-center text-xs font-medium text-[#e8e2d4] hover:bg-blue-100 transition-colors"
                          >
                            Referensi Pria ↗
                          </a>
                        )}
                        {o.reference_image_wanita_url && (
                          <a
                            href={o.reference_image_wanita_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-1/2 rounded-lg border border-blue-200 bg-[#c9a227]/10 py-2 text-center text-xs font-medium text-[#e8e2d4] hover:bg-blue-100 transition-colors"
                          >
                            Referensi Wanita ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Price */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
                      Harga
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {o.subtotal != null && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Subtotal</span>
                          <p className="font-semibold text-[#e8e2d4]">
                            {formatCurrency(o.subtotal)}
                          </p>
                        </div>
                      )}
                      {o.diskon != null && o.diskon > 0 && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Diskon</span>
                          <p className="font-semibold text-rose-300">
                            − {formatCurrency(o.diskon)}
                          </p>
                        </div>
                      )}
                      {o.ongkir != null && o.ongkir > 0 && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Biaya Kirim</span>
                          <p className="font-semibold text-[#e8e2d4]">
                            {formatCurrency(o.ongkir)}
                          </p>
                        </div>
                      )}
                      <div className="bg-[#1C1917] rounded p-2">
                        <span className="text-white/40">Harga Final</span>
                        <p className="font-semibold text-[#e8e2d4]">
                          {formatCurrency(o.harga)}
                        </p>
                      </div>
                      {o.dp_amount != null && o.dp_amount > 0 && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">DP</span>
                          <p className="font-semibold text-[#e8e2d4]">
                            {formatCurrency(o.dp_amount)}
                          </p>
                        </div>
                      )}
                      {o.jumlah_bayar != null && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Dibayar</span>
                          <p className="font-semibold text-[#e8e2d4]">
                            {formatCurrency(o.jumlah_bayar)}
                          </p>
                        </div>
                      )}
                      {o.sisa_bayar != null && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Sisa Bayar</span>
                          <p
                            className={`font-semibold ${o.sisa_bayar > 0 ? "text-amber-300" : "text-emerald-300"}`}
                          >
                            {o.sisa_bayar > 0 ? formatCurrency(o.sisa_bayar) : "Lunas"}
                          </p>
                        </div>
                      )}
                      {o.jenis_pembayaran && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Metode Bayar</span>
                          <p className="font-semibold text-[#e8e2d4]">
                            {o.jenis_pembayaran}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dates & event */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
                      Tanggal & Acara
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {o.tgl_order && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Tgl Order</span>
                          <p className="font-medium text-[#e8e2d4]">
                            {formatDate(o.tgl_order)}
                          </p>
                        </div>
                      )}
                      <div className="bg-[#1C1917] rounded p-2">
                        <span className="text-white/40">Deadline</span>
                        <p
                          className={`font-medium ${o.deadline && new Date(o.deadline) < new Date() ? "text-rose-600" : "text-[#e8e2d4]"}`}
                        >
                          {formatDate(o.deadline)}
                        </p>
                        {o.deadline && (() => {
                          const dl = getStageDeadlineStatus(o.tgl_order, o.deadline, o.current_stage);
                          if (!dl) return null;
                          return (
                            <span
                              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${dl.isOverdue ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-emerald-500/[0.08] text-emerald-300 ring-emerald-200"}`}
                            >
                              {dl.isOverdue
                                ? `\u26a0 Terlambat ${Math.abs(dl.daysRemaining)} hari`
                                : `\u2714 H-${Math.max(dl.daysRemaining, 1)}`}
                            </span>
                          );
                        })()}
                      </div>
                      {o.tgl_acara && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Tgl Acara</span>
                          <p className="font-medium text-[#e8e2d4]">
                            {formatDate(o.tgl_acara)}
                          </p>
                        </div>
                      )}
                      {o.deadline_tukang && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Deadline Tukang</span>
                          <p className="font-medium text-[#e8e2d4]">
                            {formatDate(o.deadline_tukang)}
                          </p>
                        </div>
                      )}
                      {o.no_nota && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">No Nota</span>
                          <p className="font-mono font-medium text-[#e8e2d4]">
                            {o.no_nota}
                          </p>
                        </div>
                      )}
                      {o.jenis_order && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Jenis Order</span>
                          <p className="font-medium text-[#e8e2d4]">
                            {o.jenis_order}
                          </p>
                        </div>
                      )}
                      {o.sumber_media && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Sumber</span>
                          <p className="font-medium text-[#e8e2d4]">
                            {o.sumber_media}
                          </p>
                        </div>
                      )}
                      {o.acara && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Acara</span>
                          <p className="font-medium text-[#e8e2d4]">
                            {o.acara}
                          </p>
                        </div>
                      )}
                      {o.kategori && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Kategori</span>
                          <p className="font-medium text-[#e8e2d4] text-[10px] uppercase tracking-wider">
                            {o.kategori}
                          </p>
                        </div>
                      )}
                      {o.jenis_cincin_features?.length ? (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Adds-On</span>
                          <p className="font-medium text-[#e8e2d4] break-words">
                            {formatAddsOnList(o.jenis_cincin_features)}
                          </p>
                        </div>
                      ) : null}
                      {o.transfer_ke_bank && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">
                            Transfer ke Bank
                          </span>
                          <p className="font-medium text-[#e8e2d4]">
                            {o.transfer_ke_bank}
                          </p>
                        </div>
                      )}
                      {o.dari_artis_detail && (
                        <div className="bg-[#1C1917] rounded p-2">
                          <span className="text-white/40">Dari Artis</span>
                          <p className="font-medium text-[#e8e2d4]">
                            {o.dari_artis_detail}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shipping */}
                  {(o.pengiriman || o.alamat_pengiriman) && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
                        Pengiriman
                      </p>
                      <div className="rounded-lg bg-[#1C1917] p-3 space-y-1 text-xs">
                        {o.pengiriman && o.pengiriman !== "Alamat Customer" && (
                          <p className="font-medium text-[#e8e2d4]">
                            {o.pengiriman}
                          </p>
                        )}
                        {(o.pengiriman === "Alamat Customer" || !o.pengiriman) && (
                          <>
                            {o.alamat_pengiriman && (
                              <p className="text-white/40">
                                {o.alamat_pengiriman}
                              </p>
                            )}
                            {(o.kelurahan ||
                              o.kecamatan ||
                              o.kabupaten_kota) && (
                              <p className="text-white/40">
                                {[
                                  o.kelurahan,
                                  o.kecamatan,
                                  o.kabupaten_kota,
                                  o.provinsi,
                                ]
                                  .filter(Boolean)
                                  .join(", ")}
                                {o.kodepos ? ` ${o.kodepos}` : ""}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Catatan / Order Notes (Yii2 TinyMCE) */}
                  {o.catatan && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
                        Catatan Order
                      </p>
                      <div
                        className="rounded-lg bg-[#1C1917] p-3 text-xs text-white/60 leading-relaxed prose-a:text-amber-400 prose-strong:text-white/80 max-w-none [&_p]:mb-1 [&_ul]:ml-4 [&_ol]:ml-4"
                        dangerouslySetInnerHTML={{ __html: o.catatan }}
                      />
                    </div>
                  )}

                  {/* Deliveries */}
                  {detail.deliveries.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">
                        Riwayat Pengiriman
                      </p>
                      <div className="space-y-2">
                        {detail.deliveries.map((d) => (
                          <div
                            key={d.id}
                            className="rounded-lg border border-slate-200 p-2.5 text-xs"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-[#e8e2d4]">
                                {d.delivery_method}
                              </span>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                  d.status === "delivered"
                                    ? "bg-emerald-100 text-emerald-300"
                                    : d.status === "dispatched"
                                      ? "bg-blue-100 text-[#e8e2d4]"
                                      : "bg-slate-100 text-white/40"
                                }`}
                              >
                                {d.status}
                              </span>
                            </div>
                            {d.courier_name && (
                              <p className="text-white/40">
                                Kurir: {d.courier_name}
                              </p>
                            )}
                            {d.tracking_number && (
                              <p className="text-white/40">
                                Resi: {d.tracking_number}
                              </p>
                            )}
                            {d.delivered_at && (
                              <p className="text-white/40">
                                Diterima: {formatDateTime(d.delivered_at)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Estimated completion */}
                  {o.current_stage && (
                    <EstimatedCompletion
                      currentStage={o.current_stage}
                      deadline={o.deadline}
                    />
                  )}
                </>
              )}

              {/* ── STAGES TAB ── */}
              {tab === "stages" && (
                <StageTimeline
                  transitions={detail.transitions}
                  stageResults={detail.stageResults}
                  scanEvents={detail.scanEvents}
                  approvals={detail.approvals}
                  currentStage={detail.order.current_stage}
                />
              )}

              {/* ── APPROVALS TAB ── */}
              {tab === "approvals" && (
                <>
                  {detail.approvals.length === 0 ? (
                    <p className="text-sm text-white/40 text-center py-8">
                      Belum ada riwayat persetujuan
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {detail.approvals.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-lg border border-slate-200 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-[#e8e2d4]">
                              {getStageLabel(a.stage)}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                a.decision === "approved"
                                  ? "bg-emerald-100 text-emerald-300"
                                  : "bg-rose-100 text-rose-700"
                              }`}
                            >
                              {a.decision === "approved"
                                ? "Disetujui"
                                : "Ditolak"}
                            </span>
                          </div>
                          <p className="text-white/40">
                            {a.users?.full_name || "\u2014"} &middot;{" "}
                            {formatDateTime(a.decided_at)}
                          </p>
                          {a.remarks && (
                            <p className="text-white/40 mt-1 italic">
                              &ldquo;{a.remarks}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
