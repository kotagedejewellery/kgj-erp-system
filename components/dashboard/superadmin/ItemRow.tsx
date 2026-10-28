"use client";

import React, { useState, useEffect } from "react";
import { Check, StickyNote, Trash2, Clock, X, Plus, Paperclip } from "lucide-react";
import { C } from "@/app/dashboard/superadmin/management/_shared/constants";
import { Diamond } from "@/components/dashboard/superadmin/Diamond";

function getStatusLabel(status: string | null) {
  switch (status) {
    case "approved": return "Disetujui";
    case "selesai": return "Selesai";
    case "waiting_review": return "Review";
    case "rejected": return "Ditolak";
    case "proses": return "Proses";
    default: return "Belum";
  }
}

interface ItemRowProps {
  item: { id: string; title: string; progress: Array<{ id?: string; is_completed: boolean; status: string | null; completed_at: string | null; admin_notes: string | null; notes: string | null; kendala: string | null; review_notes?: string | null }> | null };
  notesOpen: boolean;
  isCycling: boolean;
  isSaving: boolean;
  isFlashing: boolean;
  notesValue: string;
  kendalaValue: string;
  onSetStatus: (itemId: string, status: string) => Promise<void>;
  onToggleNotes: (itemId: string) => void;
  onNotesChange: (itemId: string, value: string) => void;
  onKendalaChange: (itemId: string, value: string) => void;
  onSaveNote: (itemId: string, field: "notes" | "kendala", value: string) => void;
  onDelete: (itemId: string, title: string) => void;
  attachments?: { id: string; file_name: string; public_url: string; mime_type: string }[];
  attachmentOnUpload?: (itemId: string, file: File) => Promise<void>;
  attachmentOnDelete?: (itemId: string, attachId: string) => Promise<void>;
  attachmentShowAlert?: (type: "success" | "error", message: string) => void;
  attachmentFetch?: (itemId: string) => Promise<void>;
}

interface Segment {
  key: string;
  label: string;
  activeBg: string;
  activeColor: string;
  border: string;
  textColor: string;
}

const SEGMENTS: Segment[] = [
  { key: "belum", label: "Belum", activeBg: "#fef2f2", activeColor: "#dc2626", border: "#dc2626", textColor: "#dc2626" },
  { key: "proses", label: "Proses", activeBg: "#fff7ed", activeColor: "#ea580c", border: "#ea580c", textColor: "#ea580c" },
  { key: "waiting_review", label: "Review", activeBg: "#a78bfa22", activeColor: "#a78bfa", border: "#a78bfa", textColor: "#a78bfa" },
  { key: "done", label: "Done", activeBg: "#ecfdf5", activeColor: "#059669", border: "#059669", textColor: "#059669" },
];

