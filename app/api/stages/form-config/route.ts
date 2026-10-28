// app/api/stages/form-config/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAGE_SEQUENCE, STAGE_GROUP } from "@/lib/stages";
import { getRoleProps } from "@/lib/auth/session";
import {
  komponenLabel,
  fontLabel,
  produkKategoriLabel,
} from "@/lib/legacy/komponen-labels";
import { produkInfo } from "@/lib/legacy/produk-labels";

// ── Types ──────────────────────────────────────────────────────────────────────

type FieldType =
  | "text"
  | "number"
  | "select"
  | "textarea"
  | "boolean"
  | "quality_checklist"
  | "multi_select"
  | "file"
  | "date";

export type StageType =
  | "done"
  | "select_action"
  | "quality_checklist"
  | "packing"
  | "delivery"
  | "date";

interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: { value: string; label: string; group?: string }[];
  placeholder?: string;
  items?: { key: string; label: string; reworkStage?: string; required?: boolean }[];
  accept?: string;
  maxSize?: number;
}

interface StageConfig {
  label: string;
  stageType: StageType;
  fields: FieldConfig[];
}

// ── Stage configs ──────────────────────────────────────────────────────────────

const NOTES: FieldConfig = {
  name: "notes",
  label: "Catatan",
  type: "textarea",
  required: false,
};

