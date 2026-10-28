// app/dashboard/superadmin/oprprd/laporan/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Loading from "@/components/ui/Loading";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Hammer,
  Loader2,
  Shield,
  Users,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportType = "production" | "quality" | "staff" | "complete";

interface ReportCard {
  type: ReportType;
  title: string;
  description: string;
  columns: string[];
  icon: React.ReactNode;
  tone: "sky" | "emerald" | "violet" | "amber";
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

const REPORTS: ReportCard[] = [
  {
    type: "production",
    title: "Laporan Produksi",
    description:
      "Rincian semua tahap produksi yang selesai dalam periode yang dipilih, termasuk durasi pengerjaan dan data susut bahan.",
    columns: [
      "Tanggal",
      "No Order",
      "Produk",
      "Tahap",
      "Staff",
      "Role",
      "Durasi",
      "Attempt",
      "Susut",
    ],
    icon: <Hammer className="h-5 w-5" />,
    tone: "sky",
  },
  {
    type: "quality",
    title: "Laporan QC",
    description:
      "Semua hasil pemeriksaan Quality Control (QC 1, QC 2, QC 3) beserta ringkasan pass rate per tahap.",
    columns: [
      "Tanggal",
      "No Order",
      "Produk",
      "Tahap QC",
      "Inspektor",
      "Hasil",
      "Catatan",
      "Durasi",
    ],
    icon: <Shield className="h-5 w-5" />,
    tone: "emerald",
  },
  {
    type: "staff",
    title: "Laporan Performa Staff",
    description:
      "Rekap kinerja tiap jewelry expert: jumlah scan, order dikerjakan, tahap selesai, dan rata-rata susut bahan.",
    columns: [
      "Nama Staff",
      "Role",
      "Total Scan",
      "Total Order",
      "Tahap Selesai",
      "Rata Susut",
    ],
    icon: <Users className="h-5 w-5" />,
    tone: "violet",
  },
  {
    type: "complete",
    title: "Laporan Lengkap",
    description:
      "Gabungan laporan produksi, QC, dan performa staff dalam satu file CSV — ideal untuk arsip bulanan.",
    columns: ["Data Produksi", "Data QC", "Performa Staff", "Semua tahap"],
    icon: <FileSpreadsheet className="h-5 w-5" />,
    tone: "amber",
  },
];

const TONE_MAP = {
  sky: {
    iconBg: "bg-sky-50 text-sky-600",
    badge: "bg-sky-500/10 text-sky-300",
    btn: "bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-400",
  },
  emerald: {
    iconBg: "bg-emerald-500/10 text-emerald-300",
    badge: "bg-emerald-500/10 text-emerald-300",
    btn: "bg-emerald-500/20 hover:bg-emerald-500/30 focus-visible:ring-emerald-400/30",
  },
  violet: {
    iconBg: "bg-violet-500/10 text-violet-300",
    badge: "bg-violet-500/10 text-violet-300",
    btn: "bg-violet-500/20 hover:bg-violet-500/30 focus-visible:ring-violet-400/30",
  },
  amber: {
    iconBg: "bg-amber-500/10 text-amber-300",
    badge: "bg-amber-500/10 text-amber-300",
    btn: "bg-amber-500/20 hover:bg-amber-500/30 focus-visible:ring-amber-400/30",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(period: string): string {
  if (!period) return "";
  const [yr, mo] = period.split("-").map(Number);
  const d = new Date(yr, mo - 1, 1);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LaporanPage() {
  const router = useRouter();
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>(currentPeriod());
  const [downloading, setDownloading] = useState<ReportType | null>(null);
  const [lastDownloaded, setLastDownloaded] = useState<ReportType | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    const cu = getClientUser();
    if (!cu) {
      router.push("/login");
      return;
    }
    setClientUser(cu);
    setLoading(false);
  }, [router]);

  async function handleDownload(type: ReportType) {
    if (downloading) return;
    setDownloading(type);
    setDownloadError(null);
    setLastDownloaded(null);

    try {
      const url = `/api/reports-oprprd?type=${type}&period=${period}`;
      const res = await fetch(url);

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          json.error ?? `Gagal mengunduh laporan (${res.status})`,
        );
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const fileMatch = disposition.match(/filename="(.+?)"/);
      const filename = fileMatch?.[1] ?? `laporan_${type}_${period}.csv`;

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setLastDownloaded(type);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Terjadi kesalahan",
      );
    } finally {
      setDownloading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-[#26211c]">
        <Sidebar role="superadmin" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header userEmail="" role="superadmin" />
          <main className="flex-1 overflow-y-auto p-6">
            <Loading variant="skeleton" text="Memuat laporan..." />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#26211c]">
      <Sidebar role="superadmin" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
        <main className="flex-1 overflow-y-auto p-6">
          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/dashboard/superadmin"
                  className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> OPR-PRD
                </Link>
              </div>
              <h2 className="text-2xl font-bold text-ivory tracking-tight leading-none">
                Laporan OPR-PRD
              </h2>
              <p className="text-sm text-white/40 font-mono mt-1">
                Unduh laporan produksi, QC, dan performa tim dalam format CSV
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <input
                type="month"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setLastDownloaded(null);
                  setDownloadError(null);
                }}
                className="rounded-md border border-gold/15 bg-cocoa px-3 py-1.5 text-xs font-medium text-cream shadow-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
              <p className="text-[11px] text-white/40">
                Periode:{" "}
                <span className="font-medium text-white/70">
                  {periodLabel(period)}
                </span>
              </p>
            </div>
          </div>

          {/* ── Error Banner ── */}
          {downloadError && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-rose-300" />
              <div>
                <p className="text-sm font-medium text-rose-200">
                  Gagal mengunduh laporan
                </p>
                <p className="text-xs text-rose-200">{downloadError}</p>
              </div>
            </div>
          )}