export function ItemRow({
  item,
  notesOpen,
  isCycling,
  isSaving,
  isFlashing,
  notesValue,
  kendalaValue,
  onSetStatus,
  onToggleNotes,
  onNotesChange,
  onKendalaChange,
  onSaveNote,
  onDelete,
  attachments,
  attachmentOnUpload,
  attachmentOnDelete,
  attachmentShowAlert,
  attachmentFetch,
}: ItemRowProps) {
  const status = item.progress?.[0]?.status ?? null;
  const [bounce, setBounce] = useState(false);
  const [attachUploading, setAttachUploading] = useState(false);
  useEffect(() => { attachmentFetch?.(item.id); }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isCycling) { setBounce(true); const t = setTimeout(() => setBounce(false), 300); return () => clearTimeout(t); }
  }, [isCycling]);

  const isLocked = status === "waiting_review" || status === "approved";
  const reviewNotes = (item.progress?.[0] as { review_notes?: string | null } | undefined)?.review_notes ?? null;

  const isSegmentActive = (segKey: string) => {
    if (status === "approved" || status === "selesai") return segKey === "done";
    if (status === "waiting_review") return segKey === "waiting_review";
    if (status === "proses") return segKey === "proses";
    if (status === "rejected") return false;
    return segKey === "belum";
  };

  const isSegmentClickable = (segKey: string) => {
    if (isCycling) return false;
    if (isLocked) return false;
    switch (status) {
      case "belum":
      case null:
        return segKey === "proses";
      case "proses":
        return segKey === "belum" || segKey === "waiting_review";
      case "rejected":
        return segKey === "proses";
      default:
        return false;
    }
  };

  const getHint = () => {
    if (status === "belum" || status === null) return "Klik Proses untuk mulai";
    if (status === "proses") return "Klik Review untuk kirim ke superadmin";
    if (status === "waiting_review") return "Menunggu review superadmin";
    if (status === "approved") return "Disetujui oleh superadmin";
    if (status === "rejected") return reviewNotes ? `Ditolak: ${reviewNotes} — klik Proses untuk ulangi` : "Ditolak — klik Proses untuk ulangi";
    return null;
  };

  const handleSegmentClick = (segKey: string) => {
    if (!isSegmentClickable(segKey)) return;
    const targetStatus = segKey === "done" ? "selesai" : segKey === "belum" ? "belum" : segKey;
    onSetStatus(item.id, targetStatus);
  };

  const notesButton = (
    <button
      onClick={(e) => { e.stopPropagation(); onToggleNotes(item.id); }}
      className="p-1 rounded transition-colors shrink-0"
      style={{ color: notesOpen ? C.gold : C.ghost, background: notesOpen ? C.raised : "transparent" }}
      tabIndex={-1}
    >
      <StickyNote className="w-3.5 h-3.5" />
    </button>
  );

  const deleteButton = (
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(item.id, item.title); }}
      className="shrink-0"
      style={{ color: C.ghost }}
      tabIndex={-1}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );

  const notesInputs = notesOpen && (
    <div className="space-y-2">
      <input
        type="text"
        value={notesValue}
        onChange={(e) => onNotesChange(item.id, e.target.value)}
        onBlur={() => onSaveNote(item.id, "notes", notesValue)}
        placeholder="Catatan..."
        disabled={isSaving}
        className="w-full rounded-md border px-2 py-1.5 text-xs P.card focus:outline-none"
        style={{ borderColor: C.border, color: C.sepia }}
      />
      <input
        type="text"
        value={kendalaValue}
        onChange={(e) => onKendalaChange(item.id, e.target.value)}
        onBlur={() => onSaveNote(item.id, "kendala", kendalaValue)}
        placeholder="Kendala..."
        disabled={isSaving}
        className="w-full rounded-md border px-2 py-1.5 text-xs P.card focus:outline-none"
        style={{ borderColor: C.border, color: C.terra }}
      />
    </div>
  );

  const adminNotes = item.progress?.[0]?.admin_notes && (
    <p className="text-[10px] flex items-center gap-1" style={{ color: C.gold }}>
      <Diamond />
      Admin: {item.progress?.[0]!.admin_notes}
    </p>
  );

  const cardStyle: React.CSSProperties = {
    background: "var(--color-parch-card, #FDF9F4)",
    borderRadius: 12,
    border: "1px solid var(--color-parch-border, #B89B5B33)",
  };

  const hint = getHint();

  const activeIdx = SEGMENTS.findIndex((s) => isSegmentActive(s.key));
  const activeSeg = activeIdx >= 0 ? SEGMENTS[activeIdx] : null;

  return (
    <div className="space-y-1">
      {/* Single Card — Segmented Bar + Item Details */}
      <div className={`${bounce ? "animate-checkbox-pop" : ""} ${isFlashing ? "opacity-50 transition-opacity duration-300" : "transition-opacity duration-300"}`} style={cardStyle}>
        {/* Top: Segmented Status Control with Sliding Pill */}
        <div className="px-2 pt-2.5 pb-2">
          <div
            className="flex items-stretch rounded-lg overflow-hidden relative p-0.5"
            style={{ gap: "2px", background: "#2A2522" }}
          >
            {/* Sliding active pill */}
            <div
              className="absolute top-0.5 bottom-0.5 rounded-md transition-all duration-350 shadow-sm"
              style={{
                left: `calc(${activeIdx * 25}% + 2px)`,
                width: `calc(25% - 4px)`,
                background: activeSeg?.activeBg ?? "#fff",
                boxShadow: activeSeg ? `0 1px 3px ${activeSeg.activeColor}20` : "none",
                transition: "left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s",
                zIndex: 0,
              }}
            />
            {SEGMENTS.map((seg) => {
              const active = isSegmentActive(seg.key);
              const clickable = isSegmentClickable(seg.key);
              return (
                <button
                  key={seg.key}
                  onClick={() => handleSegmentClick(seg.key)}
                  disabled={!clickable}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-semibold relative z-10 transition-colors duration-200"
                  style={{
                    color: active ? seg.activeColor : clickable ? seg.textColor : "#d1d5db",
                    cursor: clickable ? "pointer" : isLocked ? "not-allowed" : "default",
                    opacity: clickable && !active ? 0.75 : active ? 1 : 0.5,
                  }}
                  onMouseDown={(e) => {
                    if (!clickable) return;
                    (e.currentTarget as HTMLElement).style.transform = "scale(0.96)";
                  }}
                  onMouseUp={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                  }}
                  title={clickable ? `${seg.label} — klik` : isLocked ? "Terkunci" : seg.key === "done" ? "Menunggu approval superadmin" : ""}
                  tabIndex={-1}
                >
                  {active && seg.key === "waiting_review" && <Clock className="w-3 h-3" />}
                  {active && seg.key === "done" && <Check className="w-3 h-3" />}
                  {seg.label}
                </button>
              );
            })}
          </div>
        </div>
        {hint && (
          <p className="text-[10px] px-3 pb-2" style={{ color: status === "rejected" ? "#dc2626" : status === "approved" ? "#059669" : "var(--color-text-faded, #9ca3af)" }}>
            {hint}
          </p>
        )}

        {/* Divider */}
        <div className="mx-3" style={{ borderTop: "1px solid var(--color-parch-border, #B89B5B22)" }} />

        {/* Bottom: Item Details */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm flex-1 min-w-0" style={{ color: status === "selesai" ? C.faded : C.ink, textDecoration: status === "selesai" ? "line-through" : "none" }}>
              {item.title}
            </span>
            <span className="text-[10px] font-medium shrink-0" style={{ color: status === "selesai" ? C.sage : status === "proses" ? C.amber : C.terra }}>
              {getStatusLabel(status)}
            </span>
            {notesButton}
            {deleteButton}
          </div>
          {notesInputs}
          {adminNotes}
          {attachmentFetch && attachments && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {attachments.map((f) => {
                const isImage = f.mime_type?.startsWith("image/");
                return (
                  <a key={f.id} href={f.public_url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-medium hover:bg-white/5 transition-colors shrink-0 group"
                    style={{ borderColor: "#c9a22733", color: "#a78bfa" }}>
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.public_url} alt={f.file_name} className="w-4 h-4 rounded object-cover" />
                    ) : (
                      <Paperclip className="w-3 h-3" />
                    )}
                    <span className="max-w-[80px] truncate">{f.file_name}</span>
                    <button onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); attachmentOnDelete?.(item.id, f.id); }}
                      className="ml-1 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#6b7280" }}>
                      <X className="w-3 h-3" />
                    </button>
                  </a>
                );
              })}
              {attachments.length < 3 && attachmentOnUpload && (
                <label className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:bg-white/5 transition-colors shrink-0"
                  style={{ borderColor: "#c9a22733", color: "#6b7280", borderStyle: "dashed" }}>
                  {attachUploading ? "Mengunggah..." : <><Plus className="w-3 h-3" /> Lampiran</>}
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (attachments.length >= 3) { attachmentShowAlert?.("error", "Maksimal 3 lampiran"); return; }
                    setAttachUploading(true);
                    try { await attachmentOnUpload(item.id, file); } catch (err) { attachmentShowAlert?.("error", err instanceof Error ? err.message : "Gagal upload"); }
                    finally { setAttachUploading(false); e.target.value = ""; }
                  }} disabled={attachUploading} />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