const STAGE_CONFIGS: Record<string, StageConfig> = {
  racik_bahan: {
    label: "Persiapan Bahan",
    stageType: "done",
    fields: [NOTES],
  },

  lebur_bahan: {
    label: "Lebur Bahan",
    stageType: "done",
    fields: [NOTES],
  },

  cek_kadar: {
    label: "Cek Kadar",
    stageType: "select_action",
    fields: [
      {
        name: "result",
        label: "Hasil Cek Kadar",
        type: "select",
        required: true,
        options: [
          { value: "lolos", label: "Lolos — Lanjut ke tahap berikutnya" },
          {
            value: "tidak_lolos",
            label: "Tidak Lolos — Kembali ke Lebur Bahan",
          },
        ],
      },
      { ...NOTES, placeholder: "Keterangan hasil cek kadar..." },
    ],
  },

  pembentukan_cincin: {
    label: "Pembentukan Cincin",
    stageType: "select_action",
    fields: [
      {
        name: "perlu_microsetting",
        label: "Perlu Micro Setting?",
        type: "select",
        required: true,
        options: [
          { value: "lanjut", label: "Lanjut ke Micro Setting" },
          { value: "skip", label: "Tidak Perlu — Langsung Pemolesan" },
        ],
      },
      {
        name: "tukang",
        label: "Tukang",
        type: "select",
        required: false,
        options: [
          { value: "PR", label: "PR" },
          { value: "RZ", label: "RZ" },
          { value: "NR", label: "NR" },
          { value: "ZG", label: "ZG" },
          { value: "BG", label: "BG" },
          { value: "DI", label: "DI" },
          { value: "IS", label: "IS" },
          { value: "WK", label: "WK" },
          { value: "AN", label: "AN" },
        ],
      },
      NOTES,
    ],
  },

  pemasangan_permata: {
    label: "Micro Setting",
    stageType: "select_action",
    fields: [
      {
        name: "tukang",
        label: "Tukang",
        type: "select",
        required: false,
        options: [
          { value: "AL", label: "AL" },
          { value: "AG", label: "AG" },
          { value: "YR", label: "YR" },
          { value: "RN", label: "RN" },
          { value: "UD", label: "UD" },
        ],
      },
      NOTES,
    ],
  },

  pemolesan: {
    label: "Pemolesan Awal",
    stageType: "done",
    fields: [NOTES],
  },

  qc_1: {
    label: "Quality Control Awal",
    stageType: "quality_checklist",
    fields: [
      {
        name: "quality_checklist",
        label: "Checklist QC Awal",
        type: "quality_checklist",
        required: true,
        items: [
          { key: "bentuk_sesuai", label: "Bentuk cincin sesuai order", reworkStage: "pembentukan_cincin" },
          { key: "ukuran_sesuai", label: "Ukuran cincin sesuai", reworkStage: "pembentukan_cincin" },
          { key: "berat_minimum", label: "Berat memenuhi syarat minimum", reworkStage: "pembentukan_cincin" },
          { key: "solder_rapi", label: "Sambungan / patri rapi dan kuat", reworkStage: "pembentukan_cincin" },
          { key: "permukaan_bersih", label: "Permukaan bersih, tidak ada cacat", reworkStage: "pemolesan" },
          { key: "pemasangan_permata", label: "Pemasangan permata sesuai atau belum?", reworkStage: "pemasangan_permata" },
          { key: "cek_kadar", label: "Cek kadar sudah sesuai atau belum?", reworkStage: "cek_kadar" },
          { key: "sertifikat_berlian", label: "Sertifikat berlian tersedia", reworkStage: "", required: false },
        ],
      },
      { ...NOTES, placeholder: "Temuan QC, catatan perbaikan..." },
    ],
  },

  laser: {
    label: "Laser Engraving",
    stageType: "select_action",
    fields: [
      {
        name: "tukang_batik",
        label: "Tukang Laser Batik",
        type: "select",
        required: false,
        options: [],
      },
      {
        name: "tukang_nama",
        label: "Tukang Laser Nama",
        type: "select",
        required: false,
        options: [],
      },
      {
        name: "model_nusantara",
        label: "Model Nusantara",
        type: "multi_select",
        required: false,
        options: [
          { value: "kawung_nj001", label: "Kawung NJ001", group: "Jawa (NJ)" },
          { value: "kawung_nj002", label: "Kawung NJ002", group: "Jawa (NJ)" },
          { value: "mega_mendung_nj003", label: "Mega Mendung NJ003", group: "Jawa (NJ)" },
          { value: "kawung_nj004", label: "Kawung NJ004", group: "Jawa (NJ)" },
          { value: "kawung_nj005", label: "Kawung NJ005", group: "Jawa (NJ)" },
          { value: "sidomukti_nj007", label: "Sidomukti NJ007", group: "Jawa (NJ)" },
          { value: "truntum_nj008", label: "Truntum NJ008", group: "Jawa (NJ)" },
          { value: "dayak_perisai_nk001", label: "Dayak Perisai NK001", group: "Kalimantan (NK)" },
          { value: "tengkawak_ampiek_nk002", label: "Tengkawak Ampiek NK002", group: "Kalimantan (NK)" },
          { value: "dayak_perisai_nk003", label: "Dayak Perisai NK003", group: "Kalimantan (NK)" },
          { value: "tidayu_nk004", label: "Tidayu NK004", group: "Kalimantan (NK)" },
          { value: "jagatan_pisang_nb001", label: "Jagatan Pisang NB001", group: "Bali & Nusa Tenggara (NB)" },
          { value: "sabuk_prada_nb002", label: "Sabuk Prada NB002", group: "Bali & Nusa Tenggara (NB)" },
          { value: "batik_bunga_bali_nb003", label: "Batik Bunga Bali NB003", group: "Bali & Nusa Tenggara (NB)" },
          { value: "kamoro_np001", label: "Kamoro NP001", group: "Papua (NP)" },
          { value: "batik_asmat_np002", label: "Batik Asmat NP002", group: "Papua (NP)" },
          { value: "motif_cendrawasih_np003", label: "Motif Cendrawasih NP003", group: "Papua (NP)" },
          { value: "motif_sentani_np004", label: "Motif Sentani NP004", group: "Papua (NP)" },
          { value: "biak_np005", label: "Biak NP005", group: "Papua (NP)" },
          { value: "bunga_melur_ns001", label: "Bunga Melur NS001", group: "Sumatera (NS)" },
          { value: "pucuak_labuar_ns002", label: "Pucuak Labuar NS002", group: "Sumatera (NS)" },
          { value: "naga_besaung_ns003", label: "Naga Besaung NS003", group: "Sumatera (NS)" },
          { value: "ulos_ragi_hotang_ns004", label: "Ulos Ragi Hotang NS004", group: "Sumatera (NS)" },
          { value: "tapis_lampung_ns005", label: "Tapis Lampung NS005", group: "Sumatera (NS)" },
        ],
      },
      NOTES,
    ],
  },

  finishing: {
    label: "Finishing",
    stageType: "select_action",
    fields: [
      {
        name: "tukang",
        label: "Tukang",
        type: "select",
        required: false,
        options: [
          { value: "EF", label: "EF" },
          { value: "RA", label: "RA" },
          { value: "DO", label: "DO" },
          { value: "RD", label: "RD" },
        ],
      },
      NOTES,
    ],
  },

  qc_2: {
    label: "Quality Control Akhir",
    stageType: "quality_checklist",
    fields: [
      {
        name: "quality_checklist",
        label: "Checklist QC Akhir",
        type: "quality_checklist",
        required: true,
        items: [
          { key: "kualitas_laser", label: "Hasil laser / ukiran bersih dan terbaca", reworkStage: "finishing" },
          { key: "kualitas_finishing", label: "Finishing merata, tidak ada bercak", reworkStage: "finishing" },
          { key: "teks_ukiran_benar", label: "Teks ukiran sesuai order (cek ejaan)", reworkStage: "finishing" },
          { key: "bentuk_final_sesuai", label: "Bentuk final sesuai order", reworkStage: "finishing" },
          { key: "produk_bersih", label: "Produk bersih, siap serah terima", reworkStage: "pembentukan_cincin" },
          { key: "permata_sesuai_bentuk", label: "Permata sesuai bentuk", reworkStage: "", required: false },
        ],
      },
      { ...NOTES, placeholder: "Temuan QC akhir..." },
    ],
  },

  konfirmasi: {
    label: "Konfirmasi Customer Care",
    stageType: "select_action",
    fields: [
      {
        name: "result",
        label: "Hasil Konfirmasi",
        type: "select",
        required: true,
        options: [
          { value: "approved", label: "Disetujui — Lanjut ke Packing" },
          {
            value: "not_approved",
            label: "Tidak Disetujui — Kembali ke QC Akhir",
          },
        ],
      },
      {
        name: "foto_cincin_pria",
        label: "Foto Cincin Pria",
        type: "file",
        required: false,
        accept: "image/jpeg,image/png,image/webp",
        maxSize: 5 * 1024 * 1024,
      },
      {
        name: "foto_cincin_wanita",
        label: "Foto Cincin Wanita",
        type: "file",
        required: false,
        accept: "image/jpeg,image/png,image/webp",
        maxSize: 5 * 1024 * 1024,
      },
      {
        name: "nomor_resi",
        label: "Nomor Resi",
        type: "text",
        required: false,
        placeholder: "Masukkan nomor resi pengiriman",
      },
      {
        name: "tanggal_packing",
        label: "Tanggal Packing",
        type: "date",
        required: false,
        placeholder: "Pilih tanggal packing",
      },
      { ...NOTES, placeholder: "Catatan konfirmasi customer care..." },
    ],
  },

  packing: {
    label: "Packing & Persiapan Kirim",
    stageType: "select_action",
    fields: [
      {
        name: "result",
        label: "Hasil Pengecekan",
        type: "select",
        required: true,
        options: [
          { value: "sesuai", label: "Pesanan Sesuai — Lanjut ke Pengiriman" },
          { value: "belum", label: "Belum Sesuai — Perlu Perbaikan" },
        ],
      },
      { ...NOTES, placeholder: "Catatan packing..." },
    ],
  },

  pengiriman: {
    label: "Pengiriman",
    stageType: "select_action",
    fields: [
      {
        name: "is_delivered",
        label: "Status Pengiriman",
        type: "select",
        required: true,
        options: [
          { value: "sampai_expedisi", label: "Pengiriman sudah sampai di Expedisi" },
          { value: "sampai_store", label: "Pengiriman sudah sampai di Store" },
          { value: "gagal", label: "Pengiriman Gagal" },
        ],
      },
      { ...NOTES, placeholder: "Catatan pengiriman..." },
    ],
  },

};

