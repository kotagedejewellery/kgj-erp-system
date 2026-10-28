// app/dashboard/management/tasks/page.tsx

"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Alert from "@/components/ui/Alert";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { getClientUser, type ClientUser } from "@/lib/auth/session";
import {
  Plus, Trash2, CheckCircle2, ChevronDown, ChevronRight, Calendar, Copy,
  ClipboardList, AlertTriangle, CalendarClock, X, GripVertical, Square, CheckSquare, Paperclip,
} from "lucide-react";
import type { Task } from "@/app/dashboard/superadmin/management/_shared/types";
import { computeOverdueDays, getOverdueSeverity, getDeadlineUrgency } from "@/lib/overdue";
import { ProgressWidget } from "@/components/dashboard/superadmin/ProgressWidget";
import { ItemRow } from "@/components/dashboard/superadmin/ItemRow";
import { useAnimatedValue } from "@/app/dashboard/superadmin/management/_shared/utils";
import { DragDropContext, Droppable, Draggable, type DropResult, type DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";

type FilterTab = "all" | "pending" | "done";

function formatDate(deadline: string) {
  return new Date(deadline).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function groupTasksByStatus(tasks: Task[]) {
  const selesai = tasks.filter((t) => {
    const items = t.items ?? [];
    return items.length > 0 && items.every((i) => i.progress?.[0]?.status === "selesai");
  });
  const proses = tasks.filter((t) => {
    const items = t.items ?? [];
    if (items.length === 0) return false;
    const done = items.filter((i) => i.progress?.[0]?.status === "selesai").length;
    return done > 0 && done < items.length;
  });
  const belum = tasks.filter((t) => {
    const items = t.items ?? [];
    if (items.length === 0) return true;
    return !items.some((i) => i.progress?.[0]?.status === "selesai");
  });
  return { selesai, proses, belum };
}

export default function ManagementTasksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState("");
  const [newItemTitle, setNewItemTitle] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [itemKendala, setItemKendala] = useState<Record<string, string>>({});
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterTab>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "task" | "item"; id: string; title: string } | null>(null);
  const [showClearDone, setShowClearDone] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [panelTaskId, setPanelTaskId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [flashItemId, setFlashItemId] = useState<string | null>(null);
  const [cyclingItemId, setCyclingItemId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkSubmitReviewConfirm, setBulkSubmitReviewConfirm] = useState(false);

  const [attachments, setAttachments] = useState<Record<string, { id: string; file_name: string; public_url: string; mime_type: string }[]>>({});
  const [ , setAttachmentsLoading] = useState<Record<string, boolean>>({});

  const fetchAttachments = async (itemId: string) => {
    if (attachments[itemId]) return;
    setAttachmentsLoading((p) => ({ ...p, [itemId]: true }));
    try {
      const res = await fetch(`/api/management/tasks/items/${itemId}/attachments`);
      if (res.ok) { const data = await res.json(); setAttachments((p) => ({ ...p, [itemId]: data })); }
    } catch { /* silent */ }
    finally { setAttachmentsLoading((p) => ({ ...p, [itemId]: false })); }
  };

  useEffect(() => { const u = getClientUser(); if (!u) { router.push("/login"); return; } setClientUser(u); }, [router]);

  const { data, isLoading, isError, error: queryError, refetch } = useQuery<{ success: boolean; data: Task[] }>({
    queryKey: ["management-tasks"],
    queryFn: () => fetcher("/api/management/tasks"),
    refetchInterval: 30_000,
  });

  const tasks = useMemo(() => data?.data ?? [], [data]);

  const submittableCount = useMemo(() => {
    let count = 0;
    for (const taskId of selectedTaskIds) {
      const task = tasks.find((t) => t.id === taskId);
      for (const item of task?.items ?? []) {
        const st = item.progress?.[0]?.status;
        if (st !== "selesai" && st !== "approved" && st !== "waiting_review") count++;
      }
    }
    return count;
  }, [selectedTaskIds, tasks]);

  const filteredTasks = useMemo(() => {
    let result: Task[];
    if (filter === "all") result = tasks;
    else result = tasks.filter((task) => {
      const items = task.items ?? [];
      const allDone = items.length > 0 && items.every((i) => i.progress?.[0]?.status === "selesai");
      if (filter === "done") return allDone;
      return !allDone || items.length === 0;
    });
    // Sort overdue first by max overdue days
    return [...result].sort((a, b) => {
      const maxA = Math.max(0, ...(a.items ?? []).map(() => computeOverdueDays(a.deadline ?? null)));
      const maxB = Math.max(0, ...(b.items ?? []).map(() => computeOverdueDays(b.deadline ?? null)));
      return maxB - maxA;
    });
  }, [tasks, filter]);

  const taskStats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let overdue = 0, dueToday = 0;
    tasks.forEach((task) => {
      if (!task.deadline) return;
      const items = task.items ?? [];
      const allDone = items.length > 0 && items.every((i) => i.progress?.[0]?.status === "selesai");
      if (allDone) return;
      const d = new Date(task.deadline); d.setHours(0, 0, 0, 0);
      if (d.getTime() < today.getTime()) overdue++;
      else if (d.getTime() === today.getTime()) dueToday++;
    });
    return { overdue, dueToday, total: tasks.length };
  }, [tasks]);

  const doneCount = useMemo(() => {
    let count = 0;
    tasks.forEach((task) => { (task.items ?? []).forEach((item) => { if (item.progress?.[0]?.status === "selesai") count++; }); });
    return count;
  }, [tasks]);

  const statusGroups = useMemo(() => filter === "all" ? groupTasksByStatus(tasks) : null, [tasks, filter]);

  const animOverdue = useAnimatedValue(taskStats.overdue, 600);

  const P = { purple: "#7c3aed", purpleLight: "#7c3aed22", purpleMuted: "#a78bfa", green: "#34d399", greenLight: "#05966922", greenMuted: "#6ee7b7", gray: "#a8a29e", grayLight: "#1C1917", grayBorder: "#c9a22733", orange: "#f97316", orangeLight: "#f9731622", blue: "#60a5fa", blueLight: "#60a5fa22", red: "#f87171", redLight: "#f8717122", ink: "#F5EFE3", card: "#2A2522" };
  const bgStyle = { background: "#26211C url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='0.75' fill='rgba(201,162,39,0.06)'/%3E%3C/svg%3E\") repeat" };
  const animDueToday = useAnimatedValue(taskStats.dueToday, 600);
  const animTotal = useAnimatedValue(taskStats.total, 600);

  const showAlert = (type: "success" | "error", message: string) => { setAlert({ type, message }); setTimeout(() => setAlert(null), 3000); };

  const handleAttachmentUpload = async (itemId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/management/tasks/items/${itemId}/attachments`, { method: "POST", body: formData });
    if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Gagal upload"); }
    const data = await res.json();
    setAttachments((p) => ({ ...p, [itemId]: [...(p[itemId] ?? []), data] }));
  };

  const handleAttachmentDelete = async (itemId: string, attachId: string) => {
    const res = await fetch(`/api/management/tasks/items/${itemId}/attachments/${attachId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Gagal menghapus");
    setAttachments((p) => ({ ...p, [itemId]: (p[itemId] ?? []).filter((f) => f.id !== attachId) }));
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return; setIsSaving(true);
    try {
      const res = await fetch("/api/management/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTaskTitle, deadline: newTaskDeadline || undefined }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setNewTaskTitle(""); setNewTaskDeadline(""); refetch(); showAlert("success", "Task berhasil ditambahkan");
    } catch (e) { showAlert("error", e instanceof Error ? e.message : "Gagal"); } finally { setIsSaving(false); }
  };

  const handleDeleteTask = async () => { if (!deleteTarget || deleteTarget.type !== "task") return; try { await fetch(`/api/management/tasks/${deleteTarget.id}`, { method: "DELETE" }); setDeleteTarget(null); refetch(); showAlert("success", "Task berhasil dihapus"); } catch { showAlert("error", "Gagal menghapus task"); } };
  const handleDuplicateTask = async (taskId: string, taskTitle: string) => {
    try {
      const res = await fetch(`/api/management/tasks/${taskId}/duplicate`, { method: "POST" });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Gagal"); }
      refetch();
      showAlert("success", `"${taskTitle}" berhasil diduplikasi`);
    } catch (e) { showAlert("error", e instanceof Error ? e.message : "Gagal menduplikasi"); }
  };
  const handleAddItem = async (taskId: string) => {
    const title = newItemTitle[taskId]?.trim(); if (!title) return; setIsSaving(true);
    try { const res = await fetch(`/api/management/tasks/${taskId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }); if (!res.ok) throw new Error((await res.json()).error); setNewItemTitle((prev) => ({ ...prev, [taskId]: "" })); refetch(); showAlert("success", "Item berhasil ditambahkan"); } catch (e) { showAlert("error", e instanceof Error ? e.message : "Gagal"); } finally { setIsSaving(false); }
  };
  const handleSetStatus = async (itemId: string, newStatus: string) => {
    if (cyclingItemId) return;
    setCyclingItemId(itemId);
    try {
      await fetch(`/api/management/tasks/items/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
      queryClient.invalidateQueries({ queryKey: ["management-tasks"] });
      flashItem(itemId);
    } catch { showAlert("error", "Gagal memperbarui status"); }
    finally { setCyclingItemId(null); }
  };
  const handleSaveItemNote = async (itemId: string, field: "notes" | "kendala", value: string) => {
    try { await fetch(`/api/management/tasks/items/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value || null }) }); queryClient.invalidateQueries({ queryKey: ["management-tasks"] }); } catch { showAlert("error", "Gagal menyimpan catatan"); }
  };
  const handleDeleteItem = async () => { if (!deleteTarget || deleteTarget.type !== "item") return; try { await fetch(`/api/management/tasks/items/${deleteTarget.id}`, { method: "DELETE" }); setDeleteTarget(null); refetch(); showAlert("success", "Item berhasil dihapus"); } catch { showAlert("error", "Gagal menghapus item"); } };
  const handleClearDone = async () => {
    setIsClearing(true);
    try { const res = await fetch("/api/management/tasks", { method: "DELETE" }); const json = await res.json(); if (!res.ok) throw new Error(json.error); showAlert("success", `${json.deleted} item selesai dihapus`); setShowClearDone(false); refetch(); } catch (e) { showAlert("error", e instanceof Error ? e.message : "Gagal"); } finally { setIsClearing(false); }
  };
  const toggleExpand = (taskId: string) => setExpandedTasks((prev) => { const n = new Set(prev); if (n.has(taskId)) n.delete(taskId); else n.add(taskId); return n; });
  const toggleNotes = (itemId: string) => setExpandedNotes((prev) => { const n = new Set(prev); if (n.has(itemId)) n.delete(itemId); else n.add(itemId); return n; });
  const openPanel = useCallback((taskId: string) => setPanelTaskId(taskId), []);
  const closePanel = useCallback(() => setPanelTaskId(null), []);
  const panelTask = useMemo(() => panelTaskId ? tasks.find((t) => t.id === panelTaskId) ?? null : null, [tasks, panelTaskId]);
  const toggleGroup = (key: string) => setCollapsedGroups((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const flashItem = (id: string) => { setFlashItemId(id); setTimeout(() => setFlashItemId(null), 600); };

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) => { const n = new Set(prev); if (n.has(taskId)) n.delete(taskId); else n.add(taskId); return n; });
  };

  const clearSelection = () => setSelectedTaskIds(new Set());

  const handleBulkMarkDone = async () => {
    setBulkSubmitReviewConfirm(false);
    setBulkActionLoading(true);
    try {
      const targets = Array.from(selectedTaskIds);
      let itemCount = 0;
      for (const taskId of targets) {
        const task = tasks.find((t) => t.id === taskId);
        if (!task?.items) continue;
        for (const item of task.items) {
          const st = item.progress?.[0]?.status;
          if (st !== "selesai" && st !== "approved" && st !== "waiting_review") {
            await fetch(`/api/management/tasks/items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "waiting_review" }) });
            itemCount++;
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ["management-tasks"] });
      clearSelection();
      showAlert("success", `${itemCount} item dikirim untuk review`);
    } catch { showAlert("error", "Gagal mengirim untuk review"); } finally { setBulkActionLoading(false); }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteConfirm(false);
    setBulkActionLoading(true);
    try {
      const targets = Array.from(selectedTaskIds);
      for (const taskId of targets) {
        await fetch(`/api/management/tasks/${taskId}`, { method: "DELETE" });
      }
      clearSelection();
      refetch();
      showAlert("success", `${targets.length} task dihapus`);
    } catch { showAlert("error", "Gagal menghapus task"); } finally { setBulkActionLoading(false); }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const targetGroup = destination.droppableId;
    if (targetGroup === "proses") return;
    const task = tasks.find((t) => t.id === draggableId);
    if (!task?.items?.length) return;
    const newStatus = targetGroup === "selesai" ? "selesai" : "belum";
    setBulkActionLoading(true);
    try {
      for (const item of task.items) {
        if (item.progress?.[0]?.status !== newStatus) {
          await fetch(`/api/management/tasks/items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["management-tasks"] });
      showAlert("success", `Task dipindahkan ke ${targetGroup === "selesai" ? "Selesai" : "Belum"}`);
    } catch { showAlert("error", "Gagal memindahkan task"); } finally { setBulkActionLoading(false); }
  };

  useEffect(() => {
    if (!panelTask) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closePanel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [panelTask, closePanel]);

  function renderTaskCard(task: Task, index?: number, extra?: { dragHandleProps?: DraggableProvidedDragHandleProps | null; isDragging?: boolean; isSelected?: boolean; onSelect?: (taskId: string) => void }) {
    const items = task.items ?? [];
    const done = items.filter((i) => i.progress?.[0]?.status === "selesai").length;
    const allDone = items.length > 0 && done === items.length;
    const someProgress = items.length > 0 && done > 0 && !allDone;
    const untouched = items.length === 0;
    const isSelected = extra?.isSelected ?? false;
    const isDragging = extra?.isDragging ?? false;
    const deadlineUrgency = getDeadlineUrgency(task.deadline ?? null); const isExpanded = expandedTasks.has(task.id);
    const overdueDays = computeOverdueDays(task.deadline ?? null);
    const overdueSev = getOverdueSeverity(overdueDays);
    const leftBorder = allDone ? `2px solid ${P.green}` : overdueSev ? `2px solid ${overdueSev.color}` : deadlineUrgency === "today" ? `2px solid ${P.orange}` : `1px solid ${P.grayBorder}`;
    const progressBg = allDone ? P.green : someProgress ? P.purple : P.grayBorder;
    const staggerDelay = index !== undefined ? `${index * 50}ms` : "0ms";
    return (
      <div key={task.id} className={`group rounded-xl overflow-hidden cursor-pointer transition-shadow animate-card-enter ${isDragging ? "shadow-lg scale-[1.02]" : "hover:shadow-sm"} ${isSelected ? "ring-2" : ""}`} style={{ background: P.card, borderTop: `1px solid ${P.grayBorder}`, borderRight: `1px solid ${P.grayBorder}`, borderBottom: `1px solid ${P.grayBorder}`, borderLeft: leftBorder, opacity: untouched ? 0.75 : 1, animationDelay: staggerDelay, boxShadow: isDragging ? "0 8px 24px rgba(124,58,237,0.1)" : isSelected ? "0 0 0 2px rgba(124,58,237,0.2)" : undefined }}
        tabIndex={0} role="button" onClick={() => openPanel(task.id)} title="Open details — edit status, notes, kendala"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); openPanel(task.id); } }}>
        <div className="flex items-center gap-3 px-5 py-4">
          {extra?.dragHandleProps && (
            <div {...extra.dragHandleProps} className="shrink-0 cursor-grab active:cursor-grabbing touch-none" style={{ color: P.gray }} tabIndex={-1} title="Drag to move"><GripVertical className="w-4 h-4" /></div>
          )}
          <button onClick={(e) => { e.stopPropagation(); extra?.onSelect?.(task.id); }} className="shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" style={{ color: isSelected ? P.purple : P.gray }} tabIndex={-1} title="Select task">
            {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }} style={{ color: P.gray }} className="shrink-0" tabIndex={-1} title="Quick preview — view items only">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
          <div className="flex-1 min-w-0"><p className="font-semibold" style={{ color: P.ink }}>{task.title}</p>
            <div className="flex items-center gap-3 mt-1">
              {items.length > 0 && !untouched && <ProgressWidget done={done} total={items.length} color={progressBg} />}
              {task.deadline && (
                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: overdueSev ? overdueSev.color : deadlineUrgency === "today" ? P.orange : P.gray }}>
                  {overdueSev ? <AlertTriangle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                  {overdueSev ? overdueSev.label : deadlineUrgency === "today" ? "Hari ini" : formatDate(task.deadline)}
                </span>
              )}
              {(() => {
                const attachCount = items.reduce((sum, item) => sum + (attachments[item.id]?.length ?? 0), 0);
                return attachCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-1.5 py-0.5" style={{ background: P.purpleLight, color: P.purple }}>
                    <Paperclip className="w-3 h-3" />{attachCount}
                  </span>
                ) : null;
              })()}
              {allDone && items.length > 0 && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: P.green }} />}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleDuplicateTask(task.id, task.title); }} className="p-1.5 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0" style={{ color: P.gray }} tabIndex={-1} title="Duplikat task"><Copy className="w-4 h-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: "task", id: task.id, title: task.title }); }} className="p-1.5 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0" style={{ color: P.gray }} tabIndex={-1} title="Delete task"><Trash2 className="w-4 h-4" /></button>
        </div>
        {isExpanded && items.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${P.grayBorder}` }}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium" style={{ color: P.gray }}>{done}/{items.length} selesai</span>
              <div className="flex gap-0.5">
                {items.map((item) => {
                  const st = item.progress?.[0]?.status ?? "belum";
                  const fill = st === "selesai" || st === "approved" ? P.green : st === "proses" || st === "waiting_review" ? P.purple : P.grayBorder;
                  return <div key={item.id} className="w-3 h-3 rounded-sm" style={{ background: fill }} />;
                })}
              </div>
              {allDone && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: P.green }} />}
            </div>
            <button onClick={(e) => { e.stopPropagation(); openPanel(task.id); }} className="text-[10px] font-semibold rounded-lg px-3 py-1.5 transition-colors" style={{ color: P.purple, background: P.purpleLight }}>
              Buka detail →
            </button>
          </div>
        )}
      </div>
    );
  }


  return (
    <div className="flex h-screen" style={bgStyle}>
      <Sidebar role="management" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="management" />
        <div className="flex items-center gap-4 px-6 py-2" style={{ background: P.card, borderBottom: `1px solid ${P.grayBorder}` }}>
          {[{ icon: <AlertTriangle className="h-3.5 w-3.5" style={{ color: P.red }} />, label: "Overdue", value: animOverdue, color: P.red },
            { icon: <CalendarClock className="h-3.5 w-3.5" style={{ color: P.orange }} />, label: "Hari Ini", value: animDueToday, color: P.orange },
            { icon: <ClipboardList className="h-3.5 w-3.5" style={{ color: P.gray }} />, label: "Total", value: animTotal, color: P.ink }]
            .map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs"><span style={{ color: P.gray }}>{label}</span><span className="font-semibold tabular-nums" style={{ color }}>{value}</span></div>
            ))}
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <style>{`
            @keyframes cardEnter {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .animate-card-enter {
              animation: cardEnter 0.4s ease-out both;
            }
            @keyframes checkboxPop {
              0% { transform: scale(1); }
              50% { transform: scale(1.2); }
              100% { transform: scale(1); }
            }
            .animate-checkbox-pop {
              animation: checkboxPop 0.3s ease-out;
            }
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            .skeleton-shimmer {
              background: linear-gradient(90deg, var(--color-parch-border) 25%, var(--color-parch-card) 50%, var(--color-parch-border) 75%);
              background-size: 200% 100%;
              animation: shimmer 1.5s infinite;
            }
          `}</style>
          {isLoading ? (
            <>
              <div className="mb-6">
                <div className="h-8 w-32 rounded mb-2 skeleton-shimmer" />
                <div className="h-4 w-48 rounded skeleton-shimmer" />
              </div>
              <div className="mb-6 flex gap-2 items-end">
                <div className="flex-1 h-10 rounded skeleton-shimmer" />
                <div className="w-32 h-10 rounded skeleton-shimmer" />
                <div className="w-24 h-10 rounded skeleton-shimmer" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl p-5 overflow-hidden" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}>
                    <div className="h-5 w-48 rounded mb-3 skeleton-shimmer" />
                    <div className="h-3 w-32 rounded skeleton-shimmer" />
                  </div>
                ))}
              </div>
            </>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-lg" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}>
              <AlertTriangle className="w-12 h-12 mb-3" style={{ color: P.red }} />
              <p className="text-sm font-medium mb-1" style={{ color: P.red }}>Gagal memuat data</p>
              <p className="text-xs mb-4" style={{ color: P.gray }}>{queryError instanceof Error ? queryError.message : "Koneksi gagal. Periksa jaringan Anda."}</p>
              <button onClick={() => refetch()} className="rounded-lg border px-4 py-2 text-sm font-medium transition" style={{ background: P.card, borderColor: P.purple, color: P.purple }}>Coba Lagi</button>
            </div>
          ) : (<>
          {alert && <div className="mb-4"><Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /></div>}

          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div><h1 className="text-2xl leading-tight font-semibold" style={{ color: P.ink }}>Tugas</h1><p className="text-sm" style={{ color: P.gray }}>Kelola checklist tugas harian Anda</p></div>
            {doneCount > 0 && <button onClick={() => setShowClearDone(true)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition" style={{ background: P.card, borderColor: P.grayBorder, color: P.gray }}><Trash2 className="h-3.5 w-3.5" />Hapus {doneCount} Selesai</button>}
          </div>

          <div className="mb-6 flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]"><Input label="Task" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Judul task baru..." disabled={isSaving} className="focus:ring-[#7c3aed]" style={{ borderColor: P.grayBorder }} /></div>
            <Input label="Deadline (Opsional)" type="date" fullWidth={false} value={newTaskDeadline} onChange={(e) => setNewTaskDeadline(e.target.value)} disabled={isSaving} className="focus:ring-[#7c3aed]" style={{ borderColor: P.grayBorder }} />
            <button type="button" onClick={handleAddTask} disabled={isSaving || !newTaskTitle.trim()} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition ml-auto sm:ml-0" style={{ background: P.purple, color: "#fff" }}><Plus className="w-4 h-4" />Tambah</button>
          </div>

          {tasks.length > 0 && (
            <div className="flex gap-1 mb-4">
              {(["all", "pending", "done"] as const).map((key) => (
                <button key={key} onClick={() => setFilter(key)} className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all" style={{ background: filter === key ? P.purple : "transparent", color: filter === key ? "#fff" : P.gray, border: filter === key ? "1px solid transparent" : `1px solid ${P.grayBorder}`, boxShadow: filter === key ? "0 0 10px rgba(124,58,237,0.35)" : "none" }}>
                  {key === "all" ? "Semua" : key === "pending" ? "Belum" : "Selesai"}
                </button>
              ))}
            </div>
          )}

          {selectedTaskIds.size > 0 && (
            <div className="mb-4 flex items-center gap-3 p-3 rounded-xl flex-wrap" style={{ background: P.card, border: `1px solid ${P.purple}`, boxShadow: "0 2px 8px rgba(124,58,237,0.15)" }}>
              <span className="text-sm font-medium" style={{ color: P.ink }}>{selectedTaskIds.size} dipilih</span>
              <div className="flex-1" />
              <button onClick={() => setBulkSubmitReviewConfirm(true)} disabled={bulkActionLoading || submittableCount === 0} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50" style={{ background: P.purple, color: "#fff" }}><CheckCircle2 className="w-3.5 h-3.5" />Submit Review{submittableCount > 0 ? ` (${submittableCount})` : ""}</button>
              <button onClick={() => setBulkDeleteConfirm(true)} disabled={bulkActionLoading} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50" style={{ borderColor: P.red, color: P.red }}><Trash2 className="w-3.5 h-3.5" />Hapus</button>
              <button onClick={clearSelection} disabled={bulkActionLoading} className="text-xs" style={{ color: P.gray }}>Batal</button>
            </div>
          )}

          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-lg" style={{ background: P.card, border: `1px solid ${P.grayBorder}` }}><ClipboardList className="w-12 h-12 mb-3" style={{ color: P.gray }} /><p className="text-sm font-medium" style={{ color: P.gray }}>{tasks.length === 0 ? "Belum ada task" : filter === "done" ? "Belum ada task selesai" : "Semua task selesai"}</p></div>
          ) : statusGroups ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="space-y-3">
                {[{ key: "belum", label: "Belum", tasks: statusGroups.belum, icon: <ClipboardList className="h-3.5 w-3.5" style={{ color: P.red }} /> },
                  { key: "proses", label: "Proses", tasks: statusGroups.proses, icon: <ClipboardList className="h-3.5 w-3.5" style={{ color: P.orange }} /> },
                  { key: "selesai", label: "Selesai", tasks: statusGroups.selesai, icon: <ClipboardList className="h-3.5 w-3.5" style={{ color: P.green }} /> }]
                  .filter((g) => g.tasks.length > 0)
                  .map(({ key, label, tasks: groupTasks, icon }, idx) => {
                    const isCollapsed = collapsedGroups.has(key);
                    const isDropDisabled = key === "proses";
                    return (
                      <div key={key} className={idx > 0 ? "mt-6" : ""}>
                        <button onClick={() => toggleGroup(key)} className="flex items-center gap-2 mb-2 pl-1 cursor-pointer group/gh text-white/50">
                          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {icon}
                          <span className="text-[9px] uppercase tracking-[0.22em]">{label}</span>
                          <span className="text-[10px] text-white/40">{groupTasks.length}</span>
                        </button>
                        {!isCollapsed && (
                          <Droppable droppableId={key} isDropDisabled={isDropDisabled}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`space-y-3 rounded-lg transition-colors duration-200 ${snapshot.isDraggingOver && !isDropDisabled ? "ring-2 ring-offset-2 ring-[#7c3aed]" : ""}`}
                                style={{
                                  background: snapshot.isDraggingOver && !isDropDisabled ? "#7c3aed0D" : "transparent",
                                  border: snapshot.isDraggingOver && !isDropDisabled ? "2px dashed #7c3aed44" : "2px dashed transparent",
                                  borderRadius: "12px",
                                  minHeight: groupTasks.length === 0 ? "60px" : undefined,
                                }}
                              >
                                {groupTasks.map((task, gi) => (
                                  <Draggable key={task.id} draggableId={task.id} index={gi}>
                                    {(dragProvided, dragSnapshot) => (
                                      <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                                        {renderTaskCard(task, gi, {
                                          dragHandleProps: dragProvided.dragHandleProps ?? undefined,
                                          isDragging: dragSnapshot.isDragging,
                                          isSelected: selectedTaskIds.has(task.id),
                                          onSelect: toggleSelectTask,
                                        })}
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </div>
                    );
                  })}
              </div>
            </DragDropContext>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task, i) => renderTaskCard(task, i, { isSelected: selectedTaskIds.has(task.id), onSelect: toggleSelectTask }))}
            </div>
          )}
          </>
          )}
        </main>
      </div>

      {/* Linear-style side panel */}
      {panelTask && (
        <>
          <div className="fixed inset-0 z-40 backdrop-blur-sm" style={{ background: "rgba(44,24,16,0.3)" }} onClick={closePanel} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full md:w-[420px] flex flex-col shadow-2xl animate-slide-in" style={{ background: P.card, borderLeft: `1px solid ${P.grayBorder}` }}>
            <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } } .animate-slide-in { animation: slideIn 200ms ease-out; }`}</style>
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ background: P.purpleLight, borderBottom: `0.5px solid ${P.grayBorder}`, borderTop: `2px solid ${P.purple}` }}>
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.22em]" style={{ color: P.purple }}>Task Detail</p>
                <p className="text-base font-semibold truncate" style={{ color: P.ink }}>{panelTask.title}</p>
                {panelTask.deadline && (
                  <p className="text-[11px]" style={{ color: P.gray }}>Deadline: {formatDate(panelTask.deadline)}</p>
                )}
              </div>
              <button onClick={closePanel} className="rounded p-2 transition-colors shrink-0" style={{ color: P.gray }} aria-label="Close panel"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {((panelTask.items ?? []).length > 0 ? (
                panelTask.items!.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <ItemRow
                      item={item}
                      notesOpen={expandedNotes.has(item.id)}
                      isCycling={cyclingItemId === item.id}
                      isSaving={isSaving}
                      isFlashing={flashItemId === item.id}
                      notesValue={itemNotes[item.id] !== undefined ? itemNotes[item.id] : (item.progress?.[0]?.notes ?? "")}
                      kendalaValue={itemKendala[item.id] !== undefined ? itemKendala[item.id] : (item.progress?.[0]?.kendala ?? "")}
                      onSetStatus={handleSetStatus}
                      onToggleNotes={toggleNotes}
                      onNotesChange={(id, value) => setItemNotes((p) => ({ ...p, [id]: value }))}
                      onKendalaChange={(id, value) => setItemKendala((p) => ({ ...p, [id]: value }))}
                      onSaveNote={handleSaveItemNote}
                      onDelete={(id, title) => setDeleteTarget({ type: "item", id, title })}
                      attachments={attachments[item.id] ?? []}
                      attachmentOnUpload={handleAttachmentUpload}
                      attachmentOnDelete={handleAttachmentDelete}
                      attachmentShowAlert={showAlert}
                      attachmentFetch={fetchAttachments}
                    />
                  </div>
                ))
              ) : (
                  <p className="text-center py-8" style={{ color: P.gray }}>Belum ada item.</p>
              ))}
            </div>
            <div className="px-5 py-3 shrink-0 flex gap-2" style={{ borderTop: `0.5px solid ${P.grayBorder}` }}>
              <Input value={newItemTitle[panelTask.id] || ""} onChange={(e) => setNewItemTitle((p) => ({ ...p, [panelTask.id]: e.target.value }))} placeholder="Tambah item baru..." disabled={isSaving} className="focus:ring-[#7c3aed]" style={{ borderColor: P.grayBorder }} />
              <Button variant="outline" size="sm" onClick={() => handleAddItem(panelTask.id)} disabled={isSaving || !newItemTitle[panelTask.id]?.trim()} leftIcon={<Plus className="w-3 h-3" />}>Tambah</Button>
            </div>
          </div>
        </>
      )}
      <ConfirmDialog isOpen={!!deleteTarget} variant="danger" title={deleteTarget?.type === "task" ? "Hapus Task" : "Hapus Item"} message={deleteTarget ? `Yakin ingin menghapus "${deleteTarget.title}"?` : ""} confirmText="Hapus" cancelText="Batal" onConfirm={deleteTarget?.type === "task" ? handleDeleteTask : handleDeleteItem} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog isOpen={showClearDone} variant="danger" title="Hapus Semua Item Selesai?" message={`${doneCount} item selesai akan dihapus permanen.`} confirmText="Hapus Semua" cancelText="Batal" isLoading={isClearing} onConfirm={handleClearDone} onCancel={() => setShowClearDone(false)} />
      <ConfirmDialog isOpen={bulkDeleteConfirm} variant="danger" title="Hapus Task Terpilih?" message={`${selectedTaskIds.size} task akan dihapus permanen beserta semua item di dalamnya.`} confirmText="Hapus" cancelText="Batal" isLoading={bulkActionLoading} onConfirm={handleBulkDelete} onCancel={() => setBulkDeleteConfirm(false)} />
      <ConfirmDialog isOpen={bulkSubmitReviewConfirm && submittableCount > 0} variant="warning" title="Submit untuk Review?" message={`${submittableCount} item akan dikirim ke superadmin untuk review. Anda tidak bisa mengubahnya setelah disubmit.`} confirmText="Ya, Submit Review" cancelText="Batal" isLoading={bulkActionLoading} onConfirm={handleBulkMarkDone} onCancel={() => setBulkSubmitReviewConfirm(false)} />
    </div>
  );
}