          {/* ── Report Cards ── */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {REPORTS.map((report) => {
              const isDownloading = downloading === report.type;
              const isDownloaded = lastDownloaded === report.type;
              const tc = TONE_MAP[report.tone];

              return (
                <div
                  key={report.type}
                  className="rounded-lg border border-gold/15 bg-cocoa p-5 flex flex-col gap-4 shadow-sm"
                >
                  {/* Card Header */}
                  <div className="flex items-start gap-3">
                    <div className={`flex-none rounded-lg p-2.5 ${tc.iconBg}`}>
                      {report.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ivory">
                        {report.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-white/50 leading-relaxed">
                        {report.description}
                      </p>
                    </div>
                  </div>

                  {/* Columns preview */}
                  <div className="flex flex-wrap gap-1.5">
                    {report.columns.map((col) => (
                      <span
                        key={col}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tc.badge}`}
                      >
                        {col}
                      </span>
                    ))}
                  </div>

                  {/* Separator */}
                  <div className="border-t border-gold/10" />

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-white/40">
                      Format:{" "}
                      <span className="font-medium text-white/70">
                        CSV (Excel-compatible)
                      </span>
                    </p>
                    <button
                      onClick={() => handleDownload(report.type)}
                      disabled={!!downloading}
                      className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${tc.btn}`}
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Memuat...
                        </>
                      ) : isDownloaded ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Terunduh
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5" />
                          Unduh
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Info box ── */}
          <div className="mt-6 rounded-lg border border-gold/15 bg-cocoa px-5 py-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
              Petunjuk Penggunaan
            </h4>
            <ul className="space-y-1.5 text-xs text-white/70">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 flex-none rounded-full bg-white/40" />
                Pilih <strong>periode (bulan)</strong> di sudut kanan atas
                sebelum mengunduh.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 flex-none rounded-full bg-white/40" />
                File CSV kompatibel dengan Microsoft Excel dan Google Sheets.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 flex-none rounded-full bg-white/40" />
                <strong>Laporan Lengkap</strong> menggabungkan tiga laporan
                sekaligus — cocok untuk arsip bulanan.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 flex-none rounded-full bg-white/40" />
                Data susut hanya muncul untuk tahap <strong>Lebur Bahan</strong>
                , <strong>Pembentukan Cincin</strong>, dan{" "}
                <strong>Pemolesan</strong>.
              </li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}
