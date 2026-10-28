// lib/legacy/ingest.ts
//
// Shared ingestion for Yii2 order payloads (inbound webhook + pull sync).
// Implements integration-spec checklist item 1: full-field upsert for
// existing orders, idempotent — re-applying an identical payload never
// creates duplicate stage_history rows or moves the tracking pointer.

import { createAdminClient } from "@/lib/supabase/admin";
import { getStageIndex } from "@/lib/stages";
import {
  mapStatusToStage,
  YII2_STATUS_TO_STAGE,
  YII2_STATUS_PELUNASAN,
} from "@/lib/legacy/status";
import { notifySupervisors } from "@/lib/notifications";
import {
  buildLegacyOrderRow,
  buildLegacyOrderUpdate,
  type Yii2OrderPayload,
} from "@/lib/legacy/adapter";
import { getBrandCode } from "@/lib/legacy/brands";
import {
  requiresPreReceiptValidation,
  shouldQueueIntakeValidation,
  type BrandIntakePolicy,
  type IntakeState,
} from "@/lib/legacy/intake";

type Db = ReturnType<typeof createAdminClient>;

// Stages that should auto-advance to their approval gate on ingest (Yii2
// already handled intake — the order is ready for supervisor review).
const APPROVAL_GATE_MAP: Record<string, string> = {
  penerimaan_order: "approval_penerimaan_order",
  racik_bahan: "approval_racik_bahan",
  qc_1: "approval_qc_1",
  qc_2: "approval_qc_2",
  pembentukan_cincin: "approval_produksi", // this skips to the production approval
};

export function resolveIngestionStage(rawStage: string): {
  stage: string;
  status: string;
} {
  const gate = APPROVAL_GATE_MAP[rawStage];
  if (gate) {
    return { stage: gate, status: "waiting_approval" };
  }
  return {
    stage: rawStage,
    status: rawStage === "selesai" ? "completed" : "in_progress",
  };
}

// Unknown/missing statuses are also skipped for EXISTING orders, so the
// mapStatusToStage fallback (penerimaan_order) can never regress an order.
export function shouldAdvanceTracking(
  idStatus: number | null | undefined,
): boolean {
  if (idStatus == null) return false;
  return idStatus in YII2_STATUS_TO_STAGE;
}

export function shouldApplyIncomingStage(
  currentStage: string | null | undefined,
  targetStage: string,
  idStatus: number | null | undefined,
): boolean {
  if (idStatus !== YII2_STATUS_PELUNASAN) return true;
  return getStageIndex(currentStage ?? "") <= getStageIndex(targetStage);
}

// Only force "selesai" when Yii2 confirms the order is truly completed
// (id_status = 15). tgl_selesai is set as a deadline on EVERY order — if we
// always treat it as completion, any status change on an order with a deadline
// would regress the tracking pointer to "selesai", skipping all stages in
// between. The mapped status takes priority for all other id_status values.
export function resolveTargetStage(order: Yii2OrderPayload): string | null {
  if (order.tgl_selesai && order.id_status === 15) return "selesai";
  if (!shouldAdvanceTracking(order.id_status)) return null;
  return mapStatusToStage(order.id_status);
}

export interface IngestResult {
  action: "inserted" | "updated";
  stage: string | null;
  stageChanged: boolean;
  intakePending?: boolean;
}

async function orderRequiresIntakeValidation(
  db: Db,
  order: Yii2OrderPayload,
): Promise<boolean> {
  const { data, error } = await db
    .from("brand_intake_policies")
    .select("brand_code, requires_pre_receipt_validation, is_active")
    .eq("brand_code", getBrandCode(order.id_brand))
    .maybeSingle();

  if (error) {
    console.error("[legacy intake] policy lookup gagal:", error.message);
    return false;
  }

  return requiresPreReceiptValidation(
    data ? [data as BrandIntakePolicy] : [],
    getBrandCode(order.id_brand),
  );
}

async function queueIntakeValidation(db: Db, orderId: string): Promise<void> {
  const { data: existing, error } = await db
    .from("legacy_order_intakes")
    .select("state")
    .eq("legacy_order_id", orderId)
    .maybeSingle();
  if (error) throw new Error(`legacy_order_intakes query gagal: ${error.message}`);

  if (!shouldQueueIntakeValidation(existing?.state as IntakeState | undefined)) {
    return;
  }

  const { error: upsertError } = await db
    .from("legacy_order_intakes")
    .upsert(
      {
        legacy_order_id: orderId,
        state: "pending_spv_cs_validation",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "legacy_order_id" },
    );
  if (upsertError) throw new Error(`legacy_order_intakes upsert gagal: ${upsertError.message}`);
}

