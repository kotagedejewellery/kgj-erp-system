# Kontrak Lock Approval SPV CS: Yii2

## Tujuan

Setelah Main-ERP menyetujui intake SPV CS untuk brand MP, Yii2 mengunci seluruh perubahan manual data order. Lock tidak mengubah `id_status`, stage, atau proses produksi.

## Terima lock dari Main-ERP

Tambahkan endpoint Yii2 `POST /api/order-lock/spv-approval` dengan header `X-API-Key` yang sama seperti endpoint `POST /api/order-sync/webhook`.

```json
{
  "event": "spv_cs_approved_lock",
  "order_id": 123,
  "kode_order": "MPM09265377",
  "approved_at": "2026-10-07T07:30:00.000Z"
}
```

Validasi bahwa `order_id` dan `kode_order` menunjuk order yang sama. Endpoint harus idempoten: penerimaan ulang untuk order yang telah locked tetap sukses dan tidak boleh mengubah `approved_at` awal.

Simpan minimal `spv_cs_approved_at` pada order. Tampilkan informasi bahwa order telah disetujui SPV CS dan seluruh form/tombol edit dinonaktifkan.

## Guard server Yii2

Saat `spv_cs_approved_at` terisi, seluruh endpoint/controller mutasi manual harus menolak perubahan, termasuk detail order, catatan, harga/appraisal, pembayaran, DP, dan perubahan status dari dashboard Yii2.

Endpoint `POST /api/order-sync/webhook` yang hanya menerima integrasi Main-ERP tetap diizinkan memperbarui `id_status` atau data tracking. Batasi payload dan controller endpoint tersebut agar tidak dapat mengubah harga, pembayaran, alamat, maupun detail order.

Tidak ada bypass admin umum dan tidak ada perubahan stage baru. Rework hanya tersedia sebelum approval SPV CS; membuka kembali order approved kelak memerlukan event unlock khusus dari Main-ERP.
