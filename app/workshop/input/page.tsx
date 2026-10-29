// app/workshop/input/page.tsx

"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/navigation";
import BrandHeader from "@/components/qr/BrandHeader";
import StageInputForm from "@/components/qr/StageInputForm";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  X,
  AlertTriangle,
  Key,
  Search,
  ClipboardList,
} from "lucide-react";
import { formatAddsOnList } from "@/lib/adds-on";
import { getStageDeadlineStatus } from "@/lib/stage-deadlines";
import { getBrandFilterCode } from "@/lib/legacy/brands";
import type { Field } from "@/components/fields/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  role: {
    name: string;
    role_group: string;
    permissions: Record<string, boolean>;
    allowed_stages: string[];
  };
}

interface WorkshopOrderInfo {
  id: string;
  order_number: string;
  current_stage: string;
  status: string;
  deadline: string | null;
  tgl_order: string | null;
  updated_at: string | null;
  customer_name: string | null;
  proses_produksi: string | null;
}

interface WorkshopOrdersPage {
  data: WorkshopOrderInfo[];
  total: number;
  next_offset: number | null;
}

interface WorkshopWorkOrder {
  deadline: string | null;
  customer_name: string | null;
  customer_wa: string | null;
  customer_email: string | null;
  produk_nama: string | null;
  produk_sku: string | null;
  produk_spesifikasi: string | null;
  catatan: string | null;
  acara: string | null;
  kebutuhan_acara: string | null;
  kategori: string | null;
  transfer_ke_bank: string | null;
  jenis_cincin_features: string[] | null;
  dari_artis_detail: string | null;
  alat_ukur: string | null;
  gramasi_pria: number | null;
  gramasi_wanita: number | null;
  ukiran_cincin_pria: string | null;
  ukiran_cincin_wanita: string | null;
  harga: number | null;
  dp_amount: number | null;
  pengiriman: string | null;
  alamat_pengiriman: string | null;
  box: string | null;
  font: string | null;
  laser_position: string | null;
  pria: {
    ukuran: string | null;
    ukiran: string | null;
    jenis_cincin: string | null;
    model_bentuk: string[] | null;
    microsetting: string[] | null;
    detail_laser: string[] | null;
    detail_finishing: string[] | null;
    keterangan: string | null;
    reference_image_url: string | null;
  } | null;
  wanita: {
    ukuran: string | null;
    ukiran: string | null;
    jenis_cincin: string | null;
    model_bentuk: string[] | null;
    microsetting: string[] | null;
    detail_laser: string[] | null;
    detail_finishing: string[] | null;
    keterangan: string | null;
    reference_image_url: string | null;
  } | null;
}

interface FormConfig {
  stage: string;
  stage_type?: string;
  stage_label: string;
  fields: Field[];
  permissions: { can_submit: boolean; can_edit: boolean; can_reject: boolean };
  current_data?: Record<string, unknown>;
  work_order?: WorkshopWorkOrder;
  konfirmasi_info?: { tanggal_packing?: string; nomor_resi?: string } | null;
}

interface OrderDetailData {
  customer_name: string | null;
  tgl_order: string | null;
  tgl_acara: string | null;
  deadline: string | null;
  kategori: string | null;
  acara: string | null;
  jenis_cincin_features: string[] | null;
  gramasi_pria: number | null;
  ukuran_pria: string | null;
  jenis_cincin_pria: string | null;
  ukiran_pria: string | null;
  ukiran_cincin_pria: string | null;
  model_bentuk_pria: string[] | null;
  microsetting_pria: string[] | null;
  detail_laser_pria: string[] | null;
  detail_finishing_pria: string[] | null;
  gramasi_wanita: number | null;
  ukuran_wanita: string | null;
  jenis_cincin_wanita: string | null;
  ukiran_wanita: string | null;
  ukiran_cincin_wanita: string | null;
  model_bentuk_wanita: string[] | null;
  microsetting_wanita: string[] | null;
  detail_laser_wanita: string[] | null;
  detail_finishing_wanita: string[] | null;
  font: string | null;
  laser_position: string | null;
  pengiriman: string | null;
  box: string | null;
  dari_artis_detail: string | null;
}

interface WorkerHistoryItem {
  id: string;
  order_id: string;
  order_number: string;
  stage_label: string;
  stage: string;
  started_at: string;
  finished_at: string | null;
  data: Record<string, unknown>;
  notes?: string | null;
  user_id?: string;
  attempt_number?: number;
}

type Phase = "loading" | "list" | "form" | "success";

// ── Constants ─────────────────────────────────────────────────────────────────

// Fallback only — authoritative stages come from DB via allowed_stages
const ROLE_STAGE_MAP: Record<string, string[]> = {
  customer_care: ["konfirmasi"],
};

const WORKSHOP_ORDERS_PAGE_SIZE = 50;

const STAGE_LABELS: Record<string, string> = {
  penerimaan_order: "Penerimaan Order",
  approval_penerimaan_order: "Approval Penerimaan Order",
  racik_bahan: "Persiapan Bahan",
  approval_racik_bahan: "Approval Persiapan Bahan",
  lebur_bahan: "Lebur Bahan",
  pembentukan_cincin: "Pembentukan Cincin",
  cek_kadar: "Cek Kadar",
  pemasangan_permata: "Micro Setting",
  pemolesan: "Pemolesan Awal",
  qc_1: "Quality Control Awal",
  approval_qc_1: "Approval QC Awal",
  laser: "Laser Engraving",
  finishing: "Finishing",
  approval_produksi: "Approval Produksi",
  qc_2: "Quality Control Akhir",
  approval_qc_2: "Approval QC Akhir",
  konfirmasi: "Konfirmasi Customer Care",
  packing: "Packing & Persiapan Kirim",
  pengiriman: "Pengiriman",
  selesai: "Selesai",
};

