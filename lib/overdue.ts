// lib/overdue.ts — overdue computation + severity helpers

/**
 * Compute days overdue from a deadline.
 * Returns 0 if deadline is today or in the future.
 */
export function computeOverdueDays(deadline: string | null): number {
  if (!deadline) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  return Math.max(0, days);
}

export interface OverdueSeverity {
  level: "today" | "overdue-mild" | "overdue-severe" | "overdue-critical";
  label: string;
  bg: string;
  color: string;
  sort: number; // lower = higher priority
}

export function getOverdueSeverity(daysOverdue: number): OverdueSeverity | null {
  if (daysOverdue <= 0) return null;
  if (daysOverdue === 1) return { level: "today", label: "Hari ini", bg: "#f9731622", color: "#f97316", sort: 1 };
  if (daysOverdue <= 3) return { level: "overdue-mild", label: `${daysOverdue} hari terlambat`, bg: "#f8717122", color: "#f87171", sort: 0 };
  if (daysOverdue <= 7) return { level: "overdue-severe", label: `${daysOverdue} hari terlambat`, bg: "#f8717122", color: "#ef4444", sort: -1 };
  return { level: "overdue-critical", label: `${daysOverdue} hari terlambat`, bg: "#7f1d1d", color: "#fca5a5", sort: -2 };
}

export function getReviewWaitingDays(completedAt: string | null): number {
  if (!completedAt) return 0;
  const now = new Date();
  const d = new Date(completedAt);
  const diff = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

export function getDeadlineUrgency(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() < now.getTime()) return "overdue" as const;
  if (d.getTime() === now.getTime()) return "today" as const;
  return "future" as const;
}
