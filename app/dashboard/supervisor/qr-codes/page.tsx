"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import Sidebar from "@/components/layout/MobileSidebar";
import Header from "@/components/layout/MobileHeader";
import {
  QrCode,
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Copy,
  Download,
  Printer,
  X,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { Role, QRCode } from "@/types/qr-code";
import QRCodeLib from "qrcode";

// ─── Constants ──────────────────────────────────────────────────────

const formatRoleName = (name: string) =>
  name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const ROLE_GROUP_STYLES: Record<
  string,
  { label: string; bg: string; border: string; text: string }
> = {
  operational: {
    label: "Operasional",
    bg: "bg-sky-500/20",
    border: "border-sky-400/20",
    text: "text-sky-300",
  },
  production: {
    label: "Produksi",
    bg: "bg-amber-500/20",
    border: "border-amber-400/20",
    text: "text-amber-300",
  },
};

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
  qc_1: "QC Awal",
  approval_qc_1: "Approval QC Awal",
  laser: "Laser Engraving",
  finishing: "Finishing",
  approval_produksi: "Approval Produksi",
  qc_2: "QC Akhir",
  approval_qc_2: "Approval QC Akhir",
  konfirmasi: "Konfirmasi Customer Care",
  packing: "Packing & Persiapan Kirim",
  pengiriman: "Pengiriman",
};

// ─── QR Code Canvas Component ───────────────────────────────────────

