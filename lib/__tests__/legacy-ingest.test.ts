import { describe, it, expect } from "vitest";
import {
  resolveIngestionStage,
  shouldAdvanceTracking,
  shouldApplyIncomingStage,
  resolveTargetStage,
} from "@/lib/legacy/ingest";
import {
  buildLegacyOrderRow,
  buildLegacyOrderUpdate,
  legacyToOrderDetail,
  legacyToOrderSummary,
  type LegacyOrderRow,
  type Yii2OrderPayload,
} from "@/lib/legacy/adapter";
import { YII2_STATUS_PELUNASAN } from "@/lib/legacy/status";
import {
  komponenLabel,
  fontLabel,
  produkKategoriLabel,
} from "@/lib/legacy/komponen-labels";

const baseOrder: Yii2OrderPayload = {
  id: 4610,
  kode_order: "KGJ07264588",
  nama: "Baskoro Kusumo",
};

describe("resolveIngestionStage", () => {
  it("advances intake stages to their approval gate", () => {
    expect(resolveIngestionStage("penerimaan_order")).toEqual({
      stage: "approval_penerimaan_order",
      status: "waiting_approval",
    });
    expect(resolveIngestionStage("qc_1")).toEqual({
      stage: "approval_qc_1",
      status: "waiting_approval",
    });
  });

  it("marks selesai as completed", () => {
    expect(resolveIngestionStage("selesai")).toEqual({
      stage: "selesai",
      status: "completed",
    });
  });

  it("keeps non-gate stages in_progress", () => {
    expect(resolveIngestionStage("laser")).toEqual({
      stage: "laser",
      status: "in_progress",
    });
  });
});

describe("shouldAdvanceTracking", () => {
  it("skips missing status", () => {
    expect(shouldAdvanceTracking(null)).toBe(false);
    expect(shouldAdvanceTracking(undefined)).toBe(false);
  });

  it("advances Pelunasan (id_status=13) to Customer Care", () => {
    expect(shouldAdvanceTracking(YII2_STATUS_PELUNASAN)).toBe(true);
  });

  it("skips unknown statuses so the fallback can never regress an order", () => {
    expect(shouldAdvanceTracking(999)).toBe(false);
  });

  it("advances for known workshop statuses", () => {
    expect(shouldAdvanceTracking(9)).toBe(true);
    expect(shouldAdvanceTracking(12)).toBe(true);
    expect(shouldAdvanceTracking(15)).toBe(true);
  });
});

describe("resolveTargetStage", () => {
  it("returns selesai only when both tgl_selesai AND id_status=15", () => {
    expect(
      resolveTargetStage({ ...baseOrder, tgl_selesai: "2026-07-15", id_status: 15 }),
    ).toBe("selesai");
  });

  it("does NOT return selesai when tgl_selesai is set but id_status is not 15", () => {
    // tgl_selesai is a deadline field set on every order — should not force completion
    expect(
      resolveTargetStage({ ...baseOrder, tgl_selesai: "2026-07-15", id_status: 12 }),
    ).toBe("pembentukan_cincin");
  });

  it("maps Pelunasan to Konfirmasi Customer Care", () => {
    expect(
      resolveTargetStage({ ...baseOrder, id_status: YII2_STATUS_PELUNASAN }),
    ).toBe("konfirmasi");
  });

  it("maps known statuses to stages", () => {
    expect(resolveTargetStage({ ...baseOrder, id_status: 12 })).toBe(
      "pembentukan_cincin",
    );
    expect(resolveTargetStage({ ...baseOrder, id_status: 46 })).toBe("packing");
  });

  it("returns null for unknown statuses", () => {
    expect(resolveTargetStage({ ...baseOrder, id_status: 999 })).toBeNull();
  });
});

describe("shouldApplyIncomingStage", () => {
  it("moves Pelunasan forward to Konfirmasi Customer Care", () => {
    expect(
      shouldApplyIncomingStage(
        "racik_bahan",
        "konfirmasi",
        YII2_STATUS_PELUNASAN,
      ),
    ).toBe(true);
  });

  it("does not let a delayed Pelunasan webhook regress a later stage", () => {
    expect(
      shouldApplyIncomingStage(
        "packing",
        "konfirmasi",
        YII2_STATUS_PELUNASAN,
      ),
    ).toBe(false);
    expect(
      shouldApplyIncomingStage(
        "pengiriman",
        "konfirmasi",
        YII2_STATUS_PELUNASAN,
      ),
    ).toBe(false);
    expect(
      shouldApplyIncomingStage(
        "selesai",
        "konfirmasi",
        YII2_STATUS_PELUNASAN,
      ),
    ).toBe(false);
  });

  it("preserves the existing behavior for other Yii2 statuses", () => {
    expect(
      shouldApplyIncomingStage("packing", "pembentukan_cincin", 12),
    ).toBe(true);
  });
});

