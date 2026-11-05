# Inventory Pilot Sign-off

Status: **ditunda setelah MVP**. Dokumen ini adalah catatan keputusan untuk
fase integrasi snapshot v2, bukan prasyarat implementasi runtime inventory MVP.

## Scope pilot

| Keputusan | Nilai | Owner | Persetujuan |
| --- | --- | --- | --- |
| Brand pilot dan ID Yii2 | _belum diisi_ | Product owner | _belum diisi_ |
| Gudang dan lokasi WIP | _belum diisi_ | Operasional | _belum diisi_ |
| Pool material | _belum diisi_ | Operasional/FAT | _belum diisi_ |
| Kategori material | _belum diisi_ | Produksi | _belum diisi_ |
| `cutover_at` Main-ERP | _belum diisi_ | Product owner | Asia/Jakarta |
| PIC approval issue | _belum diisi_ | Operasional | _belum diisi_ |
| PIC exception/reconciliation | _belum diisi_ | Operasional | _belum diisi_ |
| Role/permission existing yang dipakai | _belum diisi_ | Superadmin/Operasional | _belum diisi_ |

Hanya aksi `approval_penerimaan_order → racik_bahan` pada atau setelah
`cutover_at` yang dapat memakai inventory pilot.

Sebelum sign-off disetujui, dokumen ini adalah satu-satunya sumber keputusan
pilot. `cutover_at` tidak boleh disimpan di Yii2, `.env`, atau dimasukkan manual
ke command runtime. Setelah sign-off selesai, Main-ERP membuat tepat satu record
konfigurasi pilot ter-audit dari nilai yang disetujui. Tidak perlu membuat tabel
atau menu konfigurasi sebelum persetujuan tersebut ada.

## Bukti readiness

| Bukti | Referensi/hasil | Diverifikasi oleh | Status |
| --- | --- | --- | --- |
| Preflight Yii2 `yii inventory/preflight <brandId> <fromDate>` | _belum diisi_ | Yii2/Product owner | _belum diisi_ |
| Seluruh exception preflight tercatat dan memiliki keputusan | _belum diisi_ | PIC exception | _belum diisi_ |
| Mapping `id_jenis_bahan` ke material Main-ERP | _belum diisi_ | Produksi/Operasional | _belum diisi_ |
| Formula waste per material | _belum diisi_ | Produksi/FAT | _belum diisi_ |
| Saldo awal per material dan lokasi direkonsiliasi fisik | _belum diisi_ | Operasional/FAT | _belum diisi_ |
| Daftar `stock_unit` ready-stock tervalidasi | _belum diisi_ | Operasional | _belum diisi_ |
| Vector A–C Yii2 | revision/commit Yii2: _belum diisi_; hasil test: _belum diisi_ | Engineering Yii2 | _belum diisi_ |
| Vector A–C Main-ERP | revision/commit Main-ERP: _belum diisi_; hasil test: _belum diisi_ | Engineering Main-ERP | _belum diisi_ |
| Eksekusi preflight Yii2 | `brandId`: _belum diisi_; `fromDate`: _belum diisi_; waktu: _belum diisi_ | Engineering Yii2 | _belum diisi_ |
| Laporan preflight Yii2 | lampiran/lokasi: _belum diisi_; SHA-256: _belum diisi_ | Product owner | _belum diisi_ |
| Kontrak v2 yang dibekukan | versi/revisi: _belum diisi_; SHA-256 dokumen: _belum diisi_ | Engineering kedua sistem | _belum diisi_ |

## Keputusan freeze

Kontrak `yii2-inventory-v2` hanya berstatus **frozen** setelah seluruh nilai dan
bukti di atas terisi serta disetujui Product owner, Operasional, dan FAT.
Sebelum itu, sistem legacy tetap berjalan tanpa outbox, production lock,
migration inventory, maupun mutasi stok pilot.

## Invariant konfigurasi runtime

Saat runtime inventory nanti dibuat, satu record konfigurasi pilot harus menyimpan
referensi sign-off ini dan SHA-256 dokumen sign-off. Setelah `cutover_at` aktif,
scope pilot serta `cutover_at` tidak dapat diedit. Perubahan apa pun memerlukan
sign-off baru dan record konfigurasi pilot baru; sistem tidak boleh mengubah
record yang sudah aktif.

| Peran | Nama | Tanggal | Persetujuan |
| --- | --- | --- | --- |
| Product owner | _belum diisi_ | _belum diisi_ | _belum diisi_ |
| SVP Operational | _belum diisi_ | _belum diisi_ | _belum diisi_ |
| FAT/Keuangan | _belum diisi_ | _belum diisi_ | _belum diisi_ |
| Engineering Main-ERP | _belum diisi_ | _belum diisi_ | _belum diisi_ |
| Engineering Yii2 | _belum diisi_ | _belum diisi_ | _belum diisi_ |
