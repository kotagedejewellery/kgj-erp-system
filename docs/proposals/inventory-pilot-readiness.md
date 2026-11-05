# Inventory Pilot Readiness

Status: **ditunda setelah MVP**. Dokumen ini hanya dipakai bila fase integrasi
snapshot lintas sistem diaktifkan; ia bukan gate untuk membangun inventory core.

## 1. Keputusan pilot

| Keputusan | Nilai yang disetujui | Owner | Bukti/rujukan |
| --- | --- | --- | --- |
| Lokasi gudang pilot | _belum diisi_ | Operasional | kode lokasi |
| Pool material | _belum diisi_ | Operasional/FAT | bersama atau terpisah brand |
| Brand pilot | _belum diisi_ | Operasional | KGJ/HJZ/MP |
| Kategori material rilis pertama | _belum diisi_ | Produksi | logam, batu, komponen lain |
| Ready-stock pilot | satu `stock_unit` per order | Operasional | pasangan/multi-unit exception |
| `cutover_at` tanggal dan jam | _belum diisi_ | Product owner | konfigurasi Main-ERP, Asia/Jakarta |
| Kriteria order eligible | _belum diisi_ | Product owner | order baru / tahap approval setelah cutover |
| PIC approval issue | _belum diisi_ | Operasional | role Main-ERP yang ada |
| PIC exception/reconciliation | _belum diisi_ | Operasional | escalation owner |
| Pembayaran setelah production lock | Editable | Product owner | keputusan v1 |
| Batas komponen material per gender | satu row dengan `id_jenis_bahan` untuk setiap gender yang tercantum | Yii2/Produksi | selain itu exception v2 |

Order historis dan order di luar kriteria eligible tetap memakai workflow legacy.
Mereka tidak boleh di-reserve, di-issue, atau di-backfill secara otomatis.
Kriteria runtime harus memakai `cutover_at` Main-ERP yang disetujui dengan zona
waktu `Asia/Jakarta`; laporan preflight Yii2 yang berbasis tanggal hanya menjadi
bukti read-only kandidat. Eligibility inventory dinilai pada waktu aksi
`approval_penerimaan_order → racik_bahan` di Main-ERP, bukan waktu pembuatan
order atau penerimaan snapshot.

## 2. Data awal yang wajib tervalidasi

### Material dan saldo gudang

Sediakan satu baris per material dan lokasi dengan kolom berikut:

```text
location_code,material_code,material_name,uom,opening_on_hand,physical_count,
verified_at,verified_by,notes
```

- Logam memakai `DECIMAL` gram, bukan float.
- `opening_on_hand` harus sama dengan `physical_count`, atau selisihnya dicatat
  dan disetujui sebelum import.
- Material tanpa kode, satuan, atau lokasi tidak boleh diimpor sebagai tersedia.

### Mapping material Yii2

Sediakan satu baris per bahan Yii2 yang akan dipakai pilot:

```text
source_system,source_material_id,source_material_label,material_code,
waste_percent,active,verified_by,notes
```

`source_system` bernilai `yii2`. Mapping yang tidak lengkap membuat order masuk
exception queue dan memblok approval issue; sistem tidak boleh menebak bahan
berdasarkan nama atau harga.

### Stock unit cincin jadi

Sediakan satu baris per cincin fisik ready-stock:

```text
unit_code,source_system,source_product_id,size,material_or_karat,
actual_weight_grams,location_code,condition,status,verified_at,verified_by
```

Nilai awal `status` hanya `available` bila seluruh identitas dan kondisi telah
diverifikasi. Baris yang belum lengkap diimpor sebagai `inspection`, bukan stok
yang dapat dialokasikan.

## 3. Formula dan kontrol operasional

Sebelum custom order dapat di-issue, dokumentasikan per material:

- formula kebutuhan dari berat appraisal;
- waste/susut yang diperbolehkan;
- komponen tambahan yang ikut dilacak atau dikecualikan pada rilis pertama;
- toleransi rekonsiliasi aktual; dan
- approver selisih di luar toleransi.

Custom pilot hanya eligible saat setiap gender yang tercantum mempunyai tepat
satu komponen material dengan `id_jenis_bahan`, berat appraisal positif dengan
tiga digit pecahan, mapping material, dan formula waste. Selain itu masuk
exception tanpa auto-issue.

## 4. Acceptance gate sebelum cutover

- [ ] Semua keputusan pilot pada bagian 1 disetujui.
- [ ] Saldo awal dan unit cincin jadi direkonsiliasi fisik.
- [ ] Mapping bahan pilot lengkap dan diuji pada sample order custom.
- [ ] Laporan `yii inventory/preflight <brandId> <fromDate>` disimpan, ditinjau, dan seluruh exception tercatat.
- [ ] Kontrak `docs/integrations/yii2-inventory-v2.md` disetujui kedua tim.
- [ ] Satu berat appraisal per gender yang tercantum telah terbukti dapat dipetakan ke satu komponen material.
- [ ] UAT issue ganda, snapshot stale, timeout, cancellation, return, dan scrap lulus.
- [ ] Tidak ada order historis yang ditandai eligible.

Tanpa seluruh gate ini, inventory core boleh dideploy tetapi cutover harus tetap
nonaktif.

Catat hasil dan persetujuan seluruh gate dalam
`docs/proposals/inventory-pilot-sign-off.md` sebelum mengubah status kontrak v2
menjadi frozen.
