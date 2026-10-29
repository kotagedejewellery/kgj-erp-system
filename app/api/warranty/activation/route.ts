import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import {
  hasWarrantyPermission,
  WARRANTY_ACTIVATION_ACTIVATE_PERMISSION,
  WARRANTY_ACTIVATION_VALIDATE_PERMISSION,
} from "@/lib/warranty/permissions";
import { sendYiiWarrantyCommand } from "@/lib/warranty/yii-command";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Action = "validate" | "activate";

const actionConfig: Record<Action, { permission: string; path: string }> = {
  validate: {
    permission: WARRANTY_ACTIVATION_VALIDATE_PERMISSION,
    path: "/api/warranty/v1/commands/candidates/validate-unit",
  },
  activate: {
    permission: WARRANTY_ACTIVATION_ACTIVATE_PERMISSION,
    path: "/api/warranty/v1/commands/candidates/activate",
  },
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: { user }, error: userError } = await session.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const orderId = text(body?.order_id);
    const unitId = text(body?.unit_id);
    const action = body?.action as Action;
    if (!orderId || !unitId || !(action in actionConfig)) {
      return NextResponse.json({ error: "Aksi aktivasi tidak valid" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, full_name, email, status, role:roles!users_role_id_fkey(name, permissions)")
      .eq("id", user.id)
      .is("deleted_at", null)
      .single();
    if (profileError || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (profile.status !== "active") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const role = getRoleProps(profile);
    const permission = actionConfig[action].permission;
    if (role.name !== "superadmin" && !hasWarrantyPermission(role.permissions, permission)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [unitResult, outboxResult, existingResult] = await Promise.all([
      admin
        .from("warranty_preparation_units")
        .select("id, candidate_sequence, unit_code, starting_weight_gram, plan_version_reference")
        .eq("id", unitId)
        .eq("order_id", orderId)
        .maybeSingle(),
      admin
        .from("warranty_activation_outbox")
        .select("event_id, status")
        .eq("order_id", orderId)
        .maybeSingle(),
      admin
        .from("warranty_candidate_commands")
        .select("id, request_id, payload, status, response")
        .eq("unit_id", unitId)
        .eq("command", action)
        .maybeSingle(),
    ]);
    if (unitResult.error || outboxResult.error || existingResult.error) {
      throw unitResult.error ?? outboxResult.error ?? existingResult.error;
    }
    if (!unitResult.data) return NextResponse.json({ error: "Unit garansi tidak ditemukan" }, { status: 404 });
    if (outboxResult.data?.status !== "delivered") {
      return NextResponse.json({ error: "Candidate belum diterima Warranty Core" }, { status: 409 });
    }

    const unit = unitResult.data;
    const candidateReference = `WAC-${outboxResult.data.event_id}-${unit.candidate_sequence}`;
    if (action === "activate") {
      const { data: validation } = await admin
        .from("warranty_candidate_commands")
        .select("status")
        .eq("unit_id", unitId)
        .eq("command", "validate")
        .maybeSingle();
      if (validation?.status !== "completed") {
        return NextResponse.json({ error: "Validasi unit harus selesai sebelum aktivasi" }, { status: 409 });
      }
    }

    let existingCommand = existingResult.data;
    if (existingCommand?.status === "completed") {
      return NextResponse.json({ success: true, data: existingCommand.response });
    }

    const freshPayload: Record<string, unknown> = {
      schema_version: 1,
      request_id: randomUUID(),
      expected_version: null,
      actor: {
        id: user.id,
        display_name: profile.full_name || profile.email || user.email || user.id,
        permissions: [permission],
      },
      data: action === "validate"
        ? {
          candidate_reference: candidateReference,
          unit_code: unit.unit_code,
          starting_weight_gram: unit.starting_weight_gram,
          plan_code: unit.plan_version_reference,
        }
        : { candidate_reference: candidateReference },
    };

    if (!existingCommand) {
      const { error: insertError } = await admin.from("warranty_candidate_commands").insert({
        unit_id: unitId,
        command: action,
        request_id: freshPayload.request_id,
        payload: freshPayload,
        initiated_by: user.id,
      });
      if (insertError?.code === "23505") {
        const { data, error } = await admin
          .from("warranty_candidate_commands")
          .select("id, request_id, payload, status, response")
          .eq("unit_id", unitId)
          .eq("command", action)
          .single();
        if (error) throw error;
        existingCommand = data;
      } else if (insertError) {
        throw insertError;
      }
    }
    if (existingCommand?.status === "completed") {
      return NextResponse.json({ success: true, data: existingCommand.response });
    }
    const commandPayload = (existingCommand?.payload as Record<string, unknown> | undefined) ?? freshPayload;

    const result = await sendYiiWarrantyCommand(actionConfig[action].path, commandPayload);
    const commandStatus = result.status >= 200 && result.status < 300 ? "completed" : "failed";
    await admin.from("warranty_candidate_commands").update({
      status: commandStatus,
      response: result.body,
      last_error: result.error,
      updated_at: new Date().toISOString(),
    }).eq("unit_id", unitId).eq("command", action);

    if (commandStatus === "completed") {
      await admin.from("activity_logs").insert({
        user_id: user.id,
        action: action === "validate" ? "WARRANTY_CANDIDATE_VALIDATED" : "WARRANTY_CANDIDATE_ACTIVATED",
        entity_type: "warranty_preparation_unit",
        entity_id: unitId,
        new_data: { candidate_reference: candidateReference, request_id: commandPayload.request_id },
      });
      return NextResponse.json({ success: true, data: result.body });
    }

    return NextResponse.json({ error: result.error ?? "Warranty Core menolak command" }, { status: result.status });
  } catch (error) {
    console.error("[POST /api/warranty/activation]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
