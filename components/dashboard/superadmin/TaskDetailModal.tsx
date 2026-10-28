"use client";

import React, { useEffect, useCallback, useState } from "react";
import { X, MessageSquare, AlertCircle, ChevronDown, ChevronRight, Check, Clock, Paperclip, CheckCircle } from "lucide-react";
import Input from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { ROLE_DISPLAY } from "@/app/dashboard/superadmin/management/_shared/constants";
import { formatRelativeDeadline } from "@/lib/format";
import { computeOverdueDays, getOverdueSeverity, getReviewWaitingDays } from "@/lib/overdue";

interface ProgressRow {
  id: string;
  is_completed: boolean;
  completed_at: string | null;
  status: string | null;
  admin_notes: string | null;
  notes: string | null;
  kendala: string | null;
  review_notes: string | null;
}

interface TaskItem {
  id: string;
  title: string;
  sort_order: number;
  progress: ProgressRow[] | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  items: TaskItem[] | null;
}

interface Manager {
  id: string;
  full_name: string;
  username: string;
  role_name: string;
  tasks: Task[];
}

export function TaskDetailModal({
  manager,
  noteInput,
  setNoteInput,
  onSaveNote,
  onClose,
  onReview,
}: {
  manager: Manager;
  noteInput: Record<string, string>;
  setNoteInput: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  onSaveNote: (progressId: string) => Promise<void>;
  onClose: () => void;
  onReview?: (itemId: string, action: "approve" | "reject", notes?: string) => Promise<void>;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const allItems = manager.tasks.flatMap((task) =>
    (task.items ?? []).map((item) => ({ item, task })),
  );

  const itemsByTask = useCallback(() => {
    return manager.tasks.map((task) => ({
      task,
      items: (task.items ?? []).map((item) => ({ item, task })),
    }));
  }, [manager.tasks])();

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    const s = new Set<string>();
    manager.tasks.forEach((t) => s.add(t.id));
    return s;
  });

  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [bulkRejectNotes, setBulkRejectNotes] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const [attachments, setAttachments] = useState<Record<string, { id: string; file_name: string; public_url: string; mime_type: string }[]>>({});
  const [attachmentsLoading, setAttachmentsLoading] = useState<Record<string, boolean>>({});

  const fetchAttachmentsForItem = async (itemId: string) => {
    if (attachments[itemId] || attachmentsLoading[itemId]) return;
    setAttachmentsLoading((p) => ({ ...p, [itemId]: true }));
    try {
      const res = await fetch(`/api/management/tasks/items/${itemId}/attachments`);
      if (res.ok) { const data = await res.json(); setAttachments((p) => ({ ...p, [itemId]: data })); }
    } catch { /* silent */ }
    finally { setAttachmentsLoading((p) => ({ ...p, [itemId]: false })); }
  };

  useEffect(() => {
    allItems.forEach(({ item }) => { fetchAttachmentsForItem(item.id); });
  }, [manager.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [confirmAction, setConfirmAction] = useState<{
    itemId?: string;
    action: "approve" | "reject";
    notes?: string;
    isBulk: boolean;
    title: string;
    message: string;
  } | null>(null);

  const executeConfirm = async () => {
    if (!confirmAction || !onReview) return;
    const { action, notes, isBulk } = confirmAction;
    setBulkProcessing(true);
    try {
      if (isBulk) {
        const items = manager.tasks.flatMap((t) => (t.items ?? []).filter((i) => i.progress?.[0]?.status === "waiting_review"));
        for (const item of items) {
          await onReview(item.id, action, action === "reject" ? bulkRejectNotes : undefined);
        }
        setBulkRejectNotes("");
      } else {
        await onReview(confirmAction.itemId!, action, notes);
        setRejectNotes((p) => { const c = { ...p }; delete c[confirmAction.itemId!]; return c; });
      }
    } finally {
      setBulkProcessing(false);
      setConfirmAction(null);
    }
  };

  const pendingCount = manager.tasks.flatMap((t) => (t.items ?? []).filter((i) => i.progress?.[0]?.status === "waiting_review")).length;

  const toggleTask = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const getStatusDisplay = (status: string | null) => {
    switch (status) {
      case "approved": return { bg: "#34d39922", color: "#34d399", icon: <CheckCircle className="h-3 w-3" />, label: "Disetujui" };
      case "waiting_review": return { bg: "#a78bfa22", color: "#a78bfa", icon: <Clock className="h-3 w-3" />, label: "Review" };
      case "rejected": return { bg: "#f8717122", color: "#f87171", icon: <X className="h-3 w-3" />, label: "Ditolak" };
      case "selesai": return { bg: "#34d39922", color: "#34d399", icon: <Check className="h-3 w-3" />, label: "Selesai" };
      case "proses": return { bg: "#f9731622", color: "#f97316", icon: <Clock className="h-3 w-3" />, label: "Proses" };
      default: return { bg: "#f8717122", color: "#f87171", icon: <X className="h-3 w-3" />, label: "Belum" };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: "#2A2522", border: "1px solid #c9a22733" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
          style={{ background: "#a78bfa22", borderBottom: "1px solid #c9a22733" }}
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#a78bfa" }}>Task Detail</p>
            <p className="text-lg font-bold leading-tight mt-0.5" style={{ color: "#F5EFE3" }}>{manager.full_name}</p>
            <p className="text-xs" style={{ color: "#a8a29e" }}>{ROLE_DISPLAY[manager.role_name] ?? manager.role_name} · {allItems.length} items</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 transition-all duration-150 active:scale-[0.92] hover:bg-white/5" style={{ color: "#a8a29e" }} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {itemsByTask.map(({ task, items }) => {
                const isExpanded = expandedTasks.has(task.id);
                const total = task.items?.length ?? 0;
                return (
                  <React.Fragment key={task.id}>
                    <tr className="cursor-pointer" onClick={() => toggleTask(task.id)} style={{ borderBottom: "1px solid #c9a22733", background: "transparent" }}>
                      <td className="px-5 py-3" colSpan={2}>
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} /> : <ChevronRight className="h-3.5 w-3.5" style={{ color: "#a78bfa" }} />}
                          <span className="text-sm font-semibold" style={{ color: "#F5EFE3" }}>{task.title}</span>
                          <span className="text-[10px] ml-1" style={{ color: "#a8a29e" }}>({total} subtask)</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" colSpan={3} />
                    </tr>
                    {isExpanded && (
                      <tr style={{ borderBottom: "1px solid #c9a22733", background: "transparent" }}>
                        <td className="px-5 py-1.5" />
                        <td className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#a8a29e" }}>Subtask</td>
                        <td className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#a8a29e" }}>Status</td>
                        <td className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#a8a29e" }}>Catatan</td>
                        <td className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "#a8a29e" }}>Kendala</td>
                      </tr>
                    )}
                    {isExpanded && items.map(({ item }, subIdx) => {
                      const pg = item.progress?.[0];
                      const status = pg?.status ?? "belum";
                      const rel = formatRelativeDeadline(task.deadline, status);
                      const st = getStatusDisplay(status);
                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid #c9a22733" }}>
                          <td className="px-5 py-2.5" style={{ color: "#a8a29e" }}>{subIdx + 1}</td>
                          <td className="px-4 py-2.5">
                            <div style={{ color: "#E8E2D4" }}>{item.title}</div>
                            {task.deadline && <span className="text-[11px]" style={{ color: rel.isUrgent ? "#f87171" : "#a8a29e" }}>{rel.label}</span>}
                            {(attachments[item.id]?.length ?? 0) > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-1.5">
                                {(attachments[item.id] ?? []).map((f) => {
                                  const isImg = f.mime_type?.startsWith("image/");
                                  return (
                                    <a key={f.id} href={f.public_url} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium hover:bg-purple-500/10 transition-colors shrink-0"
                                      style={{ borderColor: "#c9a22733", color: "#a78bfa" }}>
                                      {isImg ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={f.public_url} alt={f.file_name} className="w-3.5 h-3.5 rounded object-cover" />
                                      ) : (
                                        <Paperclip className="w-3 h-3" />
                                      )}
                                      <span className="max-w-[80px] truncate">{f.file_name}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium rounded-lg" style={{ background: st.bg, color: st.color }}>
                                {st.icon}{st.label}
                              </span>
                              {(() => {
                                const od = computeOverdueDays(task.deadline);
                                const sev = getOverdueSeverity(od);
                                const isOverdueStatus = status !== "approved" && status !== "selesai" && status !== "waiting_review";
                                if (sev && isOverdueStatus) {
                                  return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-lg" style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.color}33` }}><AlertCircle className="h-2.5 w-2.5" />{sev.label}</span>;
                                }
                                if (status === "waiting_review") {
                                  const rd = getReviewWaitingDays(pg?.completed_at ?? null);
                                  if (rd > 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-lg" style={{ background: "#a78bfa22", color: "#a78bfa", border: "1px solid #a78bfa" }}><Clock className="h-2.5 w-2.5" />Menunggu review {rd} hari</span>;
                                }
                                return null;
                              })()}
                              {status === "waiting_review" && onReview && (
                                <div className="space-y-1.5">
                                  <button onClick={() => setConfirmAction({ itemId: item.id, action: "approve", isBulk: false, title: "Setujui tugas ini?", message: `"${item.title}" akan disetujui. Leader akan mendapat notifikasi.` })}
                                    className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-white active:scale-[0.96] transition-all w-full" style={{ background: "#34d399" }}>Setujui</button>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={rejectNotes[item.id] ?? ""}
                                      onChange={(e) => setRejectNotes((p) => ({ ...p, [item.id]: e.target.value }))}
                                      placeholder="Alasan tolak..."
                                      className="flex-1 min-w-0 rounded-md border px-2 py-0.5 text-[10px] outline-none"
                                      style={{ borderColor: "#c9a22733", color: "#F5EFE3" }}
                                    />
                                    <button onClick={() => { const n = rejectNotes[item.id]?.trim(); if (!n) return; setConfirmAction({ itemId: item.id, action: "reject", notes: n, isBulk: false, title: "Tolak tugas ini?", message: `"${item.title}" akan ditolak dengan alasan: "${n}"` }); }}
                                      className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-white active:scale-[0.96] transition-all shrink-0 disabled:opacity-50"
                                      style={{ background: "#f87171" }}
                                      disabled={!rejectNotes[item.id]?.trim()}>
                                      Tolak
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Input value={noteInput[pg?.id ?? ""] ?? pg?.admin_notes ?? ""}
                                  onChange={(e) => setNoteInput((p) => ({ ...p, [pg?.id ?? ""]: e.target.value }))}
                                  onBlur={() => { if (pg?.id) onSaveNote(pg.id); }}
                                  placeholder="Tambah catatan..." className="text-xs" />
                                {pg?.admin_notes && <MessageSquare className="h-3 w-3 shrink-0" style={{ color: "#a8a29e" }} />}
                              </div>
                              {pg?.notes && <p className="text-[11px]" style={{ color: "#a8a29e" }}>{pg.notes}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {pg?.kendala ? <p className="text-[11px] flex items-center gap-1" style={{ color: "#f87171" }}><AlertCircle className="h-3 w-3" />{pg.kendala}</p>
                            : pg?.review_notes ? <p className="text-[11px]" style={{ color: "#a78bfa" }}>{status === "rejected" ? "Alasan tolak: " : "Catatan: "}{pg.review_notes}</p>
                            : <span className="text-[11px]" style={{ color: "#a8a29e" }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 shrink-0 gap-3" style={{ borderTop: "1px solid #c9a22733", background: "#1C1917" }}>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && onReview && (
              <>
                <button type="button" onClick={() => setConfirmAction({ action: "approve", isBulk: true, title: "Setujui semua?", message: `${pendingCount} tugas akan disetujui. Leader akan mendapat notifikasi.` })}
                  disabled={bulkProcessing}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all active:scale-[0.96] disabled:opacity-50"
                  style={{ background: "#34d399" }}>
                  Setujui Semua ({pendingCount})
                </button>
                <div className="flex items-center gap-1">
                  <input type="text" value={bulkRejectNotes} onChange={(e) => setBulkRejectNotes(e.target.value)}
                    placeholder="Alasan tolak semua..." disabled={bulkProcessing}
                    className="rounded-lg border px-2 py-1.5 text-[10px] outline-none w-40"
                    style={{ borderColor: "#c9a22733", color: "#F5EFE3" }} />
                  <button type="button" onClick={() => { if (!bulkRejectNotes.trim()) return; setConfirmAction({ action: "reject", isBulk: true, title: "Tolak semua?", message: `${pendingCount} tugas akan ditolak dengan alasan: "${bulkRejectNotes.trim()}"` }); }}
                    disabled={bulkProcessing || !bulkRejectNotes.trim()}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all active:scale-[0.96] disabled:opacity-50"
                    style={{ background: "#f87171" }}>
                    Tolak Semua ({pendingCount})
                  </button>
                </div>
              </>
            )}
          </div>
          <button type="button" onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-medium transition-all duration-150 active:scale-[0.96]"
            style={{ border: "1px solid #c9a22733", color: "#E8E2D4", background: "#2A2522" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#a78bfa"; el.style.color = "#a78bfa"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#c9a22733"; el.style.color = "#E8E2D4"; }}>
            Tutup
          </button>
        </div>
        </div>
      {confirmAction && (
        <ConfirmDialog
          isOpen
          variant={confirmAction.action === "approve" ? "info" : "warning"}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.action === "approve" ? "Ya, Setujui" : "Ya, Tolak"}
          isLoading={bulkProcessing}
          onConfirm={executeConfirm}
          onCancel={() => { if (!bulkProcessing) setConfirmAction(null); }}
        />
      )}
    </div>
  );
}
