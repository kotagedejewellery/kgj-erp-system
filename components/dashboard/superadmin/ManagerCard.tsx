"use client";

import { Clock, AlertCircle, Check } from "lucide-react";
import { computeOverdueDays, getOverdueSeverity, getReviewWaitingDays } from "@/lib/overdue";
import { formatRelativeDeadline } from "@/lib/format";
import { isOverdue } from "@/app/dashboard/superadmin/management/_shared/utils";
import { ROLE_DISPLAY } from "@/app/dashboard/superadmin/management/_shared/constants";

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

export interface Manager {
  id: string;
  full_name: string;
  username: string;
  role_name: string;
  tasks: Task[];
}

export function ManagerCard({
  manager,
  onViewAll,
  onEscalate,
}: {
  manager: Manager;
  onViewAll: (manager: Manager) => void;
  onEscalate: (manager: Manager) => void;
}) {
  const allItems = manager.tasks.flatMap((t) =>
    (t.items ?? []).map((item) => ({
      item,
      taskTitle: t.title,
      deadline: t.deadline,
    })),
  );

  const done = allItems.filter(
    (i) => i.item.progress?.[0]?.status === "selesai" || i.item.progress?.[0]?.status === "approved",
  ).length;
  const total = allItems.length || 1;

  const overdue = allItems.filter((i) =>
    isOverdue(i.deadline, i.item.progress?.[0]?.status ?? null),
  ).length;
  const atRisk = allItems.filter(
    (i) =>
      i.item.progress?.[0]?.status === "proses" &&
      !isOverdue(i.deadline, i.item.progress?.[0]?.status ?? null),
  ).length;

  const hasOverdue = overdue > 0;
  const hasEscalate = hasOverdue || atRisk > 0;

  const maxOverdueDays = Math.max(0, ...allItems.map((i) => computeOverdueDays(i.deadline ?? null)));
  const overdueSev = getOverdueSeverity(maxOverdueDays);

  const waitingReviewItems = allItems.filter((i) => i.item.progress?.[0]?.status === "waiting_review");
  const reviewDays = waitingReviewItems.length > 0
    ? Math.max(...waitingReviewItems.map((i) => getReviewWaitingDays(i.item.progress?.[0]?.completed_at ?? null)))
    : 0;

  const statusCounts = {
    selesai: allItems.filter((i) => i.item.progress?.[0]?.status === "selesai" || i.item.progress?.[0]?.status === "approved").length,
    proses: allItems.filter((i) => i.item.progress?.[0]?.status === "proses" || i.item.progress?.[0]?.status === "waiting_review").length,
    belum: allItems.filter(
      (i) =>
        !i.item.progress?.[0]?.status ||
        i.item.progress?.[0]?.status === "belum",
    ).length,
    rejected: allItems.filter((i) => i.item.progress?.[0]?.status === "rejected").length,
  };

  const statusMeta: Record<string, { label: string; color: string; bg: string; border: string }> = {
    selesai: { label: "Selesai", color: "#34d399", bg: "#ecfdf5", border: "#a7f3d0" },
    proses:  { label: "Proses",  color: "#a78bfa", bg: "#a78bfa22", border: "#a78bfa" },
    belum:   { label: "Belum",   color: "#dc2626", bg: "#fef2f2", border: "#f87171" },
    rejected:{ label: "Ditolak", color: "#b91c1c", bg: "#fee2e2", border: "#f87171" },
  };
  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200"
      style={{
        background: "#2A2522",
        border: `1px solid ${overdueSev ? overdueSev.color : "#c9a22733"}`,
        boxShadow: "none",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "0 8px 24px rgba(124,58,237,0.08)";
        el.style.borderColor = overdueSev ? overdueSev.color : "#a78bfa";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "none";
        el.style.borderColor = hasOverdue ? "#f87171" : "#c9a22733";
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 pb-4" style={{ borderBottom: `1px solid #c9a22733` }}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-semibold text-sm text-white" style={{ background: "#a78bfa" }}>
          {manager.full_name
            ?.split(" ")
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase() ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold leading-tight" style={{ color: "#F5EFE3" }}>{manager.full_name}</p>
          <p className="text-[11px]" style={{ color: "#6b7280" }}>{ROLE_DISPLAY[manager.role_name] ?? manager.role_name}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold leading-none" style={{ color: "#F5EFE3" }}>{done}/{total}</p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: "#a78bfa" }}>Progress</p>
        </div>
      </div>

      {/* Progress indicator — segmented bar */}
      <div className="flex gap-1 mb-4">
        {[...Array(total)].map((_, i) => {
          const item = allItems[i];
          const status = item?.item.progress?.[0]?.status ?? "belum";
          const fill =
            status === "selesai" ? "#34d399" : status === "proses" ? "#a78bfa" : "#c9a22733";
          return (
            <div key={i} className="flex-1 h-1 rounded-full transition-colors duration-500" style={{ background: fill }} />
          );
        })}
      </div>

      {/* Status Pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        {Object.entries(statusCounts).map(([status, count]) => {
          const meta = statusMeta[status] ?? statusMeta.belum;
          if (!count) return null;
          return (
            <span key={status} className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-lg"
              style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
              {count} {meta.label}
            </span>
          );
        })}
        {overdueSev && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-lg"
            style={{ background: overdueSev.bg, color: overdueSev.color, border: `1px solid ${overdueSev.color}33` }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: overdueSev.color }} />
            {overdueSev.label}
          </span>
        )}
        {reviewDays > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-lg"
            style={{ background: "#a78bfa22", color: "#a78bfa", border: "1px solid #a78bfa" }}>
            <Clock className="w-3 h-3" />
            Menunggu review {reviewDays} hari
          </span>
        )}
        {overdue === 0 && atRisk === 0 && done > 0 && !waitingReviewItems.length && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-lg"
            style={{ background: "#ecfdf5", color: "#34d399", border: "1px solid #a7f3d0" }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#34d399" }} />
            On Track
          </span>
        )}
      </div>

      {/* Task Preview */}
      {manager.tasks.length > 0 && (
        <>
          <p className="text-[9px] font-semibold uppercase tracking-[0.15em] mb-2" style={{ color: "#a78bfa" }}>Tasks</p>
          {manager.tasks.slice(0, 2).map((task) => {
            const items = task.items ?? [];
            const done = items.filter((i) => i.progress?.[0]?.status === "selesai").length;
            const allDone = items.length > 0 && done === items.length;
            const nearestDeadline = task.deadline ? formatRelativeDeadline(task.deadline, null) : null;
            const hasOverdue = task.deadline && isOverdue(task.deadline, null);
            return (
              <div key={task.id} className="flex items-center gap-2.5 py-2" style={{ borderBottom: `1px solid #c9a22733` }}>
                <span className="shrink-0">
                  {allDone ? <Check className="h-3.5 w-3.5" style={{ color: "#34d399" }} /> : hasOverdue ? <AlertCircle className="h-3.5 w-3.5" style={{ color: "#dc2626" }} /> : <Clock className="h-3.5 w-3.5" style={{ color: "#ea580c" }} />}
                </span>
                <div className="flex-1 min-w-0"><p className="text-sm truncate" style={{ color: "#E8E2D4" }}>{task.title}</p></div>
                <span className="text-[11px] font-medium shrink-0" style={{ color: "#6b7280" }}>{done}/{items.length}</span>
                {nearestDeadline && <span className="text-[11px] shrink-0" style={{ color: nearestDeadline.isUrgent ? "#dc2626" : "#9ca3af" }}>{nearestDeadline.label}</span>}
              </div>
            );
          })}
        </>
      )}

      {manager.tasks.length > 2 && (
        <p className="text-[11px] mt-2" style={{ color: "#9ca3af" }}>+ {manager.tasks.length - 2} task lainnya</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `1px solid #c9a22733` }}>
        <button type="button" onClick={() => onViewAll(manager)}
          className="flex-1 rounded-xl px-4 py-2 text-xs font-medium transition-colors"
          style={{ border: "1px solid #c9a22733", color: "#E8E2D4", background: "transparent" }}
          onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#a78bfa"; el.style.color = "#a78bfa"; }}
          onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#c9a22733"; el.style.color = "#E8E2D4"; }}>
          Lihat detail
        </button>
        {hasEscalate && (
          <button type="button" onClick={() => onEscalate(manager)}
            className="flex-1 rounded-xl px-4 py-2 text-xs font-medium text-white transition-colors"
            style={{ background: "#a78bfa" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#6d28d9"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#a78bfa"; }}>
            Eskalasi
          </button>
        )}
      </div>
    </div>
  );
}