// ── Theming ───────────────────────────────────────────────────────────────────

const GROUP_THEME = {
  production: {
    card: "border-amber-200 bg-amber-50/70",
    label: "text-amber-600/70",
    badge: "bg-amber-100 text-amber-800",
    btn: "bg-amber-600 hover:bg-amber-700 active:bg-amber-800",
    ring: "focus:ring-amber-100 focus:border-amber-400",
    spinner: "border-t-amber-500",
    rework: "bg-orange-50 border-orange-200",
  },
  operational: {
    card: "border-blue-200 bg-blue-50/70",
    label: "text-blue-600/70",
    badge: "bg-blue-100 text-blue-800",
    btn: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
    ring: "focus:ring-blue-100 focus:border-blue-400",
    spinner: "border-t-blue-500",
    rework: "bg-orange-50 border-orange-200",
  },
  default: {
    card: "border-stone-200 bg-stone-50/70",
    label: "text-stone-500",
    badge: "bg-stone-100 text-stone-700",
    btn: "bg-stone-700 hover:bg-stone-800 active:bg-stone-900",
    ring: "focus:ring-stone-100 focus:border-stone-400",
    spinner: "border-t-stone-500",
    rework: "bg-orange-50 border-orange-200",
  },
} as const;

type Theme = (typeof GROUP_THEME)[keyof typeof GROUP_THEME];

function getTheme(roleGroup: string): Theme {
  if (roleGroup === "production") return GROUP_THEME.production;
  if (roleGroup === "operational") return GROUP_THEME.operational;
  return GROUP_THEME.default;
}

function _inputCls(theme: Theme) {
  return `w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2.5 px-3.5 text-[14px] text-stone-700 placeholder:text-stone-300 focus:bg-white focus:outline-none focus:ring-2 transition-all ${theme.ring}`;
}

function _FieldRow({
  label,
  theme,
  children,
}: {
  label: string;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={`block text-[11px] font-medium mb-1 ${theme.label}`}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SpinIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

// ── Phase: Loading ────────────────────────────────────────────────────────────

function PhaseLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="h-10 w-10 rounded-full border-2 border-stone-200 border-t-amber-500 animate-spin" />
      <p className="text-[13px] text-stone-400">Memuat profil...</p>
    </div>
  );
}

// ── Phase: Order List ─────────────────────────────────────────────────────────

