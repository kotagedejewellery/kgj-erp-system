import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { hasWarrantyPermission, WARRANTY_WORK_UPDATE_PERMISSION } from "@/lib/warranty/permissions";
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
  { params }: { params: Promise<{ workId: string }> },
) {
  try {
    const session = await createClient();
    const { data: { user }, error: userError } = await session.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("id, status, role:roles!users_role_id_fkey(name, permissions)")
      .eq("id", user.id)
      .is("deleted_at", null)
      .single();
    if (!profile || profile.status !== "active" || !hasWarrantyPermission(getRoleProps(profile).permissions, WARRANTY_WORK_UPDATE_PERMISSION)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { workId } = await params;
    const { data: work, error: workError } = await admin.from("warranty_works")
      .select("id, claim_reference, status, pic_id")
      .eq("id", workId)
      .in("status", ["requested", "in_progress", "qc", "cancellation_requested"])
      .maybeSingle();
    if (workError || !work) return NextResponse.json({ error: "Warranty Work tidak aktif" }, { status: 404 });
    const roleName = getRoleProps(profile).name;
    const mayUpload = (work.status === "in_progress" && work.pic_id === user.id)
      || (["qc", "cancellation_requested"].includes(work.status) && ["qc_1", "qc_2"].includes(roleName));
    if (!mayUpload) return NextResponse.json({ error: "Anda tidak berhak mengunggah bukti untuk Work ini" }, { status: 403 });

    const form = await request.formData();
    const file = form.get("file");
    if (!isUploadedFile(file)) return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "File harus JPEG, PNG, atau PDF" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Ukuran file maksimal 10 MiB" }, { status: 400 });

    const response = await sendYiiWarrantyAttachment(work.claim_reference, file);
    if (response.status < 200 || response.status >= 300) {
      return NextResponse.json({ error: response.error ?? "Lampiran tidak dapat diunggah" }, { status: response.status });
    }
    const attachment = response.body?.data as Record<string, unknown> | undefined;
    if (attachment?.id === undefined || attachment.id === null) {
      return NextResponse.json({ error: "Warranty Core tidak mengembalikan ID lampiran" }, { status: 502 });
    }
    const { error: appendError } = await admin.rpc("append_warranty_work_attachment", {
      p_work_id: work.id,
      p_attachment_id: attachment.id,
    });
    if (appendError) return NextResponse.json({ error: appendError.message }, { status: 422 });

    const { error: auditError } = await admin.from("activity_logs").insert({
      user_id: user.id,
      action: "WARRANTY_WORK_ATTACHMENT_UPLOADED",
      entity_type: "warranty_work",
      entity_id: work.id,
      new_data: { claim_reference: work.claim_reference, attachment_id: attachment.id, original_name: attachment.original_name ?? file.name },
    });
    if (auditError) console.error("[POST /api/warranty/works/[workId]/attachments] audit:", auditError);
    return NextResponse.json({ success: true, data: response.body });
  } catch (error) {
    console.error("[POST /api/warranty/works/[workId]/attachments]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