async function advanceTracking(
  db: Db,
  orderId: string,
  stage: string,
  stageStatus: string,
): Promise<boolean> {
  const { data: tracking } = await db
    .from("tracking_stages")
    .select("current_stage")
    .eq("order_id", orderId)
    .maybeSingle();

  if (tracking && tracking.current_stage === stage) return false;

  if (tracking) {
    await db
      .from("tracking_stages")
      .update({
        current_stage: stage,
        stage_status: stageStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);
  } else {
    await db.from("tracking_stages").insert({
      order_id: orderId,
      current_stage: stage,
      stage_status: stageStatus,
      updated_at: new Date().toISOString(),
    });
  }

  await db.from("stage_history").insert({
    order_id: orderId,
    stage,
    status: "completed",
    created_at: new Date().toISOString(),
  });

  return true;
}

export async function admitLegacyOrderToReceiptApproval(
  db: Db,
  orderId: string,
): Promise<boolean> {
  const { data: tracking, error } = await db
    .from("tracking_stages")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error(`tracking_stages query gagal: ${error.message}`);
  if (tracking) return false;

  const admitted = await advanceTracking(db, orderId, "approval_penerimaan_order", "waiting_approval");
  if (admitted) {
    const { data: order } = await db
      .from("legacy_orders")
      .select("kode_order, nama")
      .eq("id", orderId)
      .single();
    notifySupervisors(
      "operational_supervisor",
      "Order Baru â€” Menunggu Persetujuan",
      `Order ${order?.kode_order ?? "—"} (${order?.nama ?? "—"}) menunggu approval.`,
      "info",
      "/dashboard/supervisor/approval",
    );
  }
  return admitted;
}

export async function ingestLegacyOrder(
  db: Db,
  order: Yii2OrderPayload,
): Promise<IngestResult> {
  const { data: existing } = await db
    .from("legacy_orders")
    .select("id, id_status, deleted_at")
    .eq("kode_order", order.kode_order)
    .maybeSingle();

  if (existing) {
    // Full-field upsert on every payload (also clears deleted_at when a
    // previously reconciled-away order reappears in the feed).
    const { error: updateError } = await db
      .from("legacy_orders")
      .update(buildLegacyOrderUpdate(order))
      .eq("id", existing.id);
    if (updateError) {
      throw new Error(`legacy_orders update gagal: ${updateError.message}`);
    }

    const { data: tracking, error: trackingError } = await db
      .from("tracking_stages")
      .select("id, current_stage")
      .eq("order_id", existing.id)
      .maybeSingle();
    if (trackingError) throw new Error(`tracking_stages query gagal: ${trackingError.message}`);

    if (!tracking && await orderRequiresIntakeValidation(db, order)) {
      await queueIntakeValidation(db, existing.id);
      return { action: "updated", stage: null, stageChanged: false, intakePending: true };
    }

    // Move the tracking pointer only when Yii2's id_status actually changed.
    // Yii2 fires on EVERY save — a non-status edit carries the old id_status,
    // and the ERP pointer may already be further ahead (only some ERP stages
    // push back to Yii2). Acting on an unchanged status would regress it.
    const incomingStatus = order.id_status ?? null;
    const statusChanged = existing.id_status !== incomingStatus;
    let targetStage = statusChanged ? resolveTargetStage(order) : null;

    // Resurrected order without a tracking pointer (reconcile removed it):
    // rebuild the pointer even when the status alone would not advance.
    if (targetStage === null && existing.deleted_at) {
      targetStage = order.tgl_selesai
        ? "selesai"
        : mapStatusToStage(order.id_status);
    }

    if (targetStage === null) {
      return { action: "updated", stage: null, stageChanged: false };
    }

    if (!shouldApplyIncomingStage(tracking?.current_stage, targetStage, incomingStatus)) {
      return { action: "updated", stage: null, stageChanged: false };
    }

    const stageChanged = await advanceTracking(
      db,
      existing.id,
      targetStage,
      targetStage === "selesai" ? "completed" : "in_progress",
    );

    return { action: "updated", stage: targetStage, stageChanged };
  }

  const { data: inserted, error: insertError } = await db
    .from("legacy_orders")
    .insert(buildLegacyOrderRow(order))
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `legacy_orders insert gagal: ${insertError?.message ?? "unknown"}`,
    );
  }

  if (await orderRequiresIntakeValidation(db, order)) {
    await queueIntakeValidation(db, inserted.id);
    return { action: "inserted", stage: null, stageChanged: false, intakePending: true };
  }

  const rawStage = order.tgl_selesai && order.id_status === 15
    ? "selesai"
    : mapStatusToStage(order.id_status);

  const { stage, status: stageStatus } = resolveIngestionStage(rawStage);

  await db.from("tracking_stages").insert({
    order_id: inserted.id,
    current_stage: stage,
    stage_status: stageStatus,
    updated_at: new Date().toISOString(),
  });

  await db.from("stage_history").insert({
    order_id: inserted.id,
    stage,
    status: "completed",
    created_at: new Date().toISOString(),
  });

  if (stageStatus === "waiting_approval" && stage.startsWith("approval_")) {
    notifySupervisors(
      "operational_supervisor",
      "Order Baru — Menunggu Persetujuan",
      `Order ${order.kode_order} (${order.nama ?? "—"}) menunggu approval.`,
      "info",
      `/dashboard/supervisor/approval`,
    );
  }

  return { action: "inserted", stage, stageChanged: true };
}