describe("buildLegacyOrderRow", () => {
  it("carries the 8 new payload fields", () => {
    const row = buildLegacyOrderRow({
      ...baseOrder,
      jenis_acara: "Pernikahan",
      tgl_acara: "2026-08-01",
      sumber_closing: "Instagram",
      customer_hobby: "Traveling",
      customer_job: "Karyawan Swasta",
      jenis_pembayaran: "Transfer",
      jumlah_bayar: "2000000.00",
      sisa_bayar: "2000000.00",
    });

    expect(row.jenis_acara).toBe("Pernikahan");
    expect(row.tgl_acara).toBe("2026-08-01");
    expect(row.sumber_closing).toBe("Instagram");
    expect(row.customer_hobby).toBe("Traveling");
    expect(row.customer_job).toBe("Karyawan Swasta");
    expect(row.jenis_pembayaran).toBe("Transfer");
    expect(row.jumlah_bayar).toBe(2000000);
    expect(row.sisa_bayar).toBe(2000000);
  });

  it("does not crash on missing optional fields", () => {
    const row = buildLegacyOrderRow(baseOrder);
    expect(row.jenis_acara).toBeNull();
    expect(row.jumlah_bayar).toBeNull();
    expect(row.komponen).toEqual([]);
  });

  it("normalizes invalid numerics and zero-dates to null", () => {
    const row = buildLegacyOrderRow({
      ...baseOrder,
      total_harga: "abc",
      tgl_acara: "0000-00-00",
    });
    expect(row.total_harga).toBeNull();
    expect(row.tgl_acara).toBeNull();
  });
});

describe("buildLegacyOrderUpdate", () => {
  it("performs a full-field update (spec checklist item 1)", () => {
    const update = buildLegacyOrderUpdate({
      ...baseOrder,
      nama: "Nama Baru",
      email: "baru@mail.com",
      no_hp: "0812345",
      harga_final: "4000000.00",
      jenis_acara: "Lamaran",
    }) as Record<string, unknown>;

    expect(update.nama).toBe("Nama Baru");
    expect(update.email).toBe("baru@mail.com");
    expect(update.no_hp).toBe("0812345");
    expect(update.harga_final).toBe(4000000);
    expect(update.jenis_acara).toBe("Lamaran");
  });

  it("never rewrites identity fields", () => {
    const update = buildLegacyOrderUpdate(baseOrder) as Record<string, unknown>;
    expect(update).not.toHaveProperty("legacy_id");
    expect(update).not.toHaveProperty("kode_order");
  });

  it("clears deleted_at so reappearing orders are resurrected", () => {
    const update = buildLegacyOrderUpdate(baseOrder) as Record<string, unknown>;
    expect(update.deleted_at).toBeNull();
  });
});

describe("komponen-labels", () => {
  it("maps master-data IDs to labels", () => {
    expect(komponenLabel(2)).toBe("Palladium 10%");
    expect(komponenLabel(125)).toBe("Kombinasi Doff Foredom dan Glossy");
    expect(komponenLabel(14)).toBe("Swarovski Putih");
    expect(fontLabel(10)).toBe("Gabriola");
    expect(produkKategoriLabel(5)).toBe("Cincin Palladium");
  });

  it("accepts string IDs (JSONB payloads may stringify)", () => {
    expect(komponenLabel("2")).toBe("Palladium 10%");
  });

  it("returns #id for unknown IDs and null for missing", () => {
    expect(komponenLabel(99999)).toBe("#99999");
    expect(komponenLabel(null)).toBeNull();
    expect(komponenLabel(undefined)).toBeNull();
  });
});

