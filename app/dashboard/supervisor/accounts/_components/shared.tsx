"use client";

import {
  XCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  name: string;
  role_group: string;
  description: string | null;
}

export interface Account {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  status: "active" | "inactive";
  last_login: string | null;
  created_at: string;
  role_id: string | null;
  role: Role | null;
}

export type ModalType =
  | "create"
  | "edit"
  | "password"
  | "deactivate"
  | "delete"
  | null;

export type FilterStatus = "all" | "active" | "inactive";

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} hari lalu`;
  return formatDate(iso);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function roleLabel(name: string): string {
  const map: Record<string, string> = {
    penerimaan_order: "Penerimaan Order",
    racik_bahan: "Persiapan Bahan",
    lebur_bahan: "Lebur Bahan",
    pembentukan_cincin: "Pembentukan Cincin",
    cek_kadar: "Cek Kadar",
    pemasangan_permata: "Micro Setting",
    pemolesan: "Pemolesan",
    finishing: "Finishing",
    qc_1: "QC Awal",
    qc_2: "QC Akhir",
    laser: "Laser Engraving",
    packing: "Packing",
    pengiriman: "Pengiriman",
    konfirmasi: "Konfirmasi Customer",
    kelengkapan: "Kelengkapan",
    qc_3: "QC Akhir",
    pelunasan: "Pelunasan",
    supervisor: "Supervisor",
    superadmin: "Superadmin",
    admin: "Admin",
  };
  return (
    map[name] ??
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function roleGroupLabel(group: string): string {
  const map: Record<string, string> = {
    production: "Produksi",
    operational: "Operasional",
    management: "Manajemen",
  };
  return map[group] ?? group;
}

export function roleGroupColor(group: string): string {
  const map: Record<string, string> = {
    production: "bg-amber-500/10 text-amber-800 border-amber-400/20",
    operational: "bg-sky-500/10 text-sky-300 border-sky-400/20",
    management: "bg-purple-100 text-purple-800 border-purple-200",
  };
  return map[group] ?? "bg-white/10 text-cream border-gold/15";
}

// ── Small Components ───────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === "active"
          ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/20"
          : "bg-white/10 text-white/50 ring-1 ring-stone-200"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "active" ? "bg-emerald-500/100" : "bg-stone-400"
        }`}
      />
      {status === "active" ? "Aktif" : "Nonaktif"}
    </span>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-sm font-semibold text-amber-300 ring-2 ring-amber-400/20">
      {initials}
    </div>
  );
}

// ── Modal Shell ────────────────────────────────────────────────────────────────

interface ModalShellProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

export function ModalShell({
  title,
  subtitle,
  icon,
  onClose,
  children,
}: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-cocoa shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gold/10 px-6 py-4">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h2 className="text-base font-semibold text-cream">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-white/40">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Form Field ─────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  hint?: string;
  error?: string | null;
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  minLength,
  disabled,
  hint,
  error,
}: FormFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-cream">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        disabled={disabled}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm text-cream placeholder:text-white/30 transition ${
          disabled
            ? "border-gold/10 bg-carbon text-white/40 cursor-not-allowed"
            : error
              ? "border-red-200 bg-rose-500/10 focus:border-red-400 focus:ring-2 focus:ring-red-200"
              : "border-gold/15 bg-carbon focus:border-amber-400 focus:bg-cocoa focus:ring-2 focus:ring-amber-400/20"
        }`}
      />
      {hint && !error && <p className="mt-1 text-xs text-white/40">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

export function AccountsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl border border-gold/15 bg-cocoa"
          />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl border border-gold/15 bg-cocoa overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-gold/10 last:border-0"
          >
            <div className="h-10 w-10 animate-pulse rounded-full bg-mocha" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 animate-pulse rounded bg-mocha" />
              <div className="h-2 w-20 animate-pulse rounded bg-white/10" />
            </div>
            <div className="h-6 w-20 animate-pulse rounded-full bg-mocha" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
