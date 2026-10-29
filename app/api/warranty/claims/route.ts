import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import {
  hasWarrantyPermission,
  WARRANTY_CLAIM_COMPLETE_NON_WORKSHOP_PERMISSION,
  WARRANTY_CLAIM_CANCEL_PERMISSION,
  WARRANTY_CLAIM_CREATE_PERMISSION,
  WARRANTY_CLAIM_SUBMIT_PERMISSION,
  WARRANTY_EXCEPTION_REQUEST_PERMISSION,
} from "@/lib/warranty/permissions";
import { sendYiiWarrantyCommand } from "@/lib/warranty/yii-command";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Action = "create" | "submit" | "complete_non_workshop" | "cancel" | "request_quota_exception";

const actions: Record<Action, { permission: string; path: string }> = {
  create: {
    permission: WARRANTY_CLAIM_CREATE_PERMISSION,
    path: "/api/warranty/v1/commands/claim-drafts",
  },
  submit: {
    permission: WARRANTY_CLAIM_SUBMIT_PERMISSION,
    path: "/api/warranty/v1/commands/claims/submit",
  },
  complete_non_workshop: {
    permission: WARRANTY_CLAIM_COMPLETE_NON_WORKSHOP_PERMISSION,
    path: "/api/warranty/v1/commands/claims/complete-non-workshop",
  },
  cancel: {
    permission: WARRANTY_CLAIM_CANCEL_PERMISSION,
    path: "/api/warranty/v1/commands/claims/cancel",
  },
  request_quota_exception: {
    permission: WARRANTY_EXCEPTION_REQUEST_PERMISSION,
    path: "/api/warranty/v1/commands/claims/request-quota-exception",
  },
};

function text(value: unknown, maximumLength = 5000) {
  return typeof value === "string" && value.trim() && value.trim().length <= maximumLength
    ? value.trim()
    : null;
}

function version(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export async function POST(request: Request) {
  try {
    const session = await createClient();
    const { data: { user }, error: userError } = await session.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const action = body?.action as Action;
    if (!(action in actions)) return NextResponse.json({ error: "Aksi Claim tidak valid" }, { status: 400 });

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
    const { permission, path } = actions[action];
    if (role.name !== "superadmin" && !hasWarrantyPermission(role.permissions, permission)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let data: Record<string, unknown>;
    if (action === "create") {
      const contractReference = text(body?.contract_reference, 120);
      const benefitCode = text(body?.benefit_code, 120);
      const conditionNotes = text(body?.condition_notes);
      if (!contractReference || !benefitCode || !conditionNotes) {
        return NextResponse.json({ error: "Contract, benefit, dan kondisi Claim wajib diisi" }, { status: 400 });
      }
      data = {
        contract_reference: contractReference,
        benefit_code: benefitCode,
        condition_notes: conditionNotes,
      };
    } else {
      const claimReference = text(body?.claim_reference, 120);
      const expectedVersion = version(body?.expected_version);
      if (!claimReference || !expectedVersion) {
        return NextResponse.json({ error: "Claim atau versinya tidak valid" }, { status: 400 });
      }
      data = { claim_reference: claimReference };
      if (action === "complete_non_workshop") {
        const finalWeight = body?.final_weight_gram;
        if (finalWeight !== undefined && finalWeight !== null && finalWeight !== "") {
          const numericWeight = Number(finalWeight);
          if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
            return NextResponse.json({ error: "Berat akhir tidak valid" }, { status: 400 });
          }
          data.final_weight_gram = numericWeight;
        }
      }
      if (action === "cancel" || action === "request_quota_exception") {
        const reason = text(body?.reason);
        if (!reason) {
          return NextResponse.json({ error: "Alasan wajib diisi" }, { status: 400 });
        }
        data.reason = reason;
      }
      const response = await sendYiiWarrantyCommand(path, {
        schema_version: 1,
        request_id: randomUUID(),
        expected_version: expectedVersion,
        actor: {
          id: user.id,
          display_name: profile.full_name || profile.email || user.email || user.id,
          permissions: [permission],
        },
        data,
      });
      if (response.status >= 200 && response.status < 300) {
        if (action === "request_quota_exception") {
          const payload = response.body?.data as Record<string, unknown> | undefined;
          const exceptionRequest = payload?.exception_request as Record<string, unknown> | undefined;
          const exceptionRequestId = text(exceptionRequest?.reference, 120);
          if (exceptionRequestId) {
            const { error: auditError } = await admin.from("activity_logs").insert({
              user_id: user.id,
              action: "WARRANTY_EXCEPTION_REQUESTED",
              entity_type: "warranty_exception_request",
              entity_id: exceptionRequestId,
            });
            if (auditError) console.error("[POST /api/warranty/claims] exception audit:", auditError);
            const { error: requesterError } = await admin.from("warranty_exception_request_actors").upsert({
              exception_request_id: exceptionRequestId,
              requested_by: user.id,
            }, { onConflict: "exception_request_id" });
            if (requesterError) {
              console.error("[POST /api/warranty/claims] exception requester:", requesterError);
            } else {
              const { error: requestError } = await admin
                .from("warranty_exception_requests")
                .update({ requested_by: user.id, updated_at: new Date().toISOString() })
                .eq("exception_request_id", exceptionRequestId)
                .is("requested_by", null);
              if (requestError) console.error("[POST /api/warranty/claims] exception request actor:", requestError);
            }
          }
        }
        return NextResponse.json({ success: true, data: response.body });
      }
      return NextResponse.json({ error: response.error ?? "Warranty Core menolak Claim" }, { status: response.status });
    }

    const response = await sendYiiWarrantyCommand(path, {
      schema_version: 1,
      request_id: randomUUID(),
      expected_version: null,
      actor: {
        id: user.id,
        display_name: profile.full_name || profile.email || user.email || user.id,
        permissions: [permission],
      },
      data,
    });
    if (response.status >= 200 && response.status < 300) return NextResponse.json({ success: true, data: response.body });
    return NextResponse.json({ error: response.error ?? "Warranty Core menolak Claim" }, { status: response.status });
  } catch (error) {
    console.error("[POST /api/warranty/claims]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
