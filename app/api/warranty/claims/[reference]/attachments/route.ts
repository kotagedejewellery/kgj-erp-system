import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { hasWarrantyPermission, WARRANTY_CLAIM_COMPLETE_NON_WORKSHOP_PERMISSION } from "@/lib/warranty/permissions";
import { sendYiiWarrantyAttachment } from "@/lib/warranty/yii-command";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null
    && "arrayBuffer" in value
    && "name" in value
    && "size" in value
    && "type" in value;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const session = await createClient();
    const { data: { user }, error: userError } = await session.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, role:roles!users_role_id_fkey(name, permissions)")
      .eq("id", user.id)
      .is("deleted_at", null)
      .single();
    if (profileError || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = getRoleProps(profile);
    if (role.name !== "superadmin" && !hasWarrantyPermission(role.permissions, WARRANTY_CLAIM_COMPLETE_NON_WORKSHOP_PERMISSION)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { reference } = await params;
    if (!reference.trim() || reference.length > 120) return NextResponse.json({ error: "Claim tidak valid" }, { status: 400 });
    const form = await request.formData();
    const file = form.get("file");
    if (!isUploadedFile(file)) return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "File harus JPEG, PNG, atau PDF" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran file maksimal 10 MiB" }, { status: 400 });

    const response = await sendYiiWarrantyAttachment(reference, file);
    if (response.status >= 200 && response.status < 300) {
      const attachment = response.body?.data as Record<string, unknown> | undefined;
      const { error: auditError } = await admin.from("activity_logs").insert({
        user_id: user.id,
        action: "WARRANTY_CLAIM_ATTACHMENT_UPLOADED",
        entity_type: "warranty_claim",
        entity_id: reference,
        new_data: { attachment_id: attachment?.id ?? null, original_name: attachment?.original_name ?? file.name },
      });
      if (auditError) console.error("[POST /api/warranty/claims/[reference]/attachments] audit:", auditError);
      return NextResponse.json({ success: true, data: response.body });
    }
    return NextResponse.json({ error: response.error ?? "Lampiran tidak dapat diunggah" }, { status: response.status });
  } catch (error) {
    console.error("[POST /api/warranty/claims/[reference]/attachments]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