// ── Role access ────────────────────────────────────────────────────────────────

const TUKANG_STAGES = new Set([
  "pembentukan_cincin",
  "pemasangan_permata",
  "laser",
  "finishing",
]);

const ROLE_STAGES: Record<string, Set<string>> = {
  operational_supervisor: new Set(
    STAGE_SEQUENCE.filter(s => s.startsWith("approval_") && !s.includes("produksi"))
  ),
  production_supervisor: new Set(["approval_produksi"]),
  customer_care: new Set(["konfirmasi"]),
};

function hasAccess(
  roleName: string,
  roleGroup: string,
  allowedStages: string[],
  stage: string,
): boolean {
  if (roleName === "superadmin") return true;
  if (allowedStages.includes(stage)) return true;
  if (ROLE_STAGES[roleName]?.has(stage)) return true;
  if (STAGE_GROUP[stage] === roleGroup) return true;
  if (roleGroup === "management" && stage.startsWith("approval_")) return true;
  return false;
}

// ── Get personnel-backed options ────────────────────────────────────────────────

async function enrichTukangOptions(
  admin: ReturnType<typeof createAdminClient>,
  stage: string,
  fields: FieldConfig[],
): Promise<FieldConfig[]> {
  if (!TUKANG_STAGES.has(stage)) return fields;

  if (stage === "laser") {
    const [batik, nama] = await Promise.all([
      admin.from("stage_personnel").select("person_code").eq("stage", "laser").eq("sub_type", "batik").order("sort_order"),
      admin.from("stage_personnel").select("person_code").eq("stage", "laser").eq("sub_type", "nama").order("sort_order"),
    ]);

    const toOptions = (data: { person_code: string }[] | null) =>
      data && data.length > 0 ? data.map((p) => ({ value: p.person_code, label: p.person_code })) : null;

    const batikOpts = toOptions(batik.data);
    const namaOpts = toOptions(nama.data);

    return fields.map((f) => {
      if (f.name === "tukang_batik" && batikOpts) return { ...f, options: batikOpts };
      if (f.name === "tukang_nama" && namaOpts) return { ...f, options: namaOpts };
      return f;
    });
  }

  const { data: personnel } = await admin
    .from("stage_personnel")
    .select("person_code")
    .eq("stage", stage)
    .order("sort_order", { ascending: true });

  if (!personnel || personnel.length === 0) return fields;

  const options = personnel.map((p: { person_code: string }) => ({
    value: p.person_code,
    label: p.person_code,
  }));

  return fields.map((f) => {
    if (f.name === "tukang") {
      return { ...f, options };
    }
    return f;
  });
}