describe("legacyToOrderDetail komponen resolution", () => {
  const row = {
    id: "uuid-1",
    legacy_id: 4610,
    kode_order: "KGJ07264588",
    no_nota: "4588",
    nama: "Baskoro",
    email: null,
    no_hp: null,
    alamat: "Jl. Sutorejo",
    alamat_lengkap: "Jl. Sutorejo Prima Utara IV",
    tgl_order: "2026-07-02",
    tgl_selesai: null,
    tgl_deadline_tukang: "2026-07-15",
    id_status: 12,
    total_harga: 4061700,
    harga_final: 4000000,
    order_down_payment: 0,
    nilai_promo: 61700,
    biaya_pengiriman: null,
    id_promo_diskon: null,
    id_produk: null,
    id_jenis_order: 1,
    berat_cincin_pria: 3.486,
    berat_cincin_wanita: 1,
    catatan: null,
    jenis_acara: "Pernikahan",
    tgl_acara: "2026-08-01",
    sumber_closing: "Instagram",
    customer_hobby: "Traveling",
    customer_job: "Karyawan Swasta",
    jenis_pembayaran: "Transfer",
    jumlah_bayar: 2000000,
    sisa_bayar: 2000000,
    komponen: [
      {
        id_gender: 1,
        ukuran: "19",
        id_produk_kategori: 5,
        id_jenis_bahan: 2,
        id_finishing: 125,
        id_microsetting: 8,
        id_laser: 11,
        id_permata: 14,
        id_ukiran: 10,
        teks: "Baskoro",
        keterangan: "Model klasik",
      },
    ],
    reference_image_pria_url: null,
    reference_image_wanita_url: null,
    id_brand: 1,
    id_proses_produksi: 3,
    proses_produksi: "Kilat",
    proses_produksi_label: "Kilat ± 8 Hari Kerja",
    last_synced_at: null,
    deleted_at: null,
    created_at: null,
  } as LegacyOrderRow;

  it("resolves komponen IDs to human-readable labels", () => {
    const detail = legacyToOrderDetail(row, null);
    expect(detail.jenis_cincin_pria).toBe("Palladium 10%");
    expect(detail.detail_finishing_pria).toEqual([
      "Kombinasi Doff Foredom dan Glossy",
    ]);
    expect(detail.microsetting_pria).toEqual(["Sesuai Model"]);
    expect(detail.detail_laser_pria).toEqual(["Laser Nama (1-15 Karakter)"]);
    expect(detail.jenis_cincin_features).toEqual(["Swarovski Putih"]);
    expect(detail.font).toBe("Gabriola");
  });

  it("builds keterangan bullets (kategori, jumlah, note)", () => {
    const detail = legacyToOrderDetail(row, null);
    expect(detail.keterangan_pria).toEqual([
      "Cincin Palladium",
      "Model klasik",
    ]);
    expect(detail.keterangan_wanita).toBeNull();
  });

  it("exposes the 8 new payload fields", () => {
    const detail = legacyToOrderDetail(row, null);
    expect(detail.acara).toBe("Pernikahan");
    expect(detail.tgl_acara).toBe("2026-08-01");
    expect(detail.sumber_media).toBe("Instagram");
    expect(detail.customer_hobby).toBe("Traveling");
    expect(detail.customer_job).toBe("Karyawan Swasta");
    expect(detail.jenis_pembayaran).toBe("Transfer");
    expect(detail.jumlah_bayar).toBe(2000000);
    expect(detail.sisa_bayar).toBe(2000000);
  });

  it("exposes proses produksi for the workshop order list", () => {
    const summary = legacyToOrderSummary(row, null);
    expect(summary.proses_produksi).toBe("Kilat");
  });

  it("prefers alamat_lengkap and exposes no_nota + deadline_tukang", () => {
    const detail = legacyToOrderDetail(row, null);
    expect(detail.alamat_pengiriman).toBe("Jl. Sutorejo Prima Utara IV");
    expect(detail.no_nota).toBe("4588");
    expect(detail.deadline_tukang).toBe("2026-07-15");
  });

  it("exposes the price breakdown (subtotal, diskon, ongkir, final)", () => {
    const detail = legacyToOrderDetail(row, null);
    expect(detail.subtotal).toBe(4061700);
    expect(detail.diskon).toBe(61700);
    expect(detail.ongkir).toBeNull();
    expect(detail.harga).toBe(4000000);
  });

  it("computes harga_final and sisa_bayar when Yii2 omits them", () => {
    const detail = legacyToOrderDetail(
      {
        ...row,
        harga_final: null,
        sisa_bayar: null,
        biaya_pengiriman: 98000,
        jumlah_bayar: 2000000,
      },
      null,
    );
    // total - promo + ongkir = 4061700 - 61700 + 98000
    expect(detail.harga).toBe(4098000);
    expect(detail.sisa_bayar).toBe(2098000);
  });

  it("keeps Yii2's sisa_bayar authoritative when present", () => {
    const detail = legacyToOrderDetail(row, null);
    expect(detail.sisa_bayar).toBe(2000000);
  });

  it("exposes produk info for product-checkout orders", () => {
    const custom = legacyToOrderDetail(row, null);
    expect(custom.produk_nama).toBeNull();
    expect(custom.jenis_order).toBe("Couple");

    const byProduk = legacyToOrderDetail({ ...row, id_produk: 785 }, null);
    expect(byProduk.produk_nama).toContain("PTD0740YG");
    expect(byProduk.produk_sku).toBe("PTD0740YG");
    expect(byProduk.produk_spesifikasi).toContain("Spesifikasi Produk");
  });

  it("falls back to Produk #id for unknown catalog entries", () => {
    const detail = legacyToOrderDetail({ ...row, id_produk: 99999 }, null);
    expect(detail.produk_nama).toBe("Produk #99999");
    expect(detail.produk_spesifikasi).toBeNull();
  });
});

describe("buildLegacyOrderUpdate price fields", () => {
  it("omits nilai_promo/biaya_pengiriman when the payload lacks them (webhook)", () => {
    const update = buildLegacyOrderUpdate(baseOrder) as Record<string, unknown>;
    expect(update).not.toHaveProperty("nilai_promo");
    expect(update).not.toHaveProperty("biaya_pengiriman");
  });

  it("carries them when present (pull sync)", () => {
    const update = buildLegacyOrderUpdate({
      ...baseOrder,
      nilai_promo: "61700.00",
      biaya_pengiriman: "98000.00",
    }) as Record<string, unknown>;
    expect(update.nilai_promo).toBe(61700);
    expect(update.biaya_pengiriman).toBe(98000);
  });
});