function QRCodeImage({ data, size = 160 }: { data: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCodeLib.toCanvas(canvasRef.current, data, {
        width: size,
        margin: 2,
        color: { dark: "#111111", light: "#ffffff" },
      });
    }
  }, [data, size]);

  return <canvas ref={canvasRef} className="rounded-lg mx-auto" />;
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function SupervisorQRCodesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [alert, setAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    role_id: "",
    workstation_name: "",
    location: "",
  });
  const [generating, setGenerating] = useState(false);

  // Detail modal
  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);

  // Confirm dialogs
  const [toggleQR, setToggleQR] = useState<QRCode | null>(null);
  const [deleteQR, setDeleteQR] = useState<QRCode | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Action feedback (checkmark on button after action)
  const [actionFeedback, setActionFeedback] = useState<{
    type: "download" | "print" | "copy";
    qrId: string;
  } | null>(null);

  const flashFeedback = (type: "download" | "print" | "copy", qrId: string) => {
    setActionFeedback({ type, qrId });
    setTimeout(() => {
      setActionFeedback((prev) =>
        prev?.type === type && prev?.qrId === qrId ? null : prev,
      );
    }, 1500);
  };

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // ── Fetch data ──────────────────────────────────────────────────

  const { data: qrCodes = [], isLoading: qrLoading, error: qrError, refetch: refetchQr } = useQuery({
    queryKey: ["supervisor", "qr-codes"],
    queryFn: () => fetcher<{ success: boolean; data: QRCode[] }>("/api/supervisor/qr-codes"),
    select: (res) => (res.success ? res.data ?? [] : []),
  });

  const { data: roles = [], isLoading: rolesLoading, error: rolesError } = useQuery({
    queryKey: ["roles"],
    queryFn: () => fetcher<{ data: Role[] }>("/api/roles"),
    select: (res) => res.data ?? [],
  });

  const loading = qrLoading || rolesLoading;
  const error = qrError || rolesError;

  // ── Filter ──────────────────────────────────────────────────────

  const filtered = qrCodes.filter((qr) => {
    if (filterGroup !== "all" && qr.role_group !== filterGroup) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        qr.workstation_name.toLowerCase().includes(q) ||
        (qr.location ?? "").toLowerCase().includes(q) ||
        (qr.role_name ?? "").toLowerCase().includes(q) ||
        qr.qr_token.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Generate QR ─────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!generateForm.role_id || !generateForm.workstation_name) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/supervisor/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generateForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal membuat QR Code");
      showAlert(
        "success",
        `QR Code untuk "${generateForm.workstation_name}" berhasil dibuat`,
      );
      setShowGenerate(false);
      setGenerateForm({ role_id: "", workstation_name: "", location: "" });
      refetchQr();
    } catch (err) {
      showAlert(
        "error",
        err instanceof Error ? err.message : "Gagal membuat QR Code",
      );
    } finally {
      setGenerating(false);
    }
  };

  // ── Toggle status ───────────────────────────────────────────────

  const handleToggle = async () => {
    if (!toggleQR) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/supervisor/qr-codes?id=${toggleQR.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !toggleQR.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal mengubah status");
      showAlert("success", json.message ?? "Status berhasil diubah");
      setToggleQR(null);
      refetchQr();
    } catch (err) {
      showAlert(
        "error",
        err instanceof Error ? err.message : "Gagal mengubah status",
      );
    } finally {
      setToggling(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteQR) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/supervisor/qr-codes?id=${deleteQR.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Gagal menghapus QR Code");
      showAlert("success", json.message ?? "QR Code berhasil dihapus");
      setDeleteQR(null);
      if (selectedQR?.id === deleteQR.id) setSelectedQR(null);
      refetchQr();
    } catch (err) {
      showAlert(
        "error",
        err instanceof Error ? err.message : "Gagal menghapus QR Code",
      );
    } finally {
      setDeleting(false);
    }
  };

  // ── Copy / Download / Print ─────────────────────────────────────

  const handleCopyLink = (payload: string, qrId: string) => {
    navigator.clipboard.writeText(payload);
    flashFeedback("copy", qrId);
    showAlert("success", "Link QR Code disalin ke clipboard");
  };

  const handleDownload = async (qr: QRCode) => {
    try {
      const canvas = document.createElement("canvas");
      await QRCodeLib.toCanvas(canvas, qr.qr_payload, {
        width: 400,
        margin: 2,
      });
      const link = document.createElement("a");
      link.download = `QR-${qr.workstation_name.replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      flashFeedback("download", qr.id);
    } catch {
      showAlert("error", "Gagal mengunduh QR Code");
    }
  };

  const handlePrint = async (qr: QRCode) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const dataUrl = await QRCodeLib.toDataURL(qr.qr_payload, {
      width: 300,
      margin: 2,
    });
    win.document.write(`
      <html><head><title>QR Code - ${qr.workstation_name}</title>
      <style>body{text-align:center;padding:40px;font-family:sans-serif}
      img{max-width:300px;margin:20px auto;display:block}
      h2{margin-bottom:4px}h3{color:#666;font-weight:normal;margin-top:0}</style></head>
      <body>
        <h2>${qr.workstation_name}</h2>
        <h3>${formatRoleName(qr.role_name ?? "")}</h3>
        <img src="${dataUrl}" />
        <p style="color:#999;font-size:12px">Scan QR untuk login ke workstation</p>
        <script>window.print()</script>
      </body></html>
    `);
    win.document.close();
    flashFeedback("print", qr.id);
  };

  // ── Stats ───────────────────────────────────────────────────────

  const totalActive = qrCodes.filter((q) => q.is_active).length;
  const totalInactive = qrCodes.filter((q) => !q.is_active).length;
  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-carbon">
      <Sidebar
        role="supervisor"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userEmail={""}
          role="supervisor"
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Alert */}
          {alert && (
            <div
              className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                alert.type === "success"
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-200"
                  : "bg-rose-500/10 text-rose-300 border border-red-200"
              }`}
            >
              {alert.type === "success" ? (
                <Check className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              {alert.message}
            </div>
          )}

          {/* Header */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-bold text-cream">
                Kelola QR Code
              </h1>
              <p className="text-sm text-white/50">
                {qrCodes.length} QR Code tersedia
              </p>
            </div>
            <button
              onClick={() => setShowGenerate(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/100 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 active:scale-[0.98] transition-all"
            >
              <Plus className="h-4 w-4" />
              Buat QR Baru
            </button>
          </div>

          {/* Stats */}
          <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              {
                label: "Total",
                value: qrCodes.length,
                color: "text-cream",
                bg: "bg-white/10",
              },
              {
                label: "Aktif",
                value: totalActive,
                color: "text-emerald-300",
                bg: "bg-emerald-500/10",
              },
              {
                label: "Nonaktif",
                value: totalInactive,
                color: "text-white/50",
                bg: "bg-white/10",
              },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`rounded-xl ${bg} px-3 py-3 sm:px-4`}>
                <p className={`text-lg sm:text-xl font-bold ${color}`}>
                  {value}
                </p>
                <p className="text-[11px] text-white/50 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Cari workstation, role, atau token..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-gold/15 bg-cocoa py-2.5 pl-10 pr-4 text-sm text-cream placeholder:text-white/30 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100 transition"
              />
            </div>
            <div className="flex gap-1 rounded-xl border border-gold/15 bg-cocoa p-1">
              {(["all", "production", "operational"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setFilterGroup(g)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    filterGroup === g
                      ? "bg-amber-500/100 text-white shadow-sm"
                      : "text-white/50 hover:text-cream"
                  }`}
                >
                  {g === "all"
                    ? "Semua"
                    : g === "production"
                      ? "Produksi"
                      : "Operasional"}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-white/30" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <AlertTriangle className="mb-3 h-8 w-8 text-rose-400" />
              <p className="text-sm font-medium text-cream">
                {error instanceof Error ? error.message : "Gagal memuat data"}
              </p>
              <button
                onClick={() => refetchQr()}
                className="mt-4 rounded-md border border-gold/15 bg-cocoa px-4 py-2.5 text-sm text-cream hover:bg-carbon min-h-[44px]"
              >
                Coba lagi
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-gold/10 bg-cocoa py-16 text-center shadow-sm">
              <QrCode className="mx-auto mb-4 h-10 w-10 text-white/20" />
              <p className="text-sm font-medium text-white/50">
                {search || filterGroup !== "all"
                  ? "Tidak ada QR Code yang sesuai filter"
                  : "Belum ada QR Code"}
              </p>
              {!search && filterGroup === "all" && (
                <button
                  onClick={() => setShowGenerate(true)}
                  className="mt-3 text-sm font-semibold text-amber-300 hover:text-amber-300"
                >
                  + Buat QR Code pertama
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((qr) => {
                const gs =
                  ROLE_GROUP_STYLES[qr.role_group ?? ""] ??
                  ROLE_GROUP_STYLES.production;
                return (
                  <div
                    key={qr.id}
                    className={`rounded-xl border bg-cocoa shadow-sm overflow-hidden transition-all hover:shadow-md ${
                      qr.is_active
                        ? "border-gold/15"
                        : "border-gold/10 opacity-70"
                    }`}
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gold/10">
                      <div className="flex items-center gap-2 min-w-0">
                        <QrCode
                          className={`h-4 w-4 shrink-0 ${qr.is_active ? "text-white/70" : "text-white/30"}`}
                        />
                        <span className="text-sm font-semibold text-cream truncate">
                          {qr.workstation_name}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${gs.bg} ${gs.text}`}
                      >
                        {gs.label}
                      </span>
                    </div>

                    {/* QR image */}
                    <div className="flex justify-center py-4 bg-carbon/60">
                      <QRCodeImage data={qr.qr_payload} size={140} />
                    </div>

                    {/* Info */}
                    <div className="px-3 py-2 space-y-1 text-[11px] text-white/50">
                      <p>
                        Role:{" "}
                        <span className="font-medium text-cream">
                          {formatRoleName(qr.role_name ?? "-")}
                        </span>
                      </p>
                      {qr.location && (
                        <p>
                          Lokasi:{" "}
                          <span className="font-medium text-cream">
                            {qr.location}
                          </span>
                        </p>
                      )}
                      <p>
                        Token:{" "}
                        <code className="text-[10px] bg-white/10 px-1 rounded">
                          {qr.qr_token.slice(0, 20)}...
                        </code>
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${qr.is_active ? "bg-emerald-500/100" : "bg-stone-300"}`}
                        />
                        <span
                          className={
                            qr.is_active
                              ? "text-emerald-300 font-medium"
                              : "text-white/40"
                          }
                        >
                          {qr.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 px-3 py-2 border-t border-gold/10 bg-carbon/60">
                      <button
                        onClick={() => setSelectedQR(qr)}
                        className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
                        title="Detail"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(qr)}
                        className={`rounded-lg p-1.5 transition-colors ${
                          actionFeedback?.type === "download" && actionFeedback?.qrId === qr.id
                            ? "text-emerald-500 bg-emerald-500/10"
                            : "text-white/40 hover:bg-white/10 hover:text-white/70"
                        }`}
                        title={actionFeedback?.type === "download" && actionFeedback?.qrId === qr.id ? "Tersimpan" : "Download PNG"}
                      >
                        {actionFeedback?.type === "download" && actionFeedback?.qrId === qr.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handlePrint(qr)}
                        className={`rounded-lg p-1.5 transition-colors ${
                          actionFeedback?.type === "print" && actionFeedback?.qrId === qr.id
                            ? "text-emerald-500 bg-emerald-500/10"
                            : "text-white/40 hover:bg-white/10 hover:text-white/70"
                        }`}
                        title={actionFeedback?.type === "print" && actionFeedback?.qrId === qr.id ? "Tercetak" : "Print"}
                      >
                        {actionFeedback?.type === "print" && actionFeedback?.qrId === qr.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopyLink(qr.qr_payload, qr.id)}
                        className={`rounded-lg p-1.5 transition-colors ${
                          actionFeedback?.type === "copy" && actionFeedback?.qrId === qr.id
                            ? "text-emerald-500 bg-emerald-500/10"
                            : "text-white/40 hover:bg-white/10 hover:text-white/70"
                        }`}
                        title={actionFeedback?.type === "copy" && actionFeedback?.qrId === qr.id ? "Tersalin" : "Salin Link"}
                      >
                        {actionFeedback?.type === "copy" && actionFeedback?.qrId === qr.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => setToggleQR(qr)}
                        className={`rounded-lg p-1.5 transition-colors ${
                          qr.is_active
                            ? "text-amber-500 hover:bg-amber-500/100/10 hover:text-amber-300"
                            : "text-emerald-500 hover:bg-emerald-500/100/10 hover:text-emerald-300"
                        }`}
                        title={qr.is_active ? "Nonaktifkan" : "Aktifkan"}
                      >
                        {qr.is_active ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteQR(qr)}
                        className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/100/10 hover:text-rose-300 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ── Generate Modal ─────────────────────────────────────────── */}
      {showGenerate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowGenerate(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-cocoa p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-cream">
                Buat QR Code Baru
              </h2>
              <button
                onClick={() => setShowGenerate(false)}
                className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white/70"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Role Workstation
                </label>
                <select
                  value={generateForm.role_id}
                  onChange={(e) =>
                    setGenerateForm((f) => ({ ...f, role_id: e.target.value }))
                  }
                  className="w-full rounded-xl border border-gold/15 bg-cocoa px-3.5 py-2.5 text-sm text-cream focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                >
                  <option value="">Pilih role...</option>
                  {roles
                    .filter((r) =>
                      ["production", "operational"].includes(r.role_group)
                    )
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name} ({role.role_group})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Nama Workstation
                </label>
                <input
                  type="text"
                  value={generateForm.workstation_name}
                  onChange={(e) =>
                    setGenerateForm((f) => ({
                      ...f,
                      workstation_name: e.target.value,
                    }))
                  }
                  placeholder="Contoh: Meja Kerja 1, Stasiun QC A"
                  className="w-full rounded-xl border border-gold/15 bg-cocoa px-3.5 py-2.5 text-sm text-cream placeholder:text-white/30 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5">
                  Lokasi (opsional)
                </label>
                <input
                  type="text"
                  value={generateForm.location}
                  onChange={(e) =>
                    setGenerateForm((f) => ({ ...f, location: e.target.value }))
                  }
                  placeholder="Contoh: Lantai 1, Ruang Produksi"
                  className="w-full rounded-xl border border-gold/15 bg-cocoa px-3.5 py-2.5 text-sm text-cream placeholder:text-white/30 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowGenerate(false)}
                className="flex-1 rounded-xl border border-gold/15 bg-cocoa py-2.5 text-sm font-medium text-white/70 hover:bg-carbon transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleGenerate}
                disabled={
                  !generateForm.role_id ||
                  !generateForm.workstation_name ||
                  generating
                }
                className="flex-1 rounded-xl bg-amber-500/100 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                {generating ? "Membuat..." : "Buat QR Code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ───────────────────────────────────────────── */}
      {selectedQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedQR(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-cocoa p-6 shadow-xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inline-block rounded-xl bg-white p-4 mx-auto mb-2">
              <QRCodeImage data={selectedQR.qr_payload} size={200} />
            </div>
            <h3 className="mt-4 text-base font-bold text-cream">
              {selectedQR.workstation_name}
            </h3>
            <p className="text-sm text-white/50">{formatRoleName(selectedQR.role_name ?? "-")}</p>
            {selectedQR.location && (
              <p className="text-xs text-white/40 mt-1">
                {selectedQR.location}
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => handleDownload(selectedQR)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                  actionFeedback?.type === "download" && actionFeedback?.qrId === selectedQR.id
                    ? "border-emerald-200 bg-emerald-500/10 text-emerald-300"
                    : "border-gold/15 text-white/70 hover:bg-carbon"
                }`}
              >
                {actionFeedback?.type === "download" && actionFeedback?.qrId === selectedQR.id ? (
                  <><Check className="h-3 w-3" /> Tersimpan</>
                ) : (
                  <><Download className="h-3 w-3" /> Download</>
                )}
              </button>
              <button
                onClick={() => handlePrint(selectedQR)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                  actionFeedback?.type === "print" && actionFeedback?.qrId === selectedQR.id
                    ? "border-emerald-200 bg-emerald-500/10 text-emerald-300"
                    : "border-gold/15 text-white/70 hover:bg-carbon"
                }`}
              >
                {actionFeedback?.type === "print" && actionFeedback?.qrId === selectedQR.id ? (
                  <><Check className="h-3 w-3" /> Tercetak</>
                ) : (
                  <><Printer className="h-3 w-3" /> Print</>
                )}
              </button>
              <button
                onClick={() => handleCopyLink(selectedQR.qr_payload, selectedQR.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                  actionFeedback?.type === "copy" && actionFeedback?.qrId === selectedQR.id
                    ? "border-emerald-200 bg-emerald-500/10 text-emerald-300"
                    : "border-gold/15 text-white/70 hover:bg-carbon"
                }`}
              >
                {actionFeedback?.type === "copy" && actionFeedback?.qrId === selectedQR.id ? (
                  <><Check className="h-3 w-3" /> Tersalin</>
                ) : (
                  <><Copy className="h-3 w-3" /> Salin Link</>
                )}
              </button>
            </div>
            <div className="mt-4 text-left space-y-1 text-xs text-white/50 bg-carbon rounded-xl px-3 py-2.5">
              <p>
                Token:{" "}
                <code className="text-[10px]">{selectedQR.qr_token}</code>
              </p>
              <p>
                Payload:{" "}
                <code className="text-[10px] break-all">
                  {selectedQR.qr_payload}
                </code>
              </p>
              {selectedQR.allowed_stages?.length > 0 && (
                <p>
                  Stages:{" "}
                  {selectedQR.allowed_stages
                    .map((s) => STAGE_LABELS[s] ?? s)
                    .join(", ")}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedQR(null)}
              className="mt-5 w-full rounded-xl bg-stone-800 py-2.5 text-sm font-medium text-white hover:bg-stone-900 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* ── Toggle Confirm ─────────────────────────────────────────── */}
      {toggleQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setToggleQR(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-cocoa p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-cream">
                  {toggleQR.is_active
                    ? "Nonaktifkan QR Code?"
                    : "Aktifkan QR Code?"}
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  {toggleQR.is_active
                    ? `QR Code "${toggleQR.workstation_name}" tidak bisa digunakan saat nonaktif`
                    : `QR Code "${toggleQR.workstation_name}" akan bisa digunakan kembali`}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setToggleQR(null)}
                className="flex-1 rounded-xl border border-gold/15 py-2.5 text-sm font-medium text-white/70 hover:bg-carbon transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleToggle}
                disabled={toggling}
                className="flex-1 rounded-xl bg-amber-500/100 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {toggling && <Loader2 className="h-4 w-4 animate-spin" />}
                {toggling
                  ? "Memproses..."
                  : toggleQR.is_active
                    ? "Nonaktifkan"
                    : "Aktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ─────────────────────────────────────────── */}
      {deleteQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeleteQR(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-cocoa p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-cream">
                  Hapus QR Code?
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  QR Code untuk <strong>{deleteQR.workstation_name}</strong>{" "}
                  akan dihapus permanen
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteQR(null)}
                className="flex-1 rounded-xl border border-gold/15 py-2.5 text-sm font-medium text-white/70 hover:bg-carbon transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-rose-500/100 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
