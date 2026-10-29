import { NextResponse } from "next/server";
import { getRoleProps } from "@/lib/auth/session";
import { canManageWarrantyPreparation } from "@/lib/warranty/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

const WARRANTY_PLAN_DURATIONS = [
  { months: 12, label: "1 tahun" },
  { months: 24, label: "2 tahun" },
  { months: 36, label: "3 tahun" },
  { months: 60, label: "5 tahun" },
  { months: 120, label: "10 tahun" },
];

function warrantyPlanOptions(brandId: number | null | undefined) {
  const brand = brandId === 1 ? { code: "KGJ", label: "KGJ" } : brandId === 2 ? { code: "HIJAZ", label: "Hijaz" } : null;
  return brand
    ? WARRANTY_PLAN_DURATIONS.map(({ months, label }) => ({ value: `${brand.code}-${months}M-V1`, label: `${brand.label} ${label}` }))
    : [];
}

async function authorize() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, status, role:roles!users_role_id_fkey(name, permissions)")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single();
  if (!profile) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (profile.status !== "active") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const role = getRoleProps(profile);
  if (role.name !== "superadmin" && !canManageWarrantyPreparation(role.permissions)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { admin, userId: user.id };
}

function requiredText(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} wajib diisi`);
  }
  const result = value.trim();
  if (result.length > maxLength) throw new Error(`${field} terlalu panjang`);
  return result;
}

function makeUnitCode(orderId: string, candidateSequence: number) {
  return `GAR-${orderId.slice(0, 8).toUpperCase()}-${candidateSequence}`;
}

async function getOrder(admin: AdminClient, orderId: string) {
  const { data, error } = await admin
    .from("legacy_orders")
    .select("id, legacy_id, kode_order, id_brand")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getOrderByReference(admin: AdminClient, orderReference: string) {
  const { data, error } = await admin
    .from("legacy_orders")
    .select("id, legacy_id, kode_order, id_brand")
    .eq("kode_order", orderReference)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getCurrentStage(admin: AdminClient, orderId: string) {
  const { data, error } = await admin
    .from("tracking_stages")
    .select("current_stage")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  return data?.current_stage ?? "";
}

async function getPreparation(admin: AdminClient, orderId: string, planOptions: { value: string; label: string }[]) {
  const [preparationResult, unitsResult, outboxResult, contractsResult] = await Promise.all([
    admin
      .from("warranty_preparations")
      .select("is_ready, ready_at")
      .eq("order_id", orderId)
      .maybeSingle(),
    admin
      .from("warranty_preparation_units")
      .select("id, candidate_sequence, unit_code, gender, starting_weight_gram, plan_version_reference")
      .eq("order_id", orderId)
      .order("candidate_sequence", { ascending: true }),
    admin
      .from("warranty_activation_outbox")
      .select("event_id, status, created_at, delivered_at")
      .eq("order_id", orderId)
      .maybeSingle(),
    admin
      .from("warranty_contract_projections")
      .select("unit_code, contract_reference, activated_at, expires_at")
      .eq("order_id", orderId),
  ]);
  if (preparationResult.error) throw preparationResult.error;
  if (unitsResult.error) throw unitsResult.error;
  if (outboxResult.error) throw outboxResult.error;
  if (contractsResult.error) throw contractsResult.error;

  const unitIds = (unitsResult.data ?? []).map((unit) => unit.id);
  const commandsResult = unitIds.length
    ? await admin
      .from("warranty_candidate_commands")
      .select("unit_id, command, status, last_error")
      .in("unit_id", unitIds)
    : { data: [], error: null };
  if (commandsResult.error) throw commandsResult.error;

  const commandsByUnit = new Map<string, Record<string, { status: string; last_error: string | null }>>();
  for (const command of commandsResult.data ?? []) {
    commandsByUnit.set(command.unit_id, {
      ...(commandsByUnit.get(command.unit_id) ?? {}),
      [command.command]: { status: command.status, last_error: command.last_error },
    });
  }
  const contractsByUnitCode = new Map((contractsResult.data ?? []).map((contract) => [contract.unit_code, contract]));

  return {
    is_ready: preparationResult.data?.is_ready ?? false,
    ready_at: preparationResult.data?.ready_at ?? null,
    plan_options: planOptions,
    units: (unitsResult.data ?? []).map((unit) => ({
      ...unit,
      commands: commandsByUnit.get(unit.id) ?? {},
      contract: contractsByUnitCode.get(unit.unit_code) ?? null,
    })),
    activation: outboxResult.data ?? null,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await authorize();
    if ("error" in auth) return auth.error;

    const searchParams = new URL(request.url).searchParams;
    const orderId = searchParams.get("order_id");
    const orderReference = searchParams.get("order_reference");
    if (!orderId && !orderReference) {
      return NextResponse.json({ error: "order_id atau order_reference wajib diisi" }, { status: 400 });
    }
    const order = orderId
      ? await getOrder(auth.admin, orderId)
      : await getOrderByReference(auth.admin, requiredText(orderReference, "Nomor order", 120));
    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    const [preparation, currentStage] = await Promise.all([
      getPreparation(auth.admin, order.id, warrantyPlanOptions(order.id_brand)),
      getCurrentStage(auth.admin, order.id),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        ...preparation,
        order: { id: order.id, reference: order.kode_order, current_stage: currentStage },
      },
    });
  } catch (error) {
    console.error("[GET /api/warranty/preparation]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorize();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const orderId = requiredText(body?.order_id, "order_id", 100);
    const gender = requiredText(body?.gender, "gender", 20);
    if (!(["pria", "wanita", "lainnya"] as string[]).includes(gender)) {
      return NextResponse.json({ error: "gender tidak valid" }, { status: 400 });
    }
    const startingWeight = Number(body?.starting_weight_gram);
    if (!Number.isFinite(startingWeight) || startingWeight <= 0) {
      return NextResponse.json({ error: "berat awal harus lebih dari 0" }, { status: 400 });
    }
    const planVersionReference = requiredText(body?.plan_version_reference, "Plan Version", 150);
    const order = await getOrder(auth.admin, orderId);
    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }
    if (!warrantyPlanOptions(order.id_brand).some((plan) => plan.value === planVersionReference)) {
      return NextResponse.json({ error: "Plan Version tidak berlaku untuk brand order" }, { status: 422 });
    }

    const { data: preparation, error: preparationError } = await auth.admin
      .from("warranty_preparations")
      .select("is_ready")
      .eq("order_id", orderId)
      .maybeSingle();
    if (preparationError) throw preparationError;
    if (preparation?.is_ready) {
      return NextResponse.json({ error: "Persiapan sudah ditandai siap" }, { status: 409 });
    }
    if (!preparation) {
      const { error } = await auth.admin
        .from("warranty_preparations")
        .insert({ order_id: orderId });
      if (error) throw error;
    }

    const { data: latestUnit, error: latestUnitError } = await auth.admin
      .from("warranty_preparation_units")
      .select("candidate_sequence")
      .eq("order_id", orderId)
      .order("candidate_sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestUnitError) throw latestUnitError;
    const candidateSequence = Number(latestUnit?.candidate_sequence ?? 0) + 1;
    const unitCode = typeof body?.unit_code === "string" && body.unit_code.trim()
      ? requiredText(body.unit_code, "Kode unit", 120)
      : makeUnitCode(orderId, candidateSequence);

    const { data: unit, error: unitError } = await auth.admin
      .from("warranty_preparation_units")
      .insert({
        order_id: orderId,
        candidate_sequence: candidateSequence,
        unit_code: unitCode,
        gender,
        starting_weight_gram: startingWeight,
        plan_version_reference: planVersionReference,
        created_by: auth.userId,
      })
      .select("id, candidate_sequence, unit_code, gender, starting_weight_gram, plan_version_reference")
      .single();
    if (unitError) throw unitError;

    await auth.admin.from("activity_logs").insert({
      user_id: auth.userId,
      action: "WARRANTY_PREPARATION_UNIT_ADDED",
      entity_type: "warranty_preparation_unit",
      entity_id: unit.id,
      new_data: unit,
    });

    return NextResponse.json({ success: true, data: unit }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan server";
    if (message.endsWith("wajib diisi") || message.endsWith("terlalu panjang")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[POST /api/warranty/preparation]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorize();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const orderId = requiredText(body?.order_id, "order_id", 100);
    if (body?.action !== "mark_ready") {
      return NextResponse.json({ error: "Aksi persiapan tidak valid" }, { status: 400 });
    }

    const [preparationResult, unitsResult] = await Promise.all([
      auth.admin.from("warranty_preparations").select("is_ready").eq("order_id", orderId).maybeSingle(),
      auth.admin.from("warranty_preparation_units").select("id").eq("order_id", orderId).limit(1),
    ]);
    if (preparationResult.error) throw preparationResult.error;
    if (unitsResult.error) throw unitsResult.error;
    if (!preparationResult.data) {
      return NextResponse.json({ error: "Belum ada unit garansi" }, { status: 409 });
    }
    if (preparationResult.data.is_ready) {
      return NextResponse.json({ error: "Persiapan sudah ditandai siap" }, { status: 409 });
    }
    if (!unitsResult.data?.length) {
      return NextResponse.json({ error: "Tambahkan minimal satu unit garansi" }, { status: 400 });
    }

    const readyAt = new Date().toISOString();
    const { error: updateError } = await auth.admin
      .from("warranty_preparations")
      .update({ is_ready: true, ready_at: readyAt, ready_by: auth.userId, updated_at: readyAt })
      .eq("order_id", orderId)
      .eq("is_ready", false);
    if (updateError) throw updateError;

    await auth.admin.from("activity_logs").insert({
      user_id: auth.userId,
      action: "WARRANTY_PREPARATION_READY",
      entity_type: "warranty_preparation",
      entity_id: orderId,
    });

    const order = await getOrder(auth.admin, orderId);
    return NextResponse.json({
      success: true,
      data: await getPreparation(auth.admin, orderId, warrantyPlanOptions(order?.id_brand)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan server";
    if (message.endsWith("wajib diisi") || message.endsWith("terlalu panjang")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[PATCH /api/warranty/preparation]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authorize();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const orderId = requiredText(body?.order_id, "order_id", 100);
    const unitId = requiredText(body?.unit_id, "unit_id", 100);
    const { data: preparation, error: preparationError } = await auth.admin
      .from("warranty_preparations")
      .select("is_ready")
      .eq("order_id", orderId)
      .maybeSingle();
    if (preparationError) throw preparationError;
    if (preparation?.is_ready) {
      return NextResponse.json({ error: "Persiapan sudah ditandai siap" }, { status: 409 });
    }

    const { error } = await auth.admin
      .from("warranty_preparation_units")
      .delete()
      .eq("id", unitId)
      .eq("order_id", orderId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan server";
    if (message.endsWith("wajib diisi") || message.endsWith("terlalu panjang")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[DELETE /api/warranty/preparation]", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