// ── GET ────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !authUser)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");
    const stage = searchParams.get("stage");

    if (!stage)
      return NextResponse.json({ error: "stage wajib diisi" }, { status: 400 });
    if (!orderId)
      return NextResponse.json(
        { error: "order_id wajib diisi" },
        { status: 400 },
      );

    const admin = createAdminClient();

    const { data: userData } = await admin
      .from("users")
      .select(
        "id, full_name, role:roles!users_role_id_fkey(id, name, role_group, allowed_stages, permissions)",
      )
      .eq("id", authUser.id)
      .is("deleted_at", null)
      .single();

    if (!userData)
      return NextResponse.json(
        { error: "Data user tidak ditemukan" },
        { status: 404 },
      );

    const roleName: string = getRoleProps(userData).name;
    const roleGroup: string = getRoleProps(userData).role_group;
    const allowedStages: string[] = getRoleProps(userData).allowed_stages;
    const permissions = getRoleProps(userData).permissions;

    if (!hasAccess(roleName, roleGroup, allowedStages, stage)) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke tahap ini" },
        { status: 403 },
      );
    }

    const { data: legacyOrder, error: orderError } = await admin
      .from("legacy_orders")
      .select("id, kode_order, nama, no_hp, email, alamat, alamat_lengkap, tgl_selesai, catatan, harga_final, total_harga, order_down_payment, berat_cincin_pria, berat_cincin_wanita, jenis_acara, id_produk, komponen, reference_image_pria_url, reference_image_wanita_url")
      .eq("id", orderId)
      .single();

    if (orderError && orderError.code !== "PGRST116") {
      console.error("[Form Config] legacy_orders query error:", orderError);
      const missingColumn = orderError.message?.includes("does not exist") || orderError.code === "42703";
      return NextResponse.json(
        {
          error: missingColumn
            ? "Skema DB belum sinkron — jalankan migration 013 & 014 di Supabase"
            : "Gagal mengambil data order",
        },
        { status: 500 },
      );
    }
    if (!legacyOrder)
      return NextResponse.json(
        { error: "Order tidak ditemukan" },
        { status: 404 },
      );

    const { data: tracking } = await admin
      .from("tracking_stages")
      .select("current_stage, stage_status")
      .eq("order_id", orderId)
      .maybeSingle();

    // Map legacy order into the shape the rest of this handler expects.
    // Komponen IDs are resolved to labels via the Yii2 master-data mapping
    // (lib/legacy/komponen-labels.ts); unavailable legacy fields stay null.
    const komponenList = (legacyOrder.komponen ?? []) as Array<Record<string, unknown>>;
    const pria = komponenList.find((k) => k.id_gender === 1);
    const wanita = komponenList.find((k) => k.id_gender === 2);

    const labelArr = (id: unknown): string[] | null => {
      const label = komponenLabel(id);
      return label ? [label] : null;
    };

    const komponenNote = (k?: Record<string, unknown>): string | null =>
      typeof k?.keterangan === "string" && k.keterangan.trim()
        ? k.keterangan.replace(/<[^>]*>/g, "").trim()
        : null;

    const fonts = [
      fontLabel(pria?.id_ukiran),
      fontLabel(wanita?.id_ukiran),
    ].filter(Boolean) as string[];

    const produk = produkInfo(legacyOrder.id_produk);

    const order = {
      id: legacyOrder.id,
      order_number: legacyOrder.kode_order,
      current_stage: tracking?.current_stage ?? "penerimaan_order",
      status: tracking?.stage_status ?? "in_progress",
      deadline: legacyOrder.tgl_selesai ?? null,
      customer_name: legacyOrder.nama ?? null,
      customer_wa: legacyOrder.no_hp ?? null,
      customer_email: legacyOrder.email ?? null,
      customer_instagram: null,
      acara: legacyOrder.jenis_acara ?? null,
      kebutuhan_acara: null,
      alat_ukur: null,
      gramasi_pria: legacyOrder.berat_cincin_pria ?? null,
      gramasi_wanita: legacyOrder.berat_cincin_wanita ?? null,
      ukiran_cincin_pria: null,
      ukiran_cincin_wanita: null,
      keterangan_pria: komponenNote(pria),
      keterangan_wanita: komponenNote(wanita),
      ukuran_pria: pria?.ukuran as string ?? null,
      ukiran_pria: pria?.teks as string ?? null,
      jenis_cincin_pria: komponenLabel(pria?.id_jenis_bahan),
      reference_image_pria_url: legacyOrder.reference_image_pria_url ?? null,
      model_bentuk_pria: null,
      microsetting_pria: labelArr(pria?.id_microsetting),
      detail_laser_pria: labelArr(pria?.id_laser),
      detail_finishing_pria: labelArr(pria?.id_finishing),
      ukuran_wanita: wanita?.ukuran as string ?? null,
      ukiran_wanita: wanita?.teks as string ?? null,
      jenis_cincin_wanita: komponenLabel(wanita?.id_jenis_bahan),
      reference_image_wanita_url: legacyOrder.reference_image_wanita_url ?? null,
      model_bentuk_wanita: null,
      microsetting_wanita: labelArr(wanita?.id_microsetting),
      detail_laser_wanita: labelArr(wanita?.id_laser),
      detail_finishing_wanita: labelArr(wanita?.id_finishing),
      kategori:
        produkKategoriLabel(pria?.id_produk_kategori) ??
        produkKategoriLabel(wanita?.id_produk_kategori),
      transfer_ke_bank: null,
      jenis_cincin_features: [
        komponenLabel(pria?.id_permata),
        komponenLabel(wanita?.id_permata),
      ].filter(Boolean) as string[] | null,
      dari_artis_detail: null,
      font: fonts.length > 0 ? [...new Set(fonts)].join(" / ") : null,
      laser_position: null,
      box: null,
      pengiriman: null,
      alamat_pengiriman: legacyOrder.alamat_lengkap ?? legacyOrder.alamat ?? null,
      harga: legacyOrder.harga_final ?? legacyOrder.total_harga ?? null,
      dp_amount: legacyOrder.order_down_payment ?? null,
      catatan: legacyOrder.catatan ?? null,
    };

    const { data: lastResult } = await admin
      .from("stage_history")
      .select("data")
      .eq("order_id", orderId)
      .eq("stage", stage)
      .order("attempt_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const stageConfig = STAGE_CONFIGS[stage];
    let fields = await enrichTukangOptions(admin, stage, stageConfig?.fields ?? []);

    // ── pembentukan_cincin: pre-fill "perlu microsetting" from order data ─────
    // id_microsetting: 8 = "Sesuai Model" (skip), 9 = "Request Khusus" (perlu).
    let perluMicrosettingDefault: string | null = null;
    if (stage === "pembentukan_cincin") {
      const microIds = [pria, wanita]
        .map((k) => Number(k?.id_microsetting))
        .filter((v) => Number.isFinite(v));
      perluMicrosettingDefault =
        microIds.length > 0 && microIds.every((v) => v === 8) ? "skip" : "lanjut";
    }

    // ── qc_1: hide microsetting checklist item when it was skipped ────────────
    if (stage === "qc_1") {
      const { data: pembentukanResult } = await admin
        .from("stage_history")
        .select("data")
        .eq("order_id", orderId)
        .eq("stage", "pembentukan_cincin")
        .order("attempt_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const pd = pembentukanResult?.data as Record<string, unknown> | undefined;
      if (pd?.perlu_microsetting === "skip") {
        fields = fields.map((f) =>
          f.type === "quality_checklist"
            ? {
                ...f,
                items: (f.items ?? []).filter(
                  (it) => it.key !== "pemasangan_permata",
                ),
              }
            : f,
        );
      }
    }

    // ── Konfirmasi data for downstream stages ──────────────────────────────────
    let konfirmasiInfo: { tanggal_packing?: string; nomor_resi?: string } | null = null;
    if (stage === "packing" || stage === "pengiriman") {
      const { data: konfirmasiResult } = await admin
        .from("stage_history")
        .select("data")
        .eq("order_id", orderId)
        .eq("stage", "konfirmasi")
        .order("attempt_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (konfirmasiResult?.data) {
        const kd = konfirmasiResult.data as Record<string, unknown>;
        konfirmasiInfo = {
          tanggal_packing: (kd.tanggal_packing as string) || undefined,
          nomor_resi: (kd.nomor_resi as string) || undefined,
        };
      }
    }

    const workerGroups = ["production", "operational"];
    const canSubmit =
      permissions.can_insert ??
      workerGroups.includes(roleGroup) ??
      roleGroup === "management";
    const canEdit = canSubmit || (permissions.can_update ?? false);

    const workOrder = {
      deadline: order.deadline,
      customer_name: order.customer_name,
      customer_wa: order.customer_wa ?? null,
      customer_email: order.customer_email ?? null,
      produk_nama: produk?.nama ?? null,
      produk_sku: produk?.sku ?? null,
      produk_spesifikasi: produk?.spesifikasi ?? null,
      catatan: order.catatan ?? null,
      acara: order.acara ?? null,
      kebutuhan_acara: order.kebutuhan_acara ?? null,
      kategori: order.kategori ?? null,
      transfer_ke_bank: order.transfer_ke_bank ?? null,
      jenis_cincin_features: order.jenis_cincin_features ?? null,
      dari_artis_detail: order.dari_artis_detail ?? null,
      alat_ukur: order.alat_ukur ?? null,
      gramasi_pria: order.gramasi_pria ?? null,
      gramasi_wanita: order.gramasi_wanita ?? null,
      ukiran_cincin_pria: order.ukiran_cincin_pria ?? null,
      ukiran_cincin_wanita: order.ukiran_cincin_wanita ?? null,
      harga: order.harga ?? null,
      dp_amount: order.dp_amount ?? null,
      pengiriman: order.pengiriman ?? null,
      alamat_pengiriman: order.alamat_pengiriman ?? null,
      box: order.box ?? null,
      font: order.font ?? null,
      laser_position: order.laser_position ?? null,
      pria: {
        ukuran: order.ukuran_pria ?? null,
        ukiran: order.ukiran_pria ?? null,
        jenis_cincin: order.jenis_cincin_pria ?? null,
        model_bentuk: order.model_bentuk_pria ?? null,
        microsetting: order.microsetting_pria ?? null,
        detail_laser: order.detail_laser_pria ?? null,
        detail_finishing: order.detail_finishing_pria ?? null,
        keterangan: order.keterangan_pria ?? null,
        reference_image_url: order.reference_image_pria_url ?? null,
      },
      wanita: {
        ukuran: order.ukuran_wanita ?? null,
        ukiran: order.ukiran_wanita ?? null,
        jenis_cincin: order.jenis_cincin_wanita ?? null,
        model_bentuk: order.model_bentuk_wanita ?? null,
        microsetting: order.microsetting_wanita ?? null,
        detail_laser: order.detail_laser_wanita ?? null,
        detail_finishing: order.detail_finishing_wanita ?? null,
        keterangan: order.keterangan_wanita ?? null,
        reference_image_url: order.reference_image_wanita_url ?? null,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        config: {
          stage,
          stage_type: stageConfig?.stageType ?? "done",
          stage_label: stageConfig?.label ?? stage,
          order_number: order.order_number,
          product_name: order.customer_name,
          fields,
          permissions: { can_submit: canSubmit, can_edit: canEdit },
          current_data: {
            ...(perluMicrosettingDefault
              ? { perlu_microsetting: perluMicrosettingDefault }
              : {}),
            ...(lastResult?.data ?? {}),
          },
          work_order: workOrder,
          konfirmasi_info: konfirmasiInfo,
        },
        user: { name: userData.full_name, role: roleName },
      },
    });
  } catch (error) {
    console.error("[Form Config] Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
