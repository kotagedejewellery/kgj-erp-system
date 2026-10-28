// app/dashboard/superadmin/kelola-qr/page.tsx

"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";
import Loading from "@/components/ui/Loading";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import QRCodeLib from "qrcode";
import { Download, Eye, MapPin, Plus, Power, QrCode, Trash2 } from "lucide-react";
import type { Role, QRCode } from "@/types/qr-code";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_GROUP_STYLES: Record<
  string,
  { label: string; bg: string; border: string; text: string }
> = {
  management: {
    label: "Manajemen",
    bg: "bg-purple-500/20",
    border: "border-purple-400/20",
    text: "text-purple-300",
  },
  operational: {
    label: "Operasional",
    bg: "bg-blue-500/20",
    border: "border-blue-400/20",
    text: "text-blue-300",
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

type AlertState = {
  type: "success" | "error" | "warning" | "info";
  message: string;
} | null;

const EMPTY_GENERATE_FORM = {
  role_id: "",
  workstation_name: "",
  location: "",
};

// ─── QR Code Generator Component ──────────────────────────────────────────────

function QRCodeImage({
  data,
  size = 200,
  className = "",
}: {
  data: string;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && data) {
      QRCodeLib.toCanvas(canvasRef.current, data, {
        width: size,
        margin: 2,
        color: {
          dark: "#111111",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      });
    }
  }, [data, size]);

  return (
    <div className={className} style={{ width: size, height: size }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

const PlusIcon = () => <Plus className="w-4 h-4" />;
const EyeIcon = () => <Eye className="w-4 h-4" />;
const PowerIcon = () => <Power className="w-4 h-4" />;
const TrashIcon = () => <Trash2 className="w-4 h-4" />;
const DownloadIcon = () => <Download className="w-4 h-4" />;

// ─── Component ────────────────────────────────────────────────────────────────

export default function KelolaQRPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);
  const [qrToDeactivate, setQrToDeactivate] = useState<QRCode | null>(null);
  const [qrToDelete, setQrToDelete] = useState<QRCode | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRoleGroup, setFilterRoleGroup] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [generateForm, setGenerateForm] = useState(EMPTY_GENERATE_FORM);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setClientUser(getClientUser());
  }, []);

  const showAlert = (
    type: NonNullable<AlertState>["type"],
    message: string,
  ) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const qrParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filterStatus !== "all") {
      params.append("is_active", filterStatus === "active" ? "true" : "false");
    }
    if (filterRoleGroup) {
      params.append("role_group", filterRoleGroup);
    }
    return params.toString();
  }, [filterStatus, filterRoleGroup]);

  const {
    data: qrCodes = [],
    isLoading: isQrLoading,
    refetch: refetchQRCodes,
  } = useQuery<QRCode[]>({
    queryKey: ["qr-codes", qrParams],
    queryFn: () =>
      fetcher<{ data: QRCode[] }>(`/api/qr-codes?${qrParams}`).then(
        (r) => r.data ?? [],
      ),
  });

  const {
    data: rolesData,
    isLoading: isRolesLoading,
  } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: () =>
      fetcher<{ data: Role[] }>("/api/roles").then((r) =>
        (r.data ?? []).filter((role: Role) =>
          ["operational", "production"].includes(role.role_group),
        ),
      ),
  });
  const roles = Array.isArray(rolesData) ? rolesData : [];

  const isLoading = isQrLoading || isRolesLoading;

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleOpenGenerateModal = () => {
    setGenerateForm(EMPTY_GENERATE_FORM);
    setIsModalOpen(true);
  };

  const handleGenerateQR = async () => {
    if (!generateForm.role_id) {
      showAlert("error", "Role harus dipilih");
      return;
    }
    if (!generateForm.workstation_name.trim()) {
      showAlert("error", "Nama workstation harus diisi");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: generateForm.role_id,
          workstation_name: generateForm.workstation_name.trim(),
          location: generateForm.location.trim() || null,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        showAlert("error", json.error || "Gagal membuat QR Code");
        return;
      }

      const roleName =
        roles.find((r) => r.id === generateForm.role_id)?.name || "";
      showAlert(
        "success",
        `QR Code untuk ${roleName} - ${generateForm.workstation_name} berhasil dibuat!`,
      );
      setIsModalOpen(false);
      setGenerateForm(EMPTY_GENERATE_FORM);
      await refetchQRCodes();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleStatus = async (qr: QRCode) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/qr-codes?id=${qr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !qr.is_active }),
      });
      const json = await res.json();

      if (!res.ok) {
        showAlert("error", json.error || "Gagal mengubah status QR Code");
        return;
      }

      showAlert(
        "success",
        `QR Code ${qr.workstation_name} ${!qr.is_active ? "diaktifkan" : "dinonaktifkan"}`,
      );
      await refetchQRCodes();
    } finally {
      setIsProcessing(false);
      setQrToDeactivate(null);
    }
  };

  const handleDeleteQR = async () => {
    if (!qrToDelete) return;

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/qr-codes?id=${qrToDelete.id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        showAlert("error", json.error || "Gagal menghapus QR Code");
        return;
      }

      showAlert(
        "success",
        `QR Code ${qrToDelete.workstation_name} berhasil dihapus`,
      );
      await refetchQRCodes();
    } finally {
      setIsProcessing(false);
      setQrToDelete(null);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!selectedQR) return;

    // Cari canvas di dalam modal detail
    const canvas = document.querySelector(
      "#qr-detail-canvas canvas",
    ) as HTMLCanvasElement;

    if (canvas) {
      const link = document.createElement("a");
      link.download = `QR-${selectedQR.workstation_name.replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diffHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffHours < 1) return "Baru saja";
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;
    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks} minggu lalu`;
  };

  const getStatusBadge = (qr: QRCode) => {
    const config = qr.is_active
      ? {
          bg: "bg-emerald-500/10 text-emerald-300 border-emerald-200",
          label: "Aktif",
          dot: "bg-emerald-500/100",
        }
      : {
          bg: "bg-[#26211c] text-white/70 border-gold/15",
          label: "Nonaktif",
          dot: "bg-slate-400",
        };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.bg}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    );
  };

  const getRoleGroupBadge = (group: string) => {
    const config = ROLE_GROUP_STYLES[group] || {
      label: group,
      bg: "bg-[#26211c]",
      border: "border-gold/15",
      text: "text-white/70",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${config.bg} ${config.border} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  const workstationStats = useMemo(
    () => ({
      total: qrCodes.length,
      active: qrCodes.filter((qr) => qr.is_active).length,
      operational: qrCodes.filter((qr) => qr.role_group === "operational")
        .length,
      production: qrCodes.filter((qr) => qr.role_group === "production").length,
    }),
    [qrCodes],
  );

  const filteredQRCodes = qrCodes.filter((qr) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      qr.workstation_name.toLowerCase().includes(search) ||
      qr.role_name?.toLowerCase().includes(search) ||
      qr.location?.toLowerCase().includes(search) ||
      qr.qr_token.toLowerCase().includes(search)
    );
  });

  const groupedQRCodes = {
    operational: filteredQRCodes.filter(
      (qr) => qr.role_group === "operational",
    ),
    production: filteredQRCodes.filter((qr) => qr.role_group === "production"),
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#26211c]">
        <Sidebar role="superadmin" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
          <main className="flex-1 overflow-y-auto p-6">
            <Loading variant="skeleton" text="Memuat data QR Code..." />
          </main>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen bg-[#26211c]">
        <Sidebar role="superadmin" />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
          <main className="flex-1 overflow-y-auto p-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-cream mb-1.5">
                  Manajemen QR Code
                </h2>
                <p className="text-white/50 text-sm">
                  Kelola QR Code untuk setiap posisi dan workstation produksi
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handleOpenGenerateModal}
                leftIcon={<PlusIcon />}
              >
                Buat QR Code
              </Button>
            </div>

            {/* Alert */}
            {alert && (
              <div className="mb-5 animate-slide-down">
                <Alert
                  type={alert.type}
                  message={alert.message}
                  onClose={() => setAlert(null)}
                  autoClose
                  duration={4000}
                />
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              <div className="bg-cocoa rounded-xl p-5 border border-gold/10 border-t-2 border-t-stone-400">
                <p className="text-white/50 text-xs mb-1.5">
                  Total Workstation
                </p>
                <p className="text-2xl font-semibold text-cream">
                  {workstationStats.total}
                </p>
              </div>
              <div className="bg-cocoa rounded-xl p-4 border border-gold/10 border-t-2 border-t-emerald-400">
                <p className="text-white/50 text-xs mb-1.5">Aktif</p>
                <p className="text-2xl font-semibold text-emerald-300">
                  {workstationStats.active}
                </p>
              </div>
              <div className="bg-cocoa rounded-xl p-4 border border-gold/10 border-t-2 border-t-blue-400">
                <p className="text-white/50 text-xs mb-1.5">Operasional</p>
                <p className="text-2xl font-semibold text-blue-300">
                  {workstationStats.operational}
                </p>
              </div>
              <div className="bg-cocoa rounded-xl p-4 border border-gold/10 border-t-2 border-t-amber-400">
                <p className="text-white/50 text-xs mb-1.5">Produksi</p>
                <p className="text-2xl font-semibold text-amber-300">
                  {workstationStats.production}
                </p>
              </div>
            </div>

            {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Cari workstation, role, atau lokasi..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 text-sm border border-gold/15 rounded-lg bg-carbon text-cream placeholder:text-white/30
                        focus:ring-2 focus:ring-gold/30 focus:border-gold/50 outline-none transition-colors"
                    />
                  </div>

                  <select
                    value={filterStatus}
                    onChange={(e) =>
                      setFilterStatus(e.target.value as typeof filterStatus)
                    }
                    className="px-3 py-2 text-sm border border-gold/15 rounded-lg bg-carbon text-cream
                      focus:ring-2 focus:ring-gold/30 outline-none"
                  >
                    <option value="all">Semua Status</option>
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </select>

                  <select
                    value={filterRoleGroup}
                    onChange={(e) => setFilterRoleGroup(e.target.value)}
                    className="px-3 py-2 text-sm border border-gold/15 rounded-lg bg-cocoa
                      focus:ring-2 focus:ring-indigo-200 outline-none min-w-[140px]"
                  >
                    <option value="">Semua Grup Role</option>
                    <option value="operational">Operasional</option>
                    <option value="production">Produksi</option>
                  </select>

                  {(searchTerm ||
                    filterStatus !== "all" ||
                    filterRoleGroup) && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setFilterStatus("all");
                        setFilterRoleGroup("");
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>

                {/* QR Code Cards Grid */}
                {filteredQRCodes.length === 0 ? (
                  <div className="bg-cocoa rounded-xl shadow-sm border border-gold/10 p-12 text-center">
                    <p className="text-white/50 text-sm">
                      {searchTerm || filterStatus !== "all" || filterRoleGroup
                        ? "Tidak ada QR Code yang sesuai dengan filter."
                        : "Belum ada QR Code. Klik 'Buat QR Code' untuk membuat."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedQRCodes.operational.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-white/70 mb-3">
                          Operasional
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupedQRCodes.operational.map((qr) => (
                            <QRCodeCard
                              key={qr.id}
                              qr={qr}
                              onView={() => setSelectedQR(qr)}
                              onToggleStatus={() => setQrToDeactivate(qr)}
                              onDelete={() => setQrToDelete(qr)}
                              getStatusBadge={getStatusBadge}
                              getRoleGroupBadge={getRoleGroupBadge}
                              formatRelativeTime={formatRelativeTime}
                              isProcessing={isProcessing}
                              stageLabels={STAGE_LABELS}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {groupedQRCodes.production.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-white/70 mb-3">
                          Produksi
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupedQRCodes.production.map((qr) => (
                            <QRCodeCard
                              key={qr.id}
                              qr={qr}
                              onView={() => setSelectedQR(qr)}
                              onToggleStatus={() => setQrToDeactivate(qr)}
                              onDelete={() => setQrToDelete(qr)}
                              getStatusBadge={getStatusBadge}
                              getRoleGroupBadge={getRoleGroupBadge}
                              formatRelativeTime={formatRelativeTime}
                              isProcessing={isProcessing}
                              stageLabels={STAGE_LABELS}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
          </main>
        </div>
      </div>

      {/* Modal Generate QR */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isGenerating && setIsModalOpen(false)}
        title="Buat QR Code Baru"
        size="md"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-cream mb-1.5">
              Role / Posisi
            </label>
            <select
              value={generateForm.role_id}
              onChange={(e) =>
                setGenerateForm({ ...generateForm, role_id: e.target.value })
              }
              className="w-full px-4 py-2.5 text-sm border border-gold/15 rounded-lg 
                focus:ring-2 focus:ring-gold/30 focus:border-gold/50 outline-none bg-carbon text-cream"
              disabled={isGenerating}
            >
              <option value="">Pilih Role</option>
              {(["operational", "production"] as const).map((group) => {
                const groupRoles = roles.filter((r) => r.role_group === group);
                if (groupRoles.length === 0) return null;
                return (
                  <optgroup key={group} label={ROLE_GROUP_STYLES[group]?.label}>
                    {groupRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            {generateForm.role_id && (() => {
              const selected = roles.find((r) => r.id === generateForm.role_id);
              const stages = selected?.allowed_stages ?? [];
              if (stages.length === 0) return null;
              return (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {stages.map((s) => (
                    <span key={s} className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-indigo-500/[0.12] text-indigo-300 border border-indigo-400/20">
                      {STAGE_LABELS[s] ?? s}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>

          <Input
            label="Nama Workstation"
            value={generateForm.workstation_name}
            onChange={(e) =>
              setGenerateForm({
                ...generateForm,
                workstation_name: e.target.value,
              })
            }
            placeholder="Contoh: Meja Racik 1, Mesin Laser 2, Area Lebur"
            disabled={isGenerating}
          />

          <Input
            label="Lokasi (Opsional)"
            value={generateForm.location}
            onChange={(e) =>
              setGenerateForm({ ...generateForm, location: e.target.value })
            }
            placeholder="Contoh: Lantai 1 - Area Produksi"
            disabled={isGenerating}
          />

          <div className="bg-blue-500/[0.08] rounded-lg p-3 text-xs text-blue-300">
            <span className="font-medium">Info:</span> QR Code ini akan
            digunakan di workstation. Pekerja akan scan QR ini untuk mencatat
            aktivitas pengerjaan order.
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gold/10">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isGenerating}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerateQR}
              isLoading={isGenerating}
              disabled={
                !generateForm.role_id || !generateForm.workstation_name.trim()
              }
            >
              Buat QR Code
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Detail QR */}
      <Modal
        isOpen={!!selectedQR}
        onClose={() => { setSelectedQR(null); setCopiedLink(false); }}
        title="Detail QR Code"
        size="md"
      >
        {selectedQR && (
          <div className="space-y-5">
            {/* QR Code Image */}
            <div id="qr-detail-canvas">
              <div className="flex justify-center">
                <div className="bg-cocoa p-6 rounded-xl border border-gold/15 shadow-sm">
                  <QRCodeImage
                    data={selectedQR.qr_payload || selectedQR.qr_token}
                    size={220}
                  />
                </div>
              </div>
            </div>

            {/* Detail Info */}
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between py-2 px-3 bg-[#26211c] rounded-lg">
                <span className="text-white/50">Workstation</span>
                <span className="font-medium text-cream">
                  {selectedQR.workstation_name}
                </span>
              </div>
              <div className="flex justify-between py-2 px-3">
                <span className="text-white/50">Role</span>
                <span className="font-medium text-cream">
                  {selectedQR.role_name}
                </span>
              </div>
              <div className="flex justify-between py-2 px-3 bg-[#26211c] rounded-lg">
                <span className="text-white/50">Grup Role</span>
                {getRoleGroupBadge(selectedQR.role_group || "")}
              </div>
              {selectedQR.allowed_stages && selectedQR.allowed_stages.length > 0 && (
                <div className="py-2 px-3">
                  <p className="text-white/50 text-sm mb-2">Tahap yang Ditangani</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedQR.allowed_stages.map((s) => (
                      <span key={s} className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-indigo-500/[0.12] text-indigo-300 border border-indigo-400/20">
                        {STAGE_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedQR.location && (
                <div className="flex justify-between py-2 px-3">
                  <span className="text-white/50">Lokasi</span>
                  <span className="text-cream">{selectedQR.location}</span>
                </div>
              )}
              <div className="py-2.5 px-3 bg-[#26211c] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/50">Link QR</span>
                  <button
                    onClick={() => handleCopyLink(selectedQR.qr_payload)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                      copiedLink
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-cocoa text-indigo-300 border border-gold/15 hover:bg-indigo-500/10"
                    }`}
                  >
                    {copiedLink ? "✓ Tersalin!" : "Salin"}
                  </button>
                </div>
                <p className="text-[11px] font-mono text-white/70 break-all leading-relaxed">
                  {selectedQR.qr_payload}
                </p>
              </div>
              <div className="flex justify-between py-2 px-3">
                <span className="text-white/50">Status</span>
                {getStatusBadge(selectedQR)}
              </div>
              <div className="flex justify-between py-2 px-3 bg-[#26211c] rounded-lg">
                <span className="text-white/50">Dibuat</span>
                <span className="text-cream">
                  {formatDate(selectedQR.generated_at)}
                </span>
              </div>
              {selectedQR.expired_at && (
                <div className="flex justify-between py-2 px-3">
                  <span className="text-white/50">Kadaluarsa</span>
                  <span className="text-cream">
                    {formatDate(selectedQR.expired_at)}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gold/10">
              <Button
                variant="secondary"
                onClick={handleDownloadQR}
                leftIcon={<DownloadIcon />}
                className="flex-1"
              >
                Download
              </Button>
              <Button
                variant="primary"
                onClick={() => setSelectedQR(null)}
                className="flex-1"
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={!!qrToDeactivate}
        variant="warning"
        title={
          qrToDeactivate?.is_active
            ? "Nonaktifkan QR Code?"
            : "Aktifkan QR Code?"
        }
        message={
          qrToDeactivate
            ? qrToDeactivate.is_active
              ? `QR Code untuk "${qrToDeactivate.workstation_name}" (${qrToDeactivate.role_name}) akan dinonaktifkan.`
              : `QR Code untuk "${qrToDeactivate.workstation_name}" (${qrToDeactivate.role_name}) akan diaktifkan kembali.`
            : ""
        }
        confirmText={
          qrToDeactivate?.is_active ? "Ya, Nonaktifkan" : "Ya, Aktifkan"
        }
        cancelText="Batal"
        isLoading={isProcessing}
        onConfirm={() => qrToDeactivate && handleToggleStatus(qrToDeactivate)}
        onCancel={() => !isProcessing && setQrToDeactivate(null)}
      />

      <ConfirmDialog
        isOpen={!!qrToDelete}
        variant="danger"
        title="Hapus QR Code?"
        message={
          qrToDelete
            ? `QR Code untuk "${qrToDelete.workstation_name}" (${qrToDelete.role_name}) akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
            : ""
        }
        confirmText="Ya, Hapus"
        cancelText="Batal"
        isLoading={isProcessing}
        onConfirm={handleDeleteQR}
        onCancel={() => !isProcessing && setQrToDelete(null)}
      />
    </>
  );
}

// ─── QR Code Card Component ───────────────────────────────────────────────────

interface QRCodeCardProps {
  qr: QRCode;
  onView: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  getStatusBadge: (qr: QRCode) => React.ReactNode;
  getRoleGroupBadge: (group: string) => React.ReactNode;
  formatRelativeTime: (iso: string) => string;
  isProcessing: boolean;
  stageLabels: Record<string, string>;
}

function QRCodeCard({
  qr,
  onView,
  onToggleStatus,
  onDelete,
  getStatusBadge,
  getRoleGroupBadge,
  formatRelativeTime,
  isProcessing,
  stageLabels,
}: QRCodeCardProps) {
  return (
    <div className="bg-cocoa rounded-xl shadow-sm border border-gold/10 hover:shadow-md transition-all duration-200">
      <div className="p-5">
        {/* Header dengan QR preview */}
        <div className="flex items-start gap-3 mb-4">
          {/* Icon QR sebagai ganti preview */}
          <div className="flex-shrink-0 w-10 h-10 bg-[#26211c] rounded-lg border border-gold/15 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-white/40" />
          </div>

          {/* Info dan Status */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <h4 className="font-medium text-cream truncate text-sm">
                  {qr.workstation_name}
                </h4>
                <p className="text-xs text-white/50 mt-0.5">{qr.role_name}</p>
              </div>
              {getStatusBadge(qr)}
            </div>
          </div>
        </div>

        {/* Info tambahan */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2">
            {getRoleGroupBadge(qr.role_group || "")}
          </div>
          {qr.allowed_stages && qr.allowed_stages.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {qr.allowed_stages.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-white/10 text-white/70"
                >
                  {stageLabels[s] ?? s}
                </span>
              ))}
            </div>
          )}
          {qr.location && (
            <p className="text-xs text-white/50 truncate flex items-center gap-1">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              {qr.location}
            </p>
          )}
          <p className="text-xs text-white/40">
            Dibuat {formatRelativeTime(qr.generated_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-3 border-t border-gold/10">
          <button
            onClick={onView}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/70 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Lihat detail"
            disabled={isProcessing}
          >
            <EyeIcon />
            <span>Detail</span>
          </button>

          <button
            onClick={onToggleStatus}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              qr.is_active
                ? "text-amber-300 hover:text-amber-300 hover:bg-amber-500/100/10"
                : "text-emerald-300 hover:text-emerald-300 hover:bg-emerald-500/100/10"
            }`}
            title={qr.is_active ? "Nonaktifkan" : "Aktifkan"}
            disabled={isProcessing}
          >
            <PowerIcon />
            <span>{qr.is_active ? "Nonaktifkan" : "Aktifkan"}</span>
          </button>

          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/50 hover:text-rose-300 hover:bg-rose-500/100/10 rounded-lg transition-colors ml-auto"
            title="Hapus QR"
            disabled={isProcessing}
          >
            <TrashIcon />
            <span>Hapus</span>
          </button>
        </div>
      </div>
    </div>
  );
}
