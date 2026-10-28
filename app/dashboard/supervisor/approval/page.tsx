// app/dashboard/supervisor/approval/page.tsx

"use client";

import { useState, useEffect, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import Sidebar from "@/components/layout/MobileSidebar";
import Header from "@/components/layout/MobileHeader";
import SupervisorPageLoading from "@/components/layout/SupervisorPageLoading";
import OrderDetailPopup from "@/components/orders/OrderDetailPopup";
import { formatAddsOnList } from "@/lib/adds-on";
import { STAGE_SEQUENCE, getStageLabel } from "@/lib/stages";
import { BRAND_FILTER_OPTIONS, getBrandCode, getBrandDisplayName, getBrandFilterCode } from "@/lib/legacy/brands";
import { useSupervisorPageAccess } from "@/lib/auth/use-supervisor-page-access";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,

  RefreshCw,
  XCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WorkOrder {
  cs_order_id: string;
  cs_order_number: string;
  customer_name: string;
  customer_wa: string | null;
  customer_email: string | null;
  ukuran_pria: string | null;
  ukiran_pria: string | null;
  jenis_cincin_pria: string | null;
  keterangan_pria: string[] | string | null;
  gramasi_pria: number | null;
  ukuran_wanita: string | null;
  ukiran_wanita: string | null;
  jenis_cincin_wanita: string | null;
  keterangan_wanita: string[] | string | null;
  gramasi_wanita: number | null;
  font: string | null;
  laser_position: string | null;
  acara: string | null;
  alat_ukur: string | null;
  harga: number | null;
  dp_amount: number | null;
  deadline: string | null;
  pengiriman: string | null;
  alamat_pengiriman: string | null;
  reference_image_pria_url: string | null;
  reference_image_wanita_url: string | null;
}

interface PendingItem {
  order_id: string;
  order_number: string;
  product_name: string;
  customer_name: string;
  stage: string;
  stage_label: string;
  stage_group: "production" | "operational";
  waiting_since: string;
  stage_result_id: string | null;
  attempt_number: number | null;
  worker_name: string;
  worker_role: string;
  submitted_at: string | null;
  data: Record<string, unknown> | null;
  work_order: WorkOrder | null;
}

interface IntakeItem {
  id: string;
  legacy_order_id: string;
  state: string;
  reason: string | null;
  rework_sync_status: "pending" | "failed" | "synced" | "exhausted" | null;
  created_at: string;
  updated_at: string;
  legacy_orders: {
    kode_order: string;
    nama: string | null;
    no_hp: string | null;
    tgl_order: string | null;
    tgl_selesai: string | null;
    catatan: string | null;
    harga_final: number | null;
    jumlah_bayar: number | null;
    sisa_bayar: number | null;
    id_brand: number | null;
  } | null;
}

interface PendingPage<T> {
  data: T[];
  total: number;
  next_offset: number | null;
}

type ActionState =
  | { type: "idle" }
  | { type: "confirming_approve" }
  | { type: "confirming_reject" }
  | { type: "confirming_cancel" }
  | { type: "loading" }
  | { type: "done"; result: "approved" | "rejected" | "cancelled"; message: string };

function IntakeCard({
  item,
  onDecision,
}: {
  item: IntakeItem;
  onDecision: (orderId: string, action: "approve" | "return" | "reject", reason?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const order = item.legacy_orders;
  const waitingForRevision = item.state === "returned_for_revision";

  const decide = async (action: "approve" | "return" | "reject") => {
    if (action !== "approve" && !reason.trim()) return;
    setLoading(true);
    try {
      await onDecision(item.legacy_order_id, action, reason);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gold/15 bg-cocoa p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-ivory">{order?.kode_order ?? "—"}</p>
          <p className="text-sm text-white/60">{order?.nama ?? "—"}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
          waitingForRevision
            ? "bg-amber-500/15 text-amber-200"
            : "bg-sky-500/15 text-sky-200"
        }`}>
          {waitingForRevision ? "Menunggu Revisi" : "Validasi SPV CS"}
        </span>
      </div>
      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-white/45">WhatsApp</dt><dd className="text-cream text-right">{order?.no_hp ?? "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-white/45">Deadline</dt><dd className="text-cream text-right">{order?.tgl_selesai ?? "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-white/45">Brand</dt><dd className="text-cream text-right">{getBrandDisplayName(order?.id_brand)}</dd></div>
      </dl>
      {order?.catatan && <p className="rounded-md bg-black/15 p-2 text-xs text-white/65">{order.catatan}</p>}
      {waitingForRevision && (
        <div className="rounded-md border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs" role="status">
          <p className="font-medium text-amber-100">
            {item.rework_sync_status === "exhausted"
              ? "Pengiriman permintaan revisi ke Yii2 memerlukan perhatian admin"
              : item.rework_sync_status === "pending" || item.rework_sync_status === "failed"
                ? "Permintaan revisi akan dikirim ke Yii2"
                : "Menunggu pembaruan revisi dari Yii2"}
          </p>
          {item.reason && <p className="mt-1 text-amber-100/75">Alasan: {item.reason}</p>}
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowDetail(true)}
        className="w-full rounded-lg border border-gold/20 bg-gold/5 px-3 py-2 text-xs font-medium text-gold-bright hover:bg-gold/10"
      >
        Lihat Detail Order
      </button>
      <label htmlFor={`intake-reason-${item.id}`} className="block text-xs text-white/60">
        Alasan keputusan
      </label>
      <textarea
        id={`intake-reason-${item.id}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        aria-describedby={`intake-reason-help-${item.id}`}
        placeholder="Contoh: Ukiran nama perlu dikoreksi"
        className="w-full rounded-lg border border-gold/15 bg-carbon px-3 py-2 text-xs text-cream placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/30"
      />
      <p id={`intake-reason-help-${item.id}`} className="text-xs text-white/45">
        Wajib diisi untuk mengembalikan atau menolak order.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button disabled={loading || waitingForRevision} onClick={() => decide("approve")} title={waitingForRevision ? "Menunggu pembaruan revisi dari Yii2" : undefined} className="rounded-lg bg-emerald-600 px-2 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Setujui</button>
        <button disabled={loading || !reason.trim()} onClick={() => decide("return")} className="rounded-lg border border-amber-400/25 px-2 py-2 text-xs font-medium text-amber-200 disabled:opacity-50">Kembalikan</button>
        <button disabled={loading || !reason.trim()} onClick={() => decide("reject")} className="rounded-lg border border-rose-400/25 px-2 py-2 text-xs font-medium text-rose-200 disabled:opacity-50">Tolak</button>
      </div>
      {showDetail && (
        <OrderDetailPopup
          orderId={item.legacy_order_id}
          orderNumber={order?.kode_order ?? "Order"}
          view="intake"
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
}

// ── Stage Verification Guidelines + Real Data Display ────────────────────────

function StageInfoPopup({
  stage,
  orderData,
  stageData,
  onClose,
}: {
  stage: string;
  orderData: {
    order_number: string;
    product_name: string;
    customer_name: string;
  };
  stageData: Record<string, unknown> | null;
  onClose: () => void;
}) {
  // Define what to check per stage based on what the worker actually submitted
  const getStageGuidelines = (): {
    label: string;
    detail: string;
    dataKey?: string;
    dataValue?: unknown;
  }[] => {
    const d = stageData ?? {};

    switch (stage) {
      case "approval_penerimaan_order":
        // Data comes from the order intake record, not a stage result.
        return [
          {
            label: "Nama Customer",
            detail: "Nama customer harus jelas dan sesuai identitas.",
            dataKey: "customer_name",
            dataValue: d.customer_name as string | null ?? orderData.customer_name,
          },
          {
            label: "No WhatsApp",
            detail: "Nomor WA harus valid untuk koordinasi dan konfirmasi.",
            dataKey: "customer_wa",
            dataValue: d.customer_wa as string | null ?? null,
          },
          {
            label: "Ukuran Cincin Pria",
            detail: "Ukuran cincin pria sudah dicatat dengan benar.",
            dataKey: "ukuran_pria",
            dataValue: d.ukuran_pria as string | null ?? null,
          },
          {
            label: "Jenis Cincin Pria",
            detail: "Jenis cincin pria (model/tipe) sudah ditentukan.",
            dataKey: "jenis_cincin_pria",
            dataValue: d.jenis_cincin_pria as string | null ?? null,
          },
          {
            label: "Ukiran Pria",
            detail: "Pastikan tidak ada typo pada teks ukiran pria.",
            dataKey: "ukiran_pria",
            dataValue: d.ukiran_pria as string | null ?? null,
          },
          {
            label: "Ukuran Cincin Wanita",
            detail: "Ukuran cincin wanita sudah dicatat dengan benar.",
            dataKey: "ukuran_wanita",
            dataValue: d.ukuran_wanita as string | null ?? null,
          },
          {
            label: "Jenis Cincin Wanita",
            detail: "Jenis cincin wanita (model/tipe) sudah ditentukan.",
            dataKey: "jenis_cincin_wanita",
            dataValue: d.jenis_cincin_wanita as string | null ?? null,
          },
          {
            label: "Ukiran Wanita",
            detail: "Pastikan tidak ada typo pada teks ukiran wanita.",
            dataKey: "ukiran_wanita",
            dataValue: d.ukiran_wanita as string | null ?? null,
          },
          {
            label: "Font & Posisi Laser",
            detail: "Font dan posisi laser harus sesuai permintaan customer.",
            dataKey: "font",
            dataValue: d.font
              ? `${d.font}${d.laser_position ? ` — ${d.laser_position}` : ""}`
              : null,
          },
          {
            label: "Harga & DP",
            detail: "Harga total dan DP masuk akal. DP harus sudah dibayar.",
            dataKey: "harga",
            dataValue: d.harga
              ? `Rp ${Number(d.harga).toLocaleString("id-ID")} / DP Rp ${Number(d.dp_amount ?? 0).toLocaleString("id-ID")}`
              : null,
          },
          {
            label: "Deadline",
            detail: "Deadline acara / pengiriman harus realistis.",
            dataKey: "deadline",
            dataValue: d.deadline as string | null ?? null,
          },
          {
            label: "Metode Pengiriman",
            detail: "Metode pengiriman dan alamat sudah sesuai.",
            dataKey: "pengiriman",
            dataValue: d.pengiriman as string | null ?? null,
          },
        ];

      case "approval_racik_bahan":
        return [
          {
            label: "Bahan Tersedia",
            detail: "Konfirmasi semua bahan baku yang diperlukan sudah disiapkan.",
            dataKey: "notes",
            dataValue: d.notes as string | null ?? null,
          },
        ];

      case "approval_qc_1":
        return [
          {
            label: "Bentuk Sesuai Order",
            detail: "Bentuk cincin harus sesuai dengan deskripsi model order.",
            dataKey: "bentuk_sesuai",
            dataValue: getChecklistValue(d, "bentuk_sesuai"),
          },
          {
            label: "Ukuran Cincin Sesuai",
            detail: "Ukuran cincin harus tepat sesuai order.",
            dataKey: "ukuran_sesuai",
            dataValue: getChecklistValue(d, "ukuran_sesuai"),
          },
          {
            label: "Berat Memenuhi Syarat",
            detail: "Berat cincin harus memenuhi syarat minimum.",
            dataKey: "berat_minimum",
            dataValue: getChecklistValue(d, "berat_minimum"),
          },
          {
            label: "Permukaan Bersih",
            detail: "Permukaan harus bersih, tidak ada cacat, penyok, atau goresan.",
            dataKey: "permukaan_bersih",
            dataValue: getChecklistValue(d, "permukaan_bersih"),
          },
          {
            label: "Sambungan Rapi",
            detail: "Sambungan / patri harus rapi, kuat, dan tidak terlihat kasar.",
            dataKey: "solder_rapi",
            dataValue: getChecklistValue(d, "solder_rapi"),
          },
          {
            label: "Catatan QC",
            detail: "Temuan QC atau catatan perbaikan dari petugas.",
            dataKey: "notes",
            dataValue: d.notes as string | null ?? null,
          },
        ];

      case "approval_produksi":
        return [
          {
            label: "Kualitas Hasil Laser",
            detail: "Ukiran laser harus bersih, terbaca, dan sesuai teks order.",
            dataKey: "notes",
            dataValue: d.notes as string | null ?? null,
          },
          {
            label: "Tukang Finishing",
            detail: "Pastikan tukang finishing yang mengerjakan tercatat.",
            dataKey: "tukang",
            dataValue: d.tukang as string | null ?? null,
          },
        ];

      case "approval_qc_2":
        return [
          {
            label: "Kualitas Laser/Ukiran",
            detail: "Hasil laser harus bersih dan terbaca.",
            dataKey: "kualitas_laser",
            dataValue: getChecklistValue(d, "kualitas_laser"),
          },
          {
            label: "Kualitas Finishing",
            detail: "Finishing merata, tidak ada bercak.",
            dataKey: "kualitas_finishing",
            dataValue: getChecklistValue(d, "kualitas_finishing"),
          },
          {
            label: "Teks Ukiran Benar",
            detail: "Teks ukiran sesuai order — cek ejaan dengan teliti!",
            dataKey: "teks_ukiran_benar",
            dataValue: getChecklistValue(d, "teks_ukiran_benar"),
          },
          {
            label: "Bentuk Final Sesuai",
            detail: "Bentuk cincin final sesuai spesifikasi order.",
            dataKey: "bentuk_final_sesuai",
            dataValue: getChecklistValue(d, "bentuk_final_sesuai"),
          },
          {
            label: "Produk Bersih",
            detail: "Produk bersih dan siap untuk serah terima ke customer.",
            dataKey: "produk_bersih",
            dataValue: getChecklistValue(d, "produk_bersih"),
          },
          {
            label: "Catatan QC Akhir",
            detail: "Temuan QC akhir dari petugas.",
            dataKey: "notes",
            dataValue: d.notes as string | null ?? null,
          },
        ];

      default:
        return [];
    }
  };

  const guidelines = getStageGuidelines();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl bg-cocoa shadow-xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/5/10 hover:text-white/70 transition-colors"
        >
          <XCircle className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-4 pr-8">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">
            #{orderData.order_number} · {orderData.customer_name}
          </p>
          <h3 className="text-sm font-semibold text-cream mt-0.5">
            {orderData.product_name}
          </h3>
          {(() => {
            const failCount = guidelines.filter(
              (g) => g.dataValue === false,
            ).length;
            const passCount = guidelines.filter(
              (g) => g.dataValue === true,
            ).length;
            if (passCount === 0 && failCount === 0) return null;
            return (
              <div className="mt-2 flex items-center gap-2">
                {passCount > 0 && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    {passCount} lolos
                  </span>
                )}
                {failCount > 0 && (
                  <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                    {failCount} tidak lolos
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Guidelines with real data */}
        {guidelines.length === 0 ? (
          <p className="text-sm text-white/40 italic text-center py-4">
            Tidak ada panduan verifikasi tersedia untuk tahap ini.
          </p>
        ) : (
          <ul className="space-y-3">
            {guidelines.map((item, idx) => {
              const isBoolean = typeof item.dataValue === "boolean";
              const hasData = item.dataValue !== undefined && item.dataValue !== null;
              const passed = isBoolean ? (item.dataValue as boolean) : null;

              return (
                <li key={idx} className="flex gap-3">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold mt-0.5 ${
                    passed === true
                      ? "bg-emerald-500/10 text-emerald-300"
                      : passed === false
                        ? "bg-rose-500/10 text-rose-300"
                        : "bg-white/10 text-white/50"
                  }`}>
                    {passed === true ? "✓" : passed === false ? "✗" : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium ${
                      passed === false ? "text-rose-300" : "text-cream"
                    }`}>
                      {item.label}
                    </p>
                    <p className="text-[12px] text-white/50">{item.detail}</p>
                    {hasData && (
                      <div className={`mt-1 rounded px-2 py-1 border ${
                        passed === true
                          ? "bg-emerald-500/10 border-emerald-100"
                          : passed === false
                            ? "bg-rose-500/10 border-rose-100"
                            : "bg-[#26211c] border-gold/10"
                      }`}>
                        <span className="text-[10px] text-white/40 uppercase">Data: </span>
                        <span className={`text-[12px] font-semibold ${
                          passed === true ? "text-emerald-300" : passed === false ? "text-rose-300" : "text-cream"
                        }`}>
                          {isBoolean
                            ? (passed ? "Lolos ✓" : "Tidak Lolos ✗")
                            : String(item.dataValue)}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Dismiss button */}
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900 transition-colors"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}

// Helper: extract checklist value from quality_checklist array
function getChecklistValue(
  data: Record<string, unknown>,
  key: string,
): boolean | null {
  const checklist = data.quality_checklist as
    | Array<{ key?: string; check_key?: string; passed: boolean }>
    | undefined;
  if (!checklist) return null;
  const item = checklist.find((c) => (c.key ?? c.check_key) === key);
  return item?.passed ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function formatDataValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "number") return value.toLocaleString("id-ID");
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    // Summarise an array of objects.
    if (typeof value[0] === "object" && value[0] !== null) {
      return value
        .map((item) => {
          const parts: string[] = [];
          if (item.transaction_type) parts.push(item.transaction_type);
          if (item.material_type) parts.push(item.material_type);
          if (item.weight_grams) parts.push(`${item.weight_grams}g`);
          if (item.karat) parts.push(`${item.karat}K`);
          return parts.length ? parts.join(" ") : JSON.stringify(item);
        })
        .join(" | ");
    }
    return value.join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(
        ([k, v]) =>
          `${humanizeKey(k)}: ${typeof v === "boolean" ? (v ? "Ya" : "Tidak") : String(v)}`,
      );
    return entries.length ? entries.join(", ") : "—";
  }
  return String(value);
}

const KEY_LABELS: Record<string, string> = {
  craftsman_type: "Pengerjaan oleh",
  result: "Hasil",
  delivery_method: "Metode pengiriman",
  recipient_name: "Nama penerima",
  recipient_phone: "No HP penerima",
  delivery_address: "Alamat pengiriman",
  is_delivered: "Status pengiriman",
  courier_name: "Nama kurir",
  tracking_number: "Nomor resi",
  tukang: "Tukang",
  tukang_batik: "Tukang Batik",
  tukang_nama: "Tukang Nama",
  model_nusantara: "Model Nusantara",
  nomor_resi: "Nomor Resi",
  tanggal_packing: "Tanggal Packing",
  foto_cincin_pria: "Foto Cincin Pria",
  foto_cincin_wanita: "Foto Cincin Wanita",
};

const VALUE_LABELS: Record<string, string> = {
  internal: "Tukang Internal",
  external: "Tukang Eksternal",
  lolos: "Lolos",
  tidak_lolos: "Tidak Lolos",
  pickup_store: "Ambil di Toko",
  courier_local: "Kurir Lokal",
  courier_intercity: "Kurir Antar Kota",
  in_house_delivery: "Antar ke Rumah",
  delivered: "Sudah Sampai",
  dispatched: "Dalam Perjalanan",
  failed: "Gagal Dikirim",
};

function humanizeKey(key: string): string {
  return KEY_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeValue(val: string): string {
  return VALUE_LABELS[val] ?? val;
}

// ── QC Checklist renderer ─────────────────────────────────────────────────────

const CHECKLIST_LABELS: Record<string, string> = {
  bentuk_sesuai: "Bentuk cincin sesuai order",
  ukuran_sesuai: "Ukuran cincin sesuai",
  berat_minimum: "Berat memenuhi syarat minimum",
  permukaan_bersih: "Permukaan bersih, tidak ada cacat",
  solder_rapi: "Sambungan / patri rapi dan kuat",
  kualitas_laser: "Hasil laser / ukiran bersih dan terbaca",
  kualitas_finishing: "Finishing merata, tidak ada bercak",
  teks_ukiran_benar: "Teks ukiran sesuai order",
  bentuk_final_sesuai: "Bentuk final sesuai order",
  produk_bersih: "Produk bersih, siap serah terima",
};

function QcChecklistDisplay({ items }: { items: Array<{ key?: string; check_key?: string; passed: boolean }> }) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        const key = item.key ?? item.check_key ?? "";
        const label = CHECKLIST_LABELS[key] ?? humanizeKey(key);
        return (
          <div key={i} className="flex items-center gap-2">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
              item.passed ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
            }`}>
              {item.passed ? "✓" : "✗"}
            </span>
            <span className={`text-[12px] ${item.passed ? "text-cream" : "text-rose-300 font-medium"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Sub: Data viewer ──────────────────────────────────────────────────────────

function DataViewer({
  data,
  expanded,
  onToggle,
}: {
  data: Record<string, unknown>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const checklist = Array.isArray(data.quality_checklist)
    ? (data.quality_checklist as Array<{ key?: string; check_key?: string; passed: boolean }>)
    : null;

  const notes = typeof data.notes === "string" && data.notes.trim() ? data.notes.trim() : null;

  const entries = Object.entries(data).filter(
    ([k]) => !k.startsWith("_sv_") && k !== "notes" && k !== "quality_checklist",
  );

  const hasContent = checklist || notes || entries.length > 0;
  if (!hasContent) {
    return <p className="text-xs text-white/40 italic">Tidak ada data tersimpan</p>;
  }

  const preview = entries.slice(0, 3);
  const hasMore = entries.length > 3;

  return (
    <div className="space-y-2.5">
      {/* Key-value fields */}
      {entries.length > 0 && (
        <dl className="space-y-1.5">
          {(expanded ? entries : preview).map(([key, val]) => {
            const isUrl = key.endsWith("_url") && typeof val === "string" && val.length > 0;
            const isFeatures = key === "jenis_cincin_features" && Array.isArray(val) && val.length > 0;
            return (
              <div key={key} className="flex items-baseline justify-between gap-3">
                <dt className="text-[11px] text-white/40 shrink-0">{humanizeKey(key)}</dt>
                <dd className="text-[12px] font-medium text-cream text-right break-words max-w-[70%]">
                  {isUrl ? (
                    <a
                      href={val}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300 hover:bg-sky-500/20 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Buka
                    </a>
                  ) : isFeatures ? (
                    formatAddsOnList(val)
                  ) : typeof val === "string" ? (
                    humanizeValue(val)
                  ) : (
                    formatDataValue(val)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      {hasMore && (
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors min-h-[28px]"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> Sembunyikan</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> +{entries.length - 3} lainnya</>
          )}
        </button>
      )}

      {/* QC Checklist */}
      {checklist && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-1.5">
            Checklist QC
          </p>
          <QcChecklistDisplay items={checklist} />
          {checklist.some((i) => !i.passed) && (
            <p className="mt-1.5 text-[11px] font-medium text-rose-300">
              {checklist.filter((i) => !i.passed).length} item tidak lolos
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div className="rounded-md border border-amber-100 bg-amber-500/10/60 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300 mb-0.5">Catatan</p>
          <p className="text-[12px] text-cream">{notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Sub: Work order ring specs ────────────────────────────────────────────────

function WorkOrderCard({ wo }: { wo: WorkOrder }) {
  const [open, setOpen] = useState(false);

  const hasPria = wo.ukuran_pria || wo.jenis_cincin_pria || wo.ukiran_pria || wo.gramasi_pria != null;
  const hasWanita = wo.ukuran_wanita || wo.jenis_cincin_wanita || wo.ukiran_wanita || wo.gramasi_wanita != null;

  return (
    <div className="rounded-lg border border-gold/15 bg-[#26211c] overflow-hidden mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-white/5/10 transition-colors"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
          Spesifikasi Cincin · {wo.cs_order_number}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-white/40" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-white/40" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-gold/15 pt-2.5">
          {hasPria && (
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase mb-1">Pria</p>
              <dl className="space-y-1">
                {wo.ukuran_pria && (
                  <div className="flex justify-between">
                    <dt className="text-[11px] text-white/50">Ukuran</dt>
                    <dd className="text-[11px] font-semibold text-cream">{wo.ukuran_pria}</dd>
                  </div>
                )}
                {wo.jenis_cincin_pria && (
                  <div className="flex justify-between">
                    <dt className="text-[11px] text-white/50">Jenis</dt>
                    <dd className="text-[11px] font-semibold text-cream text-right max-w-[60%] break-words">{wo.jenis_cincin_pria}</dd>
                  </div>
                )}
                {wo.gramasi_pria != null && (
                  <div className="flex justify-between">
                    <dt className="text-[11px] text-white/50">Gramasi</dt>
                    <dd className="text-[11px] font-semibold text-cream">{wo.gramasi_pria} g</dd>
                  </div>
                )}
                {wo.ukiran_pria && (
                  <div className="flex justify-between">
                    <dt className="text-[11px] text-white/50">Ukiran</dt>
                    <dd className="text-[11px] font-semibold text-cream text-right max-w-[55%]">{wo.ukiran_pria}</dd>
                  </div>
                )}
                {wo.keterangan_pria && (
                  <div className="flex justify-between">
                    <dt className="text-[11px] text-white/50">Ket.</dt>
                    <dd className="text-[11px] text-white/70 text-right max-w-[60%]">
                      {Array.isArray(wo.keterangan_pria) ? wo.keterangan_pria.join(", ") : wo.keterangan_pria}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {hasWanita && (
            <div>
              <p className="text-[10px] font-semibold text-white/40 uppercase mb-1">Wanita</p>
              <dl className="space-y-1">
                {wo.ukuran_wanita && (
                  <div className="flex justify-between">
                    <dt className="text-[11px] text-white/50">Ukuran</dt>
                    <dd className="text-[11px] font-semibold text-cream">{wo.ukuran_wanita}</dd>
                  </div>
                )}
                {wo.jenis_cincin_wanita && (
                  <div className="flex justify-between">
                    <dt className="text-[11px] text-white/50">Jenis</dt>
                    <dd className="text-[11px] font-semibold text-cream text-right max-w-[60%] break-words">{wo.jenis_cincin_wanita}</dd>
                  </div>
                )}
                {wo.gramasi_wanita != null && (
                  <div className="flex justify-between">
                    <dt className="text-[11px] text-white/50">Gramasi</dt>
                    <dd className="text-[11px] font-semibold text-cream">{wo.gramasi_wanita} g</dd>
                  </div>
                )}
                {wo.ukiran_wanita && (
                  <div className="flex justify-between">
                    <dt className="text-[11px] text-white/50">Ukiran</dt>
                    <dd className="text-[11px] font-semibold text-cream text-right max-w-[55%]">{wo.ukiran_wanita}</dd>
                  </div>
                )}
                {wo.keterangan_wanita && (
                  <div className="flex justify-between">
                    <dt className="text-[11px] text-white/50">Ket.</dt>
                    <dd className="text-[11px] text-white/70 text-right max-w-[60%]">
                      {Array.isArray(wo.keterangan_wanita) ? wo.keterangan_wanita.join(", ") : wo.keterangan_wanita}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {(wo.font || wo.laser_position) && (
            <div className="flex gap-3">
              {wo.font && (
                <div>
                  <p className="text-[10px] text-white/40">Font</p>
                  <p className="text-[11px] font-semibold text-cream">{wo.font}</p>
                </div>
              )}
              {wo.laser_position && (
                <div>
                  <p className="text-[10px] text-white/40">Posisi Laser</p>
                  <p className="text-[11px] font-semibold text-cream">{wo.laser_position}</p>
                </div>
              )}
            </div>
          )}

          {(wo.reference_image_pria_url || wo.reference_image_wanita_url) && (
            <div className="flex gap-2">
              {wo.reference_image_pria_url && (
                <a
                  href={wo.reference_image_pria_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-1/2 rounded border border-gold/15 bg-cocoa px-2 py-1 text-center text-[10px] font-medium text-sky-300 hover:bg-sky-500/10 transition-colors"
                >
                  Referensi Pria ↗
                </a>
              )}
              {wo.reference_image_wanita_url && (
                <a
                  href={wo.reference_image_wanita_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-1/2 rounded border border-gold/15 bg-cocoa px-2 py-1 text-center text-[10px] font-medium text-sky-300 hover:bg-sky-500/10 transition-colors"
                >
                  Referensi Wanita ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub: Pending card ─────────────────────────────────────────────────────────

function PendingCard({
  item,
  onApprove,
  onReject,
  onCancel,
}: {
  item: PendingItem;
  onApprove: (
    stageResultId: string | null,
    orderId: string,
    stage: string,
  ) => Promise<void>;
  onReject: (
    stageResultId: string | null,
    orderId: string,
    stage: string,
    notes: string,
    reworkStage?: string,
  ) => Promise<void>;
  onCancel: (orderId: string, stage: string, reason: string) => Promise<void>;
}) {
  const [state, setState] = useState<ActionState>({ type: "idle" });
  const [rejectNotes, setRejectNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [reworkStage, setReworkStage] = useState("");
  const [dataExpanded, setDataExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const isQCStage = item.stage === "approval_qc_1" || item.stage === "approval_qc_2";
  const isIntakeApproval = item.stage === "approval_penerimaan_order";
  const qcReworkOptions: { value: string; label: string }[] = [];
  if (item.stage === "approval_qc_1") {
    qcReworkOptions.push(
      { value: "pembentukan_cincin", label: "Pembentukan Cincin" },
      { value: "pemolesan", label: "Pemolesan" },
      { value: "pemasangan_permata", label: "Micro Setting" },
      { value: "cek_kadar", label: "Cek Kadar" },
    );
  } else if (item.stage === "approval_qc_2") {
    qcReworkOptions.push(
      { value: "finishing", label: "Finishing" },
      { value: "pembentukan_cincin", label: "Pembentukan Cincin" },
    );
  }

  const isProduction = item.stage_group === "production";

  const handleApprove = async () => {
    setState({ type: "loading" });
    try {
      await onApprove(item.stage_result_id, item.order_id, item.stage);
      setState({
        type: "done",
        result: "approved",
        message: "Disetujui — order maju ke tahap berikutnya",
      });
    } catch (err) {
      setState({ type: "idle" });
      alert(err instanceof Error ? err.message : "Gagal menyetujui");
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectNotes.trim()) return;
    if (isQCStage && !reworkStage) return;
    setState({ type: "loading" });
    try {
      await onReject(
        item.stage_result_id,
        item.order_id,
        item.stage,
        rejectNotes,
        reworkStage || undefined,
      );
      setState({
        type: "done",
        result: "rejected",
        message: `Ditolak — dikembalikan ke ${qcReworkOptions.find(o => o.value === reworkStage)?.label || reworkStage}`,
      });
    } catch (err) {
      setState({ type: "idle" });
      alert(err instanceof Error ? err.message : "Gagal menolak");
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim()) return;
    setState({ type: "loading" });
    try {
      await onCancel(item.order_id, item.stage, cancelReason);
      setState({
        type: "done",
        result: "cancelled",
        message: "Dibatalkan — order tidak masuk workshop",
      });
    } catch (err) {
      setState({ type: "idle" });
      alert(err instanceof Error ? err.message : "Gagal membatalkan");
    }
  };

  if (state.type === "done") {
    return (
      <div
        className={`rounded-lg border p-3 sm:p-4 transition-all ${
          state.result === "approved"
            ? "border-emerald-400/20 bg-emerald-500/10"
            : state.result === "cancelled"
              ? "border-amber-400/20 bg-amber-500/10"
              : "border-rose-400/20 bg-rose-500/10"
        }`}
      >
        <div className="flex items-center gap-2">
          {state.result === "approved" ? (
            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-300 flex-shrink-0" />
          ) : state.result === "cancelled" ? (
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300 flex-shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white/50 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-cream truncate">
            {item.order_number} — {item.stage_label}
          </span>
        </div>
        <p className="mt-1 text-xs text-white/50">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gold/15 bg-cocoa shadow-sm overflow-hidden">
      {/* Stage group accent bar */}
      <div
        className={`h-1 w-full ${
          isProduction ? "bg-amber-400" : "bg-blue-400"
        }`}
      />

      <div className="p-3 sm:p-5">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="font-mono text-[13px] font-semibold text-white/50">
                #{item.order_number}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  isProduction
                    ? "bg-amber-500/10 text-amber-800 border-amber-400/20"
                    : "bg-sky-500/20 text-blue-800 border-sky-400/20"
                }`}
              >
                {item.stage_label}
              </span>
              {(item.attempt_number ?? 0) > 1 && (
                <span className="rounded-full bg-rose-500/10 border border-rose-400/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                  Attempt #{item.attempt_number}
                </span>
              )}
            </div>
            <p className="text-[15px] font-semibold text-cream leading-snug">
              {item.product_name}
            </p>
            <p className="text-[12px] text-white/40 mt-0.5">{item.customer_name}</p>
          </div>
          <div className="sm:text-right shrink-0">
            <p className="text-[12px] font-medium text-cream">{item.worker_name}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{formatRelative(item.submitted_at)}</p>
          </div>
        </div>

        {/* Ring specs from cs_order */}
        {item.work_order && <WorkOrderCard wo={item.work_order} />}

        {/* Submitted data */}
        <div className="rounded-lg bg-[#26211c] border border-gold/10 px-3 py-2.5 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
              Data disubmit
            </p>
            <button
              onClick={() => setShowInfo(true)}
              className="flex items-center gap-1 rounded-full border border-amber-400/20 bg-cocoa px-2 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-500/100/10 transition-colors"
            >
              <AlertTriangle className="h-3 w-3" />
              Panduan Verifikasi
            </button>
          </div>
          <DataViewer
            data={item.data ?? {}}
            expanded={dataExpanded}
            onToggle={() => setDataExpanded((v) => !v)}
          />
        </div>

        {/* Actions */}
        {state.type === "idle" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setState({ type: "confirming_approve" })}
              className="flex-1 rounded-lg bg-emerald-600 py-3 sm:py-2.5 text-sm font-medium text-white transition-all hover:bg-emerald-700 active:scale-[0.98] min-h-[44px]"
            >
              Setujui
            </button>
            <button
              onClick={() => setState({ type: "confirming_reject" })}
              className="flex-1 rounded-lg border border-rose-400/20 bg-cocoa py-3 sm:py-2.5 text-sm font-medium text-rose-300 transition-all hover:bg-rose-500/10 active:scale-[0.98] min-h-[44px]"
            >
              Tolak
            </button>
            {isIntakeApproval && (
            <button
              onClick={() => setState({ type: "confirming_cancel" })}
              className="flex-1 rounded-lg border border-amber-400/20 bg-cocoa py-3 sm:py-2.5 text-sm font-medium text-amber-300 transition-all hover:bg-amber-500/10 active:scale-[0.98] min-h-[44px]"
            >
              Batalkan
            </button>
            )}
          </div>
        )}

        {state.type === "confirming_approve" && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 space-y-3">
            <p className="text-sm text-amber-800">
              Setujui tahap ini? Order akan maju ke tahap berikutnya dan tidak dapat dikembalikan.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleApprove}
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white transition-all hover:bg-emerald-700 active:scale-[0.98]"
              >
                Ya, Setujui
              </button>
              <button
                onClick={() => setState({ type: "idle" })}
                className="flex-1 rounded-lg border border-gold/15 bg-cocoa py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-[#26211c] active:scale-[0.98]"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {state.type === "confirming_reject" && (
          <div className="space-y-2">
            {isQCStage && (
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1">Tujuan Rework</label>
                <select
                  value={reworkStage}
                  onChange={(e) => setReworkStage(e.target.value)}
                  className="w-full rounded-lg border border-rose-400/20 bg-cocoa px-3 py-2 text-sm text-cream focus:outline-none focus:ring-2 focus:ring-rose-400/20"
                >
                  <option value="">Pilih tahap rework</option>
                  {qcReworkOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Alasan penolakan (wajib diisi)..."
              rows={3}
              autoFocus
              className="w-full rounded-lg border border-rose-400/20 bg-rose-500/10/40 px-3 py-2.5 text-sm text-cream placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-rose-400/20 resize-none"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectNotes.trim() || (isQCStage && !reworkStage)}
                className="flex-1 rounded-lg bg-rose-600 py-3 sm:py-2.5 text-sm font-medium text-white transition-all hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                Konfirmasi Tolak
              </button>
              <button
                onClick={() => {
                  setState({ type: "idle" });
                  setRejectNotes("");
                  setReworkStage("");
                }}
                className="rounded-lg border border-gold/15 bg-cocoa px-4 py-3 sm:py-2 text-sm text-white/70 hover:bg-[#26211c] min-h-[44px]"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {state.type === "confirming_cancel" && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 space-y-3">
            <p className="text-sm text-amber-200">
              Batalkan order ini? Order akan ditandai selesai dan tidak masuk ke workshop. Pastikan sudah ada konfirmasi dari customer.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Alasan pembatalan (wajib diisi)..."
              rows={2}
              autoFocus
              className="w-full rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2.5 text-sm text-cream placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/20 resize-none"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCancelConfirm}
                disabled={!cancelReason.trim()}
                className="flex-1 rounded-lg bg-amber-600 py-3 sm:py-2.5 text-sm font-medium text-white transition-all hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
              >
                Konfirmasi Batalkan
              </button>
              <button
                onClick={() => {
                  setState({ type: "idle" });
                  setCancelReason("");
                }}
                className="rounded-lg border border-gold/15 bg-cocoa px-4 py-3 sm:py-2 text-sm text-white/70 hover:bg-white/5 min-h-[44px]"
              >
                Kembali
              </button>
            </div>
          </div>
        )}

        {state.type === "loading" && (
          <div className="flex items-center justify-center py-3">
            <RefreshCw className="h-4 w-4 animate-spin text-white/40" />
            <span className="ml-2 text-sm text-white/50">Memproses...</span>
          </div>
        )}

        {showInfo && (
          <StageInfoPopup
            stage={item.stage}
            orderData={{
              order_number: item.order_number,
              product_name: item.product_name,
              customer_name: item.customer_name,
            }}
            stageData={item.data}
            onClose={() => setShowInfo(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type FilterTab = string;

export default function SupervisorApprovalPage() {
  const { access, isResolved: accessResolved, userEmail } = useSupervisorPageAccess();
  const [filter, setFilter] = useState<FilterTab>(
    () => access?.defaultApprovalFilter ?? "approval_penerimaan_order",
  );
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const supervisorGroup = access?.supervisorGroup ?? "all";
  const canValidateIntake = access?.canValidateIntake ?? false;
  const canAccessPending = access?.canAccessPending ?? false;
  const isCustomerServiceSupervisor = access?.isCustomerServiceSupervisor ?? false;

  useEffect(() => {
    if (access) setFilter(access.defaultApprovalFilter);
  }, [access]);

  const [refetchInterval, setRefetchInterval] = useState<number | false>(30_000);

  const {
    data: pendingPages,
    isLoading: loading,
    error,
    refetch,
    hasNextPage: hasNextPendingPage,
    fetchNextPage: fetchNextPendingPage,
    isFetchingNextPage: isFetchingNextPendingPage,
  } = useInfiniteQuery({
    queryKey: ["supervisor", "pending", access?.roleName, brandFilter],
    queryFn: ({ pageParam }) => fetcher<PendingPage<PendingItem>>(
      `/api/supervisor/pending?brand=${brandFilter}&limit=50&offset=${pageParam}`,
    ),
    initialPageParam: 0,
    getNextPageParam: (page) => page.next_offset,
    enabled: accessResolved && canAccessPending,
    refetchInterval,
  });
  const items = pendingPages?.pages.flatMap((page) => page.data) ?? [];

  const {
    data: intakePages,
    isLoading: intakeLoading,
    error: intakeError,
    refetch: refetchIntake,
    hasNextPage: hasNextIntakePage,
    fetchNextPage: fetchNextIntakePage,
    isFetchingNextPage: isFetchingNextIntakePage,
  } = useInfiniteQuery({
    queryKey: ["intake", "pending", access?.roleName, brandFilter],
    queryFn: ({ pageParam }) => fetcher<PendingPage<IntakeItem>>(
      `/api/intake/pending?brand=${brandFilter}&limit=50&offset=${pageParam}`,
    ),
    initialPageParam: 0,
    getNextPageParam: (page) => page.next_offset,
    enabled: accessResolved && canValidateIntake,
    refetchInterval: 30_000,
  });
  const intakeItems = intakePages?.pages.flatMap((page) => page.data) ?? [];

  useEffect(() => {
    if (!accessResolved) return;
    let channel: import("pusher-js").Channel | null = null;

    (async () => {
      try {
        const meRes = await fetch("/api/me");
        if (!meRes.ok) return;
        const meJson = await meRes.json();
        const userId = meJson.data?.id;
        if (!userId) return;

        const { default: Pusher } = await import("pusher-js");
        const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          authEndpoint: "/api/pusher/auth",
        });

        pusher.connection.bind("state_change", (states: { current: string }) => {
          setRefetchInterval(states.current === "connected" ? false : 30_000);
        });

        channel = pusher.subscribe(`private-user-${userId}`);
        channel.bind("new-notification", () => {
          if (canAccessPending) refetch();
          if (canValidateIntake) refetchIntake();
        });
      } catch {
        // Pusher failed — polling fallback via refetchInterval
      }
    })();

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [accessResolved, canAccessPending, canValidateIntake, refetch, refetchIntake]);

  const fetchPending = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    await Promise.all([
      canAccessPending ? refetch() : Promise.resolve(),
      canValidateIntake ? refetchIntake() : Promise.resolve(),
    ]);
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [canAccessPending, canValidateIntake, refetch, refetchIntake]);

  const handleIntakeDecision = useCallback(async (
    orderId: string,
    action: "approve" | "return" | "reject",
    reason?: string,
  ) => {
    const response = await fetch(`/api/intake/${orderId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Gagal memproses intake");
    await Promise.all([
      canAccessPending ? refetch() : Promise.resolve(),
      refetchIntake(),
    ]);
  }, [canAccessPending, refetch, refetchIntake]);

  const handleApprove = useCallback(
    async (stageResultId: string | null, orderId: string, stage: string) => {
      const res = await fetch("/api/supervisor/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage_result_id: stageResultId,
          order_id: orderId,
          stage,
          action: "approve",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyetujui");
      refetch();
    },
    [refetch],
  );

  const handleReject = useCallback(
    async (
      stageResultId: string | null,
      orderId: string,
      stage: string,
      notes: string,
      reworkStage?: string,
    ) => {
      const body: Record<string, unknown> = {
        stage_result_id: stageResultId,
        order_id: orderId,
        stage,
        action: "reject",
        remarks: notes,
      };
      if (reworkStage) body.rework_stage = reworkStage;
      const res = await fetch("/api/supervisor/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menolak");
      refetch();
    },
    [refetch],
  );

  const handleCancel = useCallback(
    async (orderId: string, stage: string, reason: string) => {
      const res = await fetch("/api/supervisor/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          stage,
          action: "cancel",
          remarks: reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membatalkan");
      refetch();
    },
    [refetch],
  );

  if (!accessResolved) {
    return (
      <SupervisorPageLoading
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onMenuClick={() => setSidebarOpen(true)}
        userEmail={userEmail}
      />
    );
  }

  // Per-stage tabs based on supervisor group
  const OPERATIONAL_APPROVAL_STAGES = STAGE_SEQUENCE.filter(
    (s) => s.startsWith("approval_") && s !== "approval_produksi",
  );
  const stageTabs: { key: string; label: string; count: number }[] = isCustomerServiceSupervisor
    ? []
    : (
    supervisorGroup === "production"
      ? ["approval_produksi"]
      : OPERATIONAL_APPROVAL_STAGES
  ).map((stage) => ({
    key: stage,
    label: getStageLabel(stage).replace("Approval ", ""),
    count: items.filter((i) => i.stage === stage).length,
  }));
  if (canValidateIntake && !isCustomerServiceSupervisor) {
    stageTabs.unshift({
      key: "intake_validation",
      label: "Validasi CS",
      count: intakeItems.length,
    });
  }

  // Auto-select first tab if current filter doesn't match any
  if (filter !== "all" && !stageTabs.some((t) => t.key === filter)) {
    setFilter(stageTabs[0]?.key ?? "all");
  }

  const filteredItems = (stageTabs.some((t) => t.key === filter)
    ? items.filter((item) => item.stage === filter)
    : items).filter((item) =>
      brandFilter === "all"
        ? true
        : getBrandFilterCode(item.order_number) === brandFilter,
    );
  const isIntakeTab = isCustomerServiceSupervisor || filter === "intake_validation";
  const scopedIntakeItems = isCustomerServiceSupervisor
    ? intakeItems.filter((item) => item.legacy_orders?.id_brand === 3)
    : intakeItems;
  const filteredIntakeItems = scopedIntakeItems.filter((item) =>
    brandFilter === "all" || getBrandCode(item.legacy_orders?.id_brand) === brandFilter,
  );

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalWaiting = isIntakeTab ? filteredIntakeItems.length : items.length;
  const oldestWaiting = isIntakeTab && filteredIntakeItems.length > 0
    ? Math.max(...filteredIntakeItems.map((i) => new Date(i.updated_at).getTime()), 0)
    : items.length > 0
      ? Math.max(...items.map((i) => new Date(i.waiting_since).getTime()), 0)
    : 0;
  const oldestWaitingHours = oldestWaiting
    ? Math.round((Date.now() - oldestWaiting) / 36e5)
    : 0;

  const allTabs: {
    key: string;
    label: string;
    icon: React.ElementType;
    count: number;
  }[] = stageTabs.map((t) => ({
    key: t.key,
    label: t.label,
    icon: Clock,
    count: t.count,
  }));

  const tabs = allTabs;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#26211c]">
      {/* Sidebar */}
      <Sidebar
        role="supervisor"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userEmail={userEmail}
          role="supervisor"
          logoutPath="/workshop/login"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {/* Page header */}
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-ivory">
                  {isCustomerServiceSupervisor ? "Validasi Order MPM" : "Persetujuan Tahap"}
                </h2>
                {supervisorGroup === "production" && (
                  <span className="rounded-full bg-amber-500/10 border border-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Supervisor Produksi
                  </span>
                )}
                {supervisorGroup === "operational" && (
                  <span className="rounded-full bg-sky-500/20 border border-sky-400/20 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
                    Supervisor Operasional
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-white/50 mt-0.5">
                {isCustomerServiceSupervisor
                  ? "Validasi order sebelum masuk penerimaan order"
                  : "Review dan setujui hasil kerja tim"}
              </p>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2">
              {lastUpdated && (
                <span className="text-[10px] sm:text-xs text-white/40">
                  {lastUpdated.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
              <button
                onClick={() => fetchPending(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/15 bg-cocoa px-3 py-2 sm:py-1.5 text-xs font-medium text-cream shadow-sm transition hover:bg-[#26211c] disabled:opacity-60 min-h-[36px] sm:min-h-0"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {loading || intakeLoading ? (
            <ApprovalSkeleton />
          ) : error || intakeError ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
              <AlertTriangle className="mb-3 h-8 w-8 text-rose-400" />
              <p className="text-sm font-medium text-cream">
                {error instanceof Error
                  ? error.message
                  : intakeError instanceof Error
                    ? intakeError.message
                    : "Terjadi kesalahan"}
              </p>
              <button
                onClick={() => fetchPending(true)}
                className="mt-4 rounded-md border border-gold/15 bg-cocoa px-4 py-2.5 text-sm text-cream hover:bg-[#26211c] min-h-[44px]"
              >
                Coba lagi
              </button>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <InfoCard
                  label={isCustomerServiceSupervisor ? "Menunggu Validasi MPM" : "Total Menunggu"}
                  value={totalWaiting}
                  icon={Clock}
                  tone={totalWaiting > 0 ? "amber" : "emerald"}
                />
                {!isCustomerServiceSupervisor && stageTabs.slice(0, 2).map((t) => (
                  <InfoCard
                    key={t.key}
                    label={t.label}
                    value={t.count}
                    icon={Clock}
                    tone={t.count > 0 ? "amber" : "emerald"}
                  />
                ))}
                <InfoCard
                  label="Paling Lama"
                  value={oldestWaitingHours > 0 ? `${oldestWaitingHours}j` : "—"}
                  subtitle="Menunggu aktif"
                  icon={AlertTriangle}
                  tone={oldestWaitingHours > 24 ? "rose" : oldestWaitingHours > 8 ? "amber" : "emerald"}
                />
                <InfoCard
                  label="Terbaru"
                  value={isIntakeTab
                    ? filteredIntakeItems.length > 0
                      ? new Date(filteredIntakeItems[0].updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                      : "—"
                    : items.length > 0
                      ? new Date(items[0].waiting_since).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                      : "—"}
                  subtitle={isIntakeTab ? "Validasi" : "Submission"}
                  icon={CheckCircle2}
                  tone="slate"
                />
              </div>

              {tabs.length > 0 && (
                <div className="border-b border-gold/15 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                  <div className="flex items-center gap-1 min-w-max">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setFilter(tab.key)}
                          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                            filter === tab.key
                              ? "border-gold text-ivory"
                              : "border-transparent text-white/50 hover:text-cream"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{tab.label}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              filter === tab.key
                                ? "bg-gold text-night"
                                : tab.count > 0
                                  ? "bg-white/10 text-cream"
                                  : "bg-carbon text-white/40"
                            }`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Brand filter */}
              <div className="flex items-center gap-2 pt-3">
                <span className="text-xs text-white/50">Brand:</span>
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-gold/25 rounded-lg bg-carbon text-cream focus:ring-2 focus:ring-gold/30 outline-none"
                >
                  <option value="all">Semua Brand</option>
                  {BRAND_FILTER_OPTIONS.map((brand) => (
                    <option key={brand.value} value={brand.value}>{brand.label}</option>
                  ))}
                </select>
              </div>

              {/* Cards */}
              {(isIntakeTab ? filteredIntakeItems : filteredItems).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
                  <div className="mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-500/10">
                    <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-cream">
                    {isCustomerServiceSupervisor
                      ? "Semua intake MPM sudah diproses"
                      : isIntakeTab ? "Semua intake sudah diproses" : "Semua submission sudah diproses"}
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Tidak ada yang menunggu persetujuan di kategori ini
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {isIntakeTab
                    ? filteredIntakeItems.map((item) => (
                      <IntakeCard key={item.id} item={item} onDecision={handleIntakeDecision} />
                    ))
                    : filteredItems.map((item) => (
                      <PendingCard
                        key={`${item.order_id}_${item.stage}`}
                        item={item}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onCancel={handleCancel}
                      />
                    ))}
                </div>
              )}
              {(isIntakeTab ? hasNextIntakePage : hasNextPendingPage) && (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => isIntakeTab ? fetchNextIntakePage() : fetchNextPendingPage()}
                    disabled={isIntakeTab ? isFetchingNextIntakePage : isFetchingNextPendingPage}
                    className="rounded-md border border-gold/15 bg-cocoa px-4 py-2 text-xs font-medium text-cream transition hover:bg-[#26211c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {(isIntakeTab ? isFetchingNextIntakePage : isFetchingNextPendingPage)
                      ? "Memuat order..."
                      : "Muat lebih banyak"}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  tone: "slate" | "rose" | "amber" | "emerald";
}) {
  const toneMap = {
    slate: { bg: "bg-[#26211c]", icon: "text-white/50", ring: "ring-white/10" },
    rose: { bg: "bg-rose-500/10", icon: "text-rose-300", ring: "ring-rose-400/20" },
    amber: { bg: "bg-amber-500/10", icon: "text-amber-300", ring: "ring-amber-400/20" },
    emerald: { bg: "bg-emerald-500/10", icon: "text-emerald-300", ring: "ring-emerald-400/20" },
  };
  const t = toneMap[tone];
  return (
    <div className="rounded-lg border border-gold/15 bg-cocoa p-3 sm:p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-white/50">
            {label}
          </p>
          <p className="mt-1 sm:mt-2 text-xl sm:text-2xl font-semibold tabular-nums text-ivory">
            {value}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-[10px] sm:text-xs text-white/40">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${t.bg} ${t.ring} ml-2`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${t.icon}`} />
        </div>
      </div>
    </div>
  );
}

function ApprovalSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-48 sm:h-56 animate-pulse rounded-lg border border-gold/15 bg-cocoa"
        />
      ))}
    </div>
  );
}