function PhaseOrderList({
  user,
  theme,
  search,
  sortBy,
  brandFilter,
  onSelect,
  _onLogout,
}: {
  user: UserProfile;
  theme: Theme;
  search: string;
  sortBy: "newest" | "deadline";
  brandFilter: string;
  onSelect: (order: WorkshopOrderInfo) => Promise<void>;
  _onLogout: () => void;
}) {
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const {
    data: orderPages,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: fetchError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["workshop-orders", debouncedSearch],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(WORKSHOP_ORDERS_PAGE_SIZE),
        offset: String(pageParam),
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      return fetcher<WorkshopOrdersPage>(`/api/workshop/orders?${params}`);
    },
    getNextPageParam: (lastPage) => lastPage.next_offset,
  });

  const orders = orderPages?.pages.flatMap((page) => page.data) ?? [];
  const totalOrders = orderPages?.pages[0]?.total ?? 0;

  const roleStages = (
    user.role.allowed_stages.length > 0
      ? user.role.allowed_stages
      : (ROLE_STAGE_MAP[user.role.name] ?? [])
  ).filter((s) => s !== "penerimaan_order" && !s.startsWith("approval_"));

  const _roleLabel =
    roleStages.map((s) => STAGE_LABELS[s] ?? s).join(", ") || user.role.name;

  const displayOrders = orders
    .filter(
      (o) =>
        (roleStages.length === 0 || roleStages.includes(o.current_stage)) &&
        o.status !== "completed" &&
        o.status !== "cancelled" &&
        o.status !== "waiting_approval" &&
        (brandFilter === "all" || getBrandFilterCode(o.order_number) === brandFilter),
    )
    .sort((a, b) => {
      if (sortBy === "deadline") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return 0;
    });

  const handleSelect = async (order: WorkshopOrderInfo) => {
    setSelectingId(order.id);
    setSelectError(null);
    try {
      await onSelect(order);
    } catch (err) {
      setSelectError(
        err instanceof Error ? err.message : "Gagal membuka order",
      );
      setSelectingId(null);
    }
  };

  function formatDeadline(d: string | null) {
    if (!d) return null;
    return new Date(d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  }

  function isOverdue(d: string | null) {
    if (!d) return false;
    return new Date(d) < new Date();
  }

  return (
    <div className="w-full max-w-[420px]">
      {/* User badge */}

      {selectError && (
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-[12px] text-red-600">
          {selectError}
        </div>
      )}

      <div className="rounded-2xl border border-stone-200/80 bg-white/90 backdrop-blur-sm shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14">
            <div
              className={`h-8 w-8 rounded-full border-2 border-stone-100 animate-spin ${theme.spinner}`}
            />
            <p className="text-[13px] text-stone-400">Memuat order...</p>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
            <p className="text-[13px] text-red-500">
              {fetchError instanceof Error
                ? fetchError.message
                : "Terjadi kesalahan"}
            </p>
            <button
              onClick={() => refetch()}
              className={`rounded-lg px-4 py-2 text-[13px] font-medium text-white ${theme.btn}`}
            >
              Coba lagi
            </button>
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 px-6 text-center">
            <ClipboardList
              className="h-10 w-10 text-stone-200"
              strokeWidth={1.5}
            />
            <p className="text-[14px] font-medium text-stone-400">
              {search
                ? "Order tidak ditemukan"
                : "Tidak ada order yang perlu ditangani saat ini"}
            </p>
            {search && (
              <p className="text-[12px] text-stone-300">Coba kata kunci lain</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {displayOrders.map((order) => {
              const isSelecting = selectingId === order.id;
              const isRework = order.status === "rework";
              const overdue = isOverdue(order.deadline);

              return (
                <li key={order.id}>
                  <button
                    onClick={() => handleSelect(order)}
                    disabled={!!selectingId}
                    className="w-full text-left px-4 py-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {/* Order number + stage badge */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-[12px] font-semibold text-stone-500">
                            #{order.order_number}
                          </span>
                          {roleStages.length > 1 && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${theme.badge}`}
                            >
                              {STAGE_LABELS[order.current_stage] ??
                                order.current_stage}
                            </span>
                          )}
                          {isRework && (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                              Rework
                            </span>
                          )}
                        </div>

                        {/* Customer name */}
                        <p className="text-[14px] font-semibold text-stone-800 truncate leading-snug">
                          {order.customer_name ?? "—"}
                        </p>
                        {order.proses_produksi && (
                          <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Proses: {order.proses_produksi}
                          </span>
                        )}
                      </div>

                      {/* Right side: deadline + chevron */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {order.deadline ? (
                          <span
                            className={`text-[11px] font-medium ${overdue ? "text-red-500" : "text-stone-400"}`}
                          >
                            {overdue ? "⚠ " : ""}
                            {formatDeadline(order.deadline)}
                          </span>
                        ) : null}
                        {isSelecting ? (
                          <SpinIcon className={`h-4 w-4 text-stone-400`} />
                        ) : (
                          <ChevronRight
                            className="h-4 w-4 text-stone-300"
                            strokeWidth={2}
                          />
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!isLoading && !fetchError && (
        <div className="mt-3 space-y-2">
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className={`w-full rounded-lg border border-stone-200 px-4 py-2 text-[13px] font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 ${theme.ring}`}
            >
              {isFetchingNextPage
                ? "Memuat order..."
                : `Muat lebih banyak (${orders.length} dari ${totalOrders})`}
            </button>
          )}
          {displayOrders.length > 0 && (
            <button
              onClick={() => refetch()}
              className="w-full py-1 text-center text-[12px] text-stone-300 transition-colors hover:text-stone-500"
            >
              Refresh daftar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const Row = ({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) =>
  value !== null && value !== undefined && value !== "" ? (
    <div className="flex gap-2 text-[12px]">
      <span className="shrink-0 text-stone-400 w-28">{label}</span>
      <span className="text-stone-700 font-medium break-words">
        {String(value)}
      </span>
    </div>
  ) : null;

const DetailCard = ({
  title,
  items,
  color,
}: {
  title: string;
  items: string[] | null | undefined;
  color: string;
}) => {
  if (!items?.length) return null;
  return (
    <div className={`rounded-lg border ${color} p-2.5 space-y-1`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
        {title}
      </p>
      {items.map((item, i) => (
        <p key={i} className="text-[12px] text-stone-700 font-medium">
          {item}
        </p>
      ))}
    </div>
  );
};

// ── Work Order Card ───────────────────────────────────────────────────────────

function WorkshopWorkOrderCard({
  wo,
  theme,
}: {
  wo: WorkshopWorkOrder;
  theme: Theme;
}) {
  const hasPria =
    wo.pria &&
    (wo.pria.ukuran ||
      wo.pria.ukiran ||
      wo.pria.jenis_cincin ||
      wo.pria.model_bentuk?.length ||
      wo.pria.microsetting?.length ||
      wo.pria.detail_laser?.length ||
      wo.pria.detail_finishing?.length);
  const hasWanita =
    wo.wanita &&
    (wo.wanita.ukuran ||
      wo.wanita.ukiran ||
      wo.wanita.jenis_cincin ||
      wo.wanita.model_bentuk?.length ||
      wo.wanita.microsetting?.length ||
      wo.wanita.detail_laser?.length ||
      wo.wanita.detail_finishing?.length);
  const hasLaser = wo.font || wo.laser_position;

  return (
    <div
      className={`mb-5 rounded-xl border px-4 py-3.5 space-y-3 ${theme.card}`}
    >
      <p
        className={`flex justify-between items-center mb-2 py-1 px-3 bg-stone-50 border-l-4 border-stone-300 ${theme.label}`}
      >
        Spesifikasi Order
      </p>

      {/* Order Info */}
      <div className="space-y-1">
        <Row label="Customer" value={wo.customer_name} />
        <Row
          label="Deadline"
          value={
            wo.deadline
              ? new Date(wo.deadline).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : null
          }
        />
      </div>

      {/* Produk (checkout dari katalog) */}
      {wo.produk_nama && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            Produk
          </p>
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5 space-y-1">
            <p className="text-[13px] font-semibold text-stone-800">
              {wo.produk_nama}
            </p>
            {wo.produk_sku && (
              <p className="font-mono text-[11px] text-stone-500">
                SKU: {wo.produk_sku}
              </p>
            )}
            {wo.produk_spesifikasi && (
              <div
                className="text-xs text-stone-600 leading-relaxed max-w-none [&_h2]:text-[10px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-stone-400 [&_h2]:mb-1 [&_blockquote]:mb-0.5 [&_p]:mb-1 [&_strong]:text-stone-800"
                dangerouslySetInnerHTML={{ __html: wo.produk_spesifikasi }}
              />
            )}
          </div>
        </div>
      )}

      {/* Catatan / Order Notes */}
      {wo.catatan && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            Catatan Order
          </p>
          <div
            className="rounded-lg border border-stone-200 bg-stone-50 p-2.5 text-xs text-stone-600 leading-relaxed max-w-none [&_p]:mb-1 [&_ul]:ml-4 [&_ol]:ml-4 [&_strong]:text-stone-800"
            dangerouslySetInnerHTML={{ __html: wo.catatan }}
          />
        </div>
      )}

      {/* Acara */}
      {(wo.acara || wo.kebutuhan_acara) && (
        <div className="space-y-1">
          <Row label="Acara" value={wo.acara} />
          <Row label="Kebutuhan" value={wo.kebutuhan_acara} />
        </div>
      )}

      {wo.kategori && <Row label="Kategori" value={wo.kategori} />}

      {wo.jenis_cincin_features?.length ? (
        <Row
          label="Adds-On"
          value={formatAddsOnList(wo.jenis_cincin_features)}
        />
      ) : null}

      {wo.pengiriman && <Row label="Pengiriman" value={wo.pengiriman} />}

      {/* Ring specs — Pria */}
      {hasPria && (
        <div>
          <div
            className={`flex justify-between items-center mb-2 py-1 px-3 bg-stone-50 border-l-4 border-stone-300 ${theme.label}`}
          >
            <span className="text-[13px] font-semibold uppercase tracking-wider">
              Pria
            </span>
            {wo.pria!.reference_image_url && (
              <a
                href={wo.pria!.reference_image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-blue-600 underline"
              >
                Lihat referensi ↗
              </a>
            )}
          </div>
          <div className="space-y-1">
            <Row
              label="Gramasi"
              value={wo.gramasi_pria ? `${wo.gramasi_pria} g` : null}
            />
            <Row label="Ukuran" value={wo.pria!.ukuran} />
            <Row label="Jenis cincin" value={wo.pria!.jenis_cincin} />
            <Row label="Ukiran nama" value={wo.pria!.ukiran} />
            <Row label="Ukiran cincin" value={wo.ukiran_cincin_pria} />
            <Row label="Keterangan" value={wo.pria!.keterangan} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <DetailCard
              title="Model / Bentuk"
              items={wo.pria!.model_bentuk ?? []}
              color="border-orange-200 bg-orange-50/70"
            />
            <DetailCard
              title="Microsetting"
              items={wo.pria!.microsetting ?? []}
              color="border-yellow-200 bg-yellow-50/70"
            />
            <DetailCard
              title="Laser"
              items={wo.pria!.detail_laser ?? []}
              color="border-green-200 bg-green-50/70"
            />
            <DetailCard
              title="Finishing"
              items={wo.pria!.detail_finishing ?? []}
              color="border-blue-200 bg-blue-50/70"
            />
          </div>
        </div>
      )}

      {/* Ring specs — Wanita */}
      {hasWanita && (
        <div>
          <div
            className={`flex justify-between items-center mb-2 py-1 px-3 bg-stone-50 border-l-4 border-stone-300 ${theme.label}`}
          >
            <span className="text-[13px] font-semibold uppercase tracking-wider">
              Wanita
            </span>
            {wo.wanita!.reference_image_url && (
              <a
                href={wo.wanita!.reference_image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-blue-600 underline"
              >
                Lihat referensi ↗
              </a>
            )}
          </div>
          <div className="space-y-1">
            <Row
              label="Gramasi"
              value={wo.gramasi_wanita ? `${wo.gramasi_wanita} g` : null}
            />
            <Row label="Ukuran" value={wo.wanita!.ukuran} />
            <Row label="Jenis cincin" value={wo.wanita!.jenis_cincin} />
            <Row label="Ukiran nama" value={wo.wanita!.ukiran} />
            <Row label="Ukiran cincin" value={wo.ukiran_cincin_wanita} />
            <Row label="Keterangan" value={wo.wanita!.keterangan} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <DetailCard
              title="Model / Bentuk"
              items={wo.wanita!.model_bentuk ?? []}
              color="border-orange-200 bg-orange-50/70"
            />
            <DetailCard
              title="Microsetting"
              items={wo.wanita!.microsetting ?? []}
              color="border-yellow-200 bg-yellow-50/70"
            />
            <DetailCard
              title="Laser"
              items={wo.wanita!.detail_laser ?? []}
              color="border-green-200 bg-green-50/70"
            />
            <DetailCard
              title="Finishing"
              items={wo.wanita!.detail_finishing ?? []}
              color="border-blue-200 bg-blue-50/70"
            />
          </div>
        </div>
      )}

      {/* Laser */}
      {hasLaser && (
        <div>
          <p
            className={`flex justify-between items-center mb-2 py-1 px-3 bg-stone-50 border-l-4 border-stone-300 ${theme.label}`}
          >
            Laser Engraving
          </p>
          <div className="space-y-1">
            <Row label="Font" value={wo.font} />
            <Row label="Posisi" value={wo.laser_position} />
            <Row label="Alat ukur" value={wo.alat_ukur} />
            <Row label="Box" value={wo.box} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Phase: Form ───────────────────────────────────────────────────────────────

function StageDeadlineBadge({
  tglOrder,
  deadline,
  stage,
}: {
  tglOrder?: string | null;
  deadline: string;
  stage: string;
}) {
  const status = getStageDeadlineStatus(tglOrder, deadline, stage);
  if (!status) return null;
  return (
    <p
      className={`text-[12px] ${status.isOverdue ? "text-red-600 font-medium" : "text-emerald-600"}`}
    >
      {status.isOverdue
        ? `⚠ Terlambat ${Math.abs(status.daysRemaining)} hari`
        : `Tahap ${status.label}: H-${Math.max(status.daysRemaining, 1)}`}
    </p>
  );
}

function PhaseForm({
  user,
  order,
  config,
  theme,
  onSubmit,
  onBack,
}: {
  user: UserProfile;
  order: WorkshopOrderInfo;
  config: FormConfig;
  theme: Theme;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}) {
  const stageLabel = STAGE_LABELS[config.stage] ?? config.stage;

  return (
    <div className="w-full max-w-[420px]">
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[13px] text-stone-400 hover:text-stone-600 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          Daftar order
        </button>
        <p className="text-[13px] font-medium text-stone-700">
          {user.full_name}
        </p>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${theme.badge}`}
        >
          {stageLabel}
        </span>
        <span className="text-[12px] text-stone-400">
          #{order.order_number}
        </span>
        {order.proses_produksi && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Proses: {order.proses_produksi}
          </span>
        )}
        {order.status === "rework" && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
            Rework
          </span>
        )}
      </div>

      <div className={`mb-4 rounded-xl border px-4 py-3 ${theme.card}`}>
        <p
          className={`text-[10px] font-medium uppercase tracking-wider ${theme.label}`}
        >
          Customer
        </p>
        <p className="mt-1 text-[15px] font-semibold text-stone-800">
          {order.customer_name ?? "—"}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
          {order.deadline && (
            <p className="text-[12px] text-stone-500">
              Deadline:{" "}
              <span className="font-medium text-stone-700">
                {new Date(order.deadline).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </p>
          )}
          {order.deadline && config.stage && (
            <StageDeadlineBadge
              tglOrder={order.tgl_order}
              deadline={order.deadline}
              stage={config.stage}
            />
          )}
        </div>
      </div>

      {config.work_order && (
        <WorkshopWorkOrderCard wo={config.work_order} theme={theme} />
      )}

      {config.konfirmasi_info?.tanggal_packing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 mb-4">
          <p className="text-xs text-blue-700">
            <span className="font-semibold">
              Tgl Packing (dari Konfirmasi):
            </span>{" "}
            {new Date(
              config.konfirmasi_info.tanggal_packing,
            ).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      )}

      {config.konfirmasi_info?.nomor_resi && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 mb-4">
          <p className="text-xs text-violet-700">
            <span className="font-semibold">No Resi (dari Konfirmasi):</span>{" "}
            <span className="font-mono">
              {config.konfirmasi_info.nomor_resi}
            </span>
          </p>
        </div>
      )}

      <StageInputForm
        fields={config.fields}
        permissions={config.permissions}
        initialData={config.current_data}
        onSubmit={onSubmit}
        stageType={config.stage_type}
        orderId={order.id}
      />
    </div>
  );
}

// ── Phase: Success ────────────────────────────────────────────────────────────

function PhaseSuccess({
  orderNumber,
  stage,
  theme,
  onNext,
}: {
  orderNumber: string;
  stage: string;
  theme: Theme;
  onNext: () => void;
}) {
  return (
    <div className="w-full max-w-[380px] text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 border border-green-200">
        <CheckCircle className="h-8 w-8 text-green-500" strokeWidth={1.5} />
      </div>
      <h2 className="text-[18px] font-semibold text-stone-800 mb-1">
        Data Tersimpan
      </h2>
      <p className="text-[13px] text-stone-500 mb-1">
        Tahap{" "}
        <span className="font-medium text-stone-700">
          {STAGE_LABELS[stage] ?? stage}
        </span>
      </p>
      <p className="text-[13px] text-stone-400 mb-8">Order #{orderNumber}</p>
      <button
        onClick={onNext}
        className={`w-full rounded-xl py-3 text-[14px] font-medium text-white shadow-sm transition-all active:scale-[0.98] ${theme.btn}`}
      >
        Kembali ke Daftar
      </button>
    </div>
  );
}

// ── Worker History Section ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function WorkerHistorySection({
  history,
  search,
  expanded,
  onToggle,
}: {
  history: WorkerHistoryItem[];
  search: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [detail, setDetail] = useState<WorkerHistoryItem | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const q = search.toLowerCase();
  const filtered = q
    ? history.filter(
        (h) =>
          h.order_number.toLowerCase().includes(q) ||
          h.stage_label.toLowerCase().includes(q),
      )
    : history;

  const display = expanded ? filtered : filtered.slice(0, 5);

  if (history.length === 0) return null;

  return (
    <>
      <div className="border border-stone-200 rounded-xl overflow-hidden bg-white">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-stone-700">
            Riwayat Pekerjaan Saya ({history.length})
          </p>
        </div>

        <div className="divide-y divide-stone-50">
          {display.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-stone-400">
              Tidak ada hasil pencarian
            </div>
          ) : (
            display.map((h) => (
              <button
                key={h.id}
                onClick={async () => {
                  setDetail(h);
                  setOrderDetail(null);
                  setLoadingDetail(true);
                  try {
                    const res = await fetch(
                      `/api/order-detail?order_id=${h.order_id}`,
                    );
                    if (res.ok) {
                      const json = await res.json();
                      setOrderDetail(json.data?.order ?? null);
                    }
                  } catch {
                  } finally {
                    setLoadingDetail(false);
                  }
                }}
                className="w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-stone-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-stone-700 truncate">
                    {h.order_number}
                  </p>
                  <p className="text-[11px] text-stone-400">{h.stage_label}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <p className="text-[11px] text-stone-400">
                    {h.finished_at ? formatDate(h.finished_at) : ""}
                  </p>
                  <ChevronRight
                    className="w-3.5 h-3.5 text-stone-300"
                    strokeWidth={2}
                  />
                </div>
              </button>
            ))
          )}
        </div>

        {filtered.length > 5 && (
          <button
            onClick={onToggle}
            className="w-full px-4 py-2.5 text-[12px] font-medium text-stone-500 hover:text-stone-700 hover:bg-stone-50 transition-colors border-t border-stone-100"
          >
            {expanded
              ? "Tampilkan lebih sedikit"
              : `Lihat semua (${filtered.length})`}
          </button>
        )}
      </div>

      {/* Detail popup */}
      {detail && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => {
              setDetail(null);
              setOrderDetail(null);
            }}
          />
          <div className="fixed inset-x-4 top-[5%] bottom-[5%] z-50 bg-white rounded-2xl shadow-2xl overflow-y-auto max-w-md mx-auto">
            <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-3.5 flex items-center justify-between z-10">
              <p className="text-[14px] font-semibold text-stone-800">
                #{detail.order_number}
              </p>
              <button
                onClick={() => {
                  setDetail(null);
                  setOrderDetail(null);
                }}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 rounded-full border-2 border-stone-200 border-t-amber-500 animate-spin" />
              </div>
            ) : orderDetail ? (
              <div className="px-5 py-4 space-y-4 text-[13px]">
                {/* Customer */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-1">
                    Customer
                  </p>
                  <p className="font-semibold text-stone-800">
                    {orderDetail.customer_name}
                  </p>
                </div>

                {/* Stage info */}
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-1">
                    Tahap dikerjakan
                  </p>
                  <p className="font-medium text-stone-700">
                    {detail.stage_label}
                  </p>
                  <p className="text-stone-400 text-[12px]">
                    {formatDate(detail.finished_at!)}
                  </p>
                </div>

                {/* Dates & Kategori */}
                <div className="grid grid-cols-2 gap-3">
                  {orderDetail.tgl_order && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                        Tgl Order
                      </p>
                      <p className="text-stone-700">
                        {formatDate(orderDetail.tgl_order)}
                      </p>
                    </div>
                  )}
                  {orderDetail.tgl_acara && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                        Tgl Acara
                      </p>
                      <p className="text-stone-700">
                        {formatDate(orderDetail.tgl_acara)}
                      </p>
                    </div>
                  )}
                  {orderDetail.deadline && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                        Deadline
                      </p>
                      <p className="text-stone-700">
                        {formatDate(orderDetail.deadline)}
                      </p>
                    </div>
                  )}
                  {orderDetail.kategori && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                        Kategori
                      </p>
                      <p className="text-stone-700 capitalize">
                        {orderDetail.kategori}
                      </p>
                    </div>
                  )}
                </div>

                {/* Acara + Order Via */}
                <div className="grid grid-cols-2 gap-3">
                  {orderDetail.acara && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                        Acara
                      </p>
                      <p className="text-stone-700">{orderDetail.acara}</p>
                    </div>
                  )}
                </div>

                {/* Adds-On */}
                {orderDetail.jenis_cincin_features?.length ? (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                      Adds-On
                    </p>
                    <p className="text-stone-700 break-words">
                      {formatAddsOnList(orderDetail.jenis_cincin_features)}
                    </p>
                  </div>
                ) : null}

                {/* Ring specs */}
                <div className="space-y-3">
                  <div className="bg-stone-50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-center font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
                      Pria
                    </p>
                    <div className="space-y-0.5 text-[13px]">
                      {orderDetail.gramasi_pria && (
                        <p className="text-stone-700">
                          Gramasi: {orderDetail.gramasi_pria} g
                        </p>
                      )}
                      {orderDetail.ukuran_pria && (
                        <p className="text-stone-700">
                          Ukuran: {orderDetail.ukuran_pria}
                        </p>
                      )}
                      {orderDetail.jenis_cincin_pria && (
                        <p className="text-stone-700">
                          Jenis: {orderDetail.jenis_cincin_pria}
                        </p>
                      )}
                      {orderDetail.ukiran_pria && (
                        <p className="text-stone-700">
                          Ukiran nama: {orderDetail.ukiran_pria}
                        </p>
                      )}
                      {orderDetail.ukiran_cincin_pria && (
                        <p className="text-stone-700">
                          Ukiran cincin: {orderDetail.ukiran_cincin_pria}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {orderDetail.model_bentuk_pria?.length ? (
                        <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
                            Model / Bentuk
                          </p>
                          {orderDetail.model_bentuk_pria.map(
                            (v: string, i: number) => (
                              <p key={i} className="text-[11px] text-stone-700">
                                {v}
                              </p>
                            ),
                          )}
                        </div>
                      ) : null}
                      {orderDetail.microsetting_pria?.length ? (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50/70 p-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
                            Microsetting
                          </p>
                          {orderDetail.microsetting_pria.map(
                            (v: string, i: number) => (
                              <p key={i} className="text-[11px] text-stone-700">
                                {v}
                              </p>
                            ),
                          )}
                        </div>
                      ) : null}
                      {orderDetail.detail_laser_pria?.length ? (
                        <div className="rounded-lg border border-green-200 bg-green-50/70 p-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
                            Laser
                          </p>
                          {orderDetail.detail_laser_pria.map(
                            (v: string, i: number) => (
                              <p key={i} className="text-[11px] text-stone-700">
                                {v}
                              </p>
                            ),
                          )}
                        </div>
                      ) : null}
                      {orderDetail.detail_finishing_pria?.length ? (
                        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
                            Finishing
                          </p>
                          {orderDetail.detail_finishing_pria.map(
                            (v: string, i: number) => (
                              <p key={i} className="text-[11px] text-stone-700">
                                {v}
                              </p>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="bg-stone-50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-center font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
                      Wanita
                    </p>
                    <div className="space-y-0.5 text-[13px]">
                      {orderDetail.gramasi_wanita && (
                        <p className="text-stone-700">
                          Gramasi: {orderDetail.gramasi_wanita} g
                        </p>
                      )}
                      {orderDetail.ukuran_wanita && (
                        <p className="text-stone-700">
                          Ukuran: {orderDetail.ukuran_wanita}
                        </p>
                      )}
                      {orderDetail.jenis_cincin_wanita && (
                        <p className="text-stone-700">
                          Jenis: {orderDetail.jenis_cincin_wanita}
                        </p>
                      )}
                      {orderDetail.ukiran_wanita && (
                        <p className="text-stone-700">
                          Ukiran nama: {orderDetail.ukiran_wanita}
                        </p>
                      )}
                      {orderDetail.ukiran_cincin_wanita && (
                        <p className="text-stone-700">
                          Ukiran cincin: {orderDetail.ukiran_cincin_wanita}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {orderDetail.model_bentuk_wanita?.length ? (
                        <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
                            Model / Bentuk
                          </p>
                          {orderDetail.model_bentuk_wanita.map(
                            (v: string, i: number) => (
                              <p key={i} className="text-[11px] text-stone-700">
                                {v}
                              </p>
                            ),
                          )}
                        </div>
                      ) : null}
                      {orderDetail.microsetting_wanita?.length ? (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50/70 p-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
                            Microsetting
                          </p>
                          {orderDetail.microsetting_wanita.map(
                            (v: string, i: number) => (
                              <p key={i} className="text-[11px] text-stone-700">
                                {v}
                              </p>
                            ),
                          )}
                        </div>
                      ) : null}
                      {orderDetail.detail_laser_wanita?.length ? (
                        <div className="rounded-lg border border-green-200 bg-green-50/70 p-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
                            Laser
                          </p>
                          {orderDetail.detail_laser_wanita.map(
                            (v: string, i: number) => (
                              <p key={i} className="text-[11px] text-stone-700">
                                {v}
                              </p>
                            ),
                          )}
                        </div>
                      ) : null}
                      {orderDetail.detail_finishing_wanita?.length ? (
                        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-1.5">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">
                            Finishing
                          </p>
                          {orderDetail.detail_finishing_wanita.map(
                            (v: string, i: number) => (
                              <p key={i} className="text-[11px] text-stone-700">
                                {v}
                              </p>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Laser */}
                {orderDetail.font && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                        Font
                      </p>
                      <p className="text-stone-700">{orderDetail.font}</p>
                    </div>
                    {orderDetail.laser_position && (
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                          Posisi Laser
                        </p>
                        <p className="text-stone-700">
                          {orderDetail.laser_position.replace(/_/g, " ")}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes from worker */}
                {detail.notes && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                      Catatan
                    </p>
                    <p className="text-stone-600 bg-stone-50 rounded-lg px-3 py-2">
                      {detail.notes}
                    </p>
                  </div>
                )}

                {/* Submitted data summary */}
                {detail.data && Object.keys(detail.data).length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-1">
                      Data dikirim
                    </p>
                    <div className="bg-stone-50 rounded-xl px-3 py-2.5 space-y-1.5">
                      {Object.entries(detail.data).map(([key, value]) => {
                        const displayVal = Array.isArray(value)
                          ? (value as unknown[])
                              .map((v) =>
                                typeof v === "object"
                                  ? JSON.stringify(v)
                                  : String(v),
                              )
                              .join(", ")
                          : typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value ?? "—");
                        return (
                          <div key={key} className="flex justify-between gap-2">
                            <span className="text-stone-400 capitalize">
                              {key.replace(/_/g, " ")}
                            </span>
                            <span className="text-stone-700 text-right max-w-[60%] truncate">
                              {displayVal}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pengiriman */}
                <div className="grid grid-cols-2 gap-3">
                  {orderDetail.pengiriman && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                        Pengiriman
                      </p>
                      <p className="text-stone-700">{orderDetail.pengiriman}</p>
                    </div>
                  )}
                  {orderDetail.box && (
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                        Box
                      </p>
                      <p className="text-stone-700">{orderDetail.box}</p>
                    </div>
                  )}
                </div>

                {/* Dari Artis */}
                {orderDetail.dari_artis_detail && (
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
                      Dari Artis
                    </p>
                    <p className="text-stone-700">
                      {orderDetail.dari_artis_detail}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-16">
                <p className="text-[13px] text-stone-400">
                  Gagal memuat detail
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function WorkshopInputContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [order, setOrder] = useState<WorkshopOrderInfo | null>(null);
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "deadline">("deadline");
  const [listTab, setListTab] = useState<"orders" | "history">("orders");
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const { data: workerHistory = [], refetch: refetchHistory } = useQuery<
    WorkerHistoryItem[]
  >({
    queryKey: ["workshop-history"],
    queryFn: () =>
      fetcher<{ success: boolean; data: Record<string, unknown>[] }>(
        "/api/workshop/history?limit=200",
      ).then((r) =>
        r.success ? ((r.data ?? []) as unknown as WorkerHistoryItem[]) : [],
      ),
  });

  // Load user profile on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Sesi tidak valid");
        }
        const json = await res.json();
        const profile: UserProfile = json.data;
        setUser(profile);

        setPhase("list");
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat sesi");
      }
    })();
  }, []);

  const theme = getTheme(user?.role.role_group ?? "");

  // Called when worker taps an order card — fetch form config directly
  const handleSelect = useCallback(
    async (selectedOrder: WorkshopOrderInfo) => {
      if (!user) return;

      const allowedStages: string[] = user.role.allowed_stages ?? [];
      const roleStageMap = ROLE_STAGE_MAP[user.role.name] ?? [];
      const myStages = allowedStages.length > 0 ? allowedStages : roleStageMap;

      // Only reject if we know the worker's stages AND this stage isn't one of them.
      if (
        myStages.length > 0 &&
        !myStages.includes(selectedOrder.current_stage)
      ) {
        const stageNames = myStages.map((s) => STAGE_LABELS[s] ?? s).join(", ");
        throw new Error(
          `Order di tahap "${STAGE_LABELS[selectedOrder.current_stage] ?? selectedOrder.current_stage}". Anda menangani: ${stageNames}.`,
        );
      }

      const configRes = await fetch(
        `/api/stages/form-config?order_id=${selectedOrder.id}&stage=${selectedOrder.current_stage}`,
      );
      const configJson = await configRes.json();
      if (!configRes.ok)
        throw new Error(configJson.error ?? "Gagal memuat form");

      setOrder(selectedOrder);
      setConfig({
        ...configJson.data.config,
        stage: selectedOrder.current_stage,
      });
      setPhase("form");
    },
    [user],
  );

  const handleSubmit = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!order || !config) return;
      const data = { ...formData };
      // StageInputForm uses check_key; API expects key
      if (Array.isArray(data.quality_checklist)) {
        data.quality_checklist = (
          data.quality_checklist as Array<Record<string, unknown>>
        ).map((item) => ({
          key: item.check_key ?? item.key,
          passed: item.passed,
        }));
      }
      const res = await fetch("/api/stages/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, stage: config.stage, data }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Gagal menyimpan data");
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ["workshop-orders"] });
      setPhase("success");
    },
    [order, config, refetchHistory, queryClient],
  );

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/workshop/login");
  }, [router]);

  const handleBackToList = useCallback(() => {
    setOrder(null);
    setConfig(null);
    setPhase("list");
  }, []);

  if (loadError) {
    return (
      <div className="w-full max-w-[380px] text-center">
        <BrandHeader subtitle="Workshop Access Point" />
        <div className="rounded-2xl border border-red-100 bg-white/90 p-7 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-7 w-7 text-red-400" strokeWidth={1.5} />
          </div>
          <p className="text-[14px] text-stone-600 mb-5">{loadError}</p>
          <button
            onClick={() => router.push("/workshop/login")}
            className="text-[14px] font-medium text-amber-600 hover:text-amber-700"
          >
            Login ulang
          </button>
        </div>
      </div>
    );
  }

  if (phase === "loading") return <PhaseLoading />;

  if (phase === "list" && user) {
    const roleStages = (
      user.role.allowed_stages.length > 0
        ? user.role.allowed_stages
        : (ROLE_STAGE_MAP[user.role.name] ?? [])
    ).filter((s) => s !== "penerimaan_order" && !s.startsWith("approval_"));

    const roleLabel =
      roleStages.map((s) => STAGE_LABELS[s] ?? s).join(", ") || user.role.name;

    return (
      <div className="w-full max-w-[420px]">
        <BrandHeader subtitle="Workshop Input" />

        <div className={`mb-4 rounded-xl border px-4 py-3 ${theme.card}`}>
          <p
            className={`text-[10px] mb-4 font-medium uppercase tracking-wider ${theme.label}`}
          >
            Masuk sebagai
          </p>
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-stone-800">
              {user.full_name}
            </p>
            <button
              onClick={() => router.push("/workshop/settings/pin")}
              className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1"
            >
              <Key className="h-3 w-3" strokeWidth={1.5} />
              Pengaturan PIN
            </button>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${theme.badge}`}
            >
              {roleLabel}
            </span>
            <div className="flex items-center gap-3">
              {user.role.permissions?.["warranty.work.update"] && (
                <button
                  onClick={() => router.push("/workshop/warranty")}
                  className="text-[11px] text-amber-600 hover:text-amber-700 transition-colors"
                >
                  Garansi
                </button>
              )}
              <button
                onClick={handleLogout}
                className="text-[11px] text-stone-400 hover:text-red-500 transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-300 pointer-events-none"
                strokeWidth={2}
              />
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Cari No. Order atau tahap..."
                className={`w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-[14px] text-stone-700 placeholder:text-stone-300 focus:outline-none focus:ring-2 transition-all ${theme.ring}`}
              />
              {listSearch && (
                <button
                  onClick={() => setListSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "newest" | "deadline")
              }
              className={`rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[13px] text-stone-600 focus:outline-none focus:ring-2 transition-all ${theme.ring}`}
            >
              <option value="deadline">Deadline ⬆</option>
              <option value="newest">Terbaru</option>
            </select>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className={`rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-[13px] text-stone-600 focus:outline-none focus:ring-2 transition-all ${theme.ring}`}
            >
              <option value="all">Semua Brand</option>
              <option value="KGJ">KGJ</option>
              <option value="HJZ">Hijaz</option>
              <option value="MP">MP</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mb-3 border-b border-stone-200">
          <button
            onClick={() => setListTab("orders")}
            className={`flex-1 pb-2.5 text-[13px] font-medium text-center transition-colors border-b-2 ${
              listTab === "orders"
                ? "border-amber-500 text-stone-800"
                : "border-transparent text-stone-400 hover:text-stone-600"
            }`}
          >
            Order Berjalan
          </button>
          <button
            onClick={() => setListTab("history")}
            className={`flex-1 pb-2.5 text-[13px] font-medium text-center transition-colors border-b-2 ${
              listTab === "history"
                ? "border-amber-500 text-stone-800"
                : "border-transparent text-stone-400 hover:text-stone-600"
            }`}
          >
            Riwayat Pekerjaan ({workerHistory.length})
          </button>
        </div>

        {listTab === "orders" ? (
          <PhaseOrderList
            user={user}
            theme={theme}
            search={listSearch}
            sortBy={sortBy}
            brandFilter={brandFilter}
            onSelect={handleSelect}
            _onLogout={handleLogout}
          />
        ) : (
          <WorkerHistorySection
            history={workerHistory}
            search={listSearch}
            expanded={historyExpanded}
            onToggle={() => setHistoryExpanded((p) => !p)}
          />
        )}
      </div>
    );
  }

  if (phase === "form" && user && order && config) {
    return (
      <>
        <PhaseForm
          user={user}
          order={order}
          config={config}
          theme={theme}
          onSubmit={handleSubmit}
          onBack={handleBackToList}
        />
      </>
    );
  }

  if (phase === "success") {
    return (
      <PhaseSuccess
        orderNumber={order!.order_number}
        stage={config!.stage}
        theme={theme}
        onNext={handleBackToList}
      />
    );
  }

  return null;
}

export default function WorkshopInputPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="h-10 w-10 rounded-full border-2 border-stone-200 border-t-amber-500 animate-spin" />
        </div>
      }
    >
      <WorkshopInputContent />
    </Suspense>
  );
}
