# Kontrak Rework SPV CS: Yii2

## Tujuan

Rework adalah status validasi intake, bukan stage produksi. Jangan mengubah `id_status`, proses produksi, atau mapping stage ketika menerima maupun menyelesaikan rework.

## 1. Terima permintaan dari Main-ERP

Tambahkan endpoint Yii2 `POST /api/order-rework/request` dengan header `X-API-Key` yang sama seperti endpoint `POST /api/order-sync/webhook`.

Payload:

```json
{
  "event": "spv_cs_rework_requested",
  "request_id": "UUID",
  "order_id": 123,
  "kode_order": "MPM09265377",
  "reason": "Ukiran nama perlu dikoreksi.",
  "requested_at": "2026-10-05T07:30:00.000Z"
}
```

Validasi bahwa `order_id` dan `kode_order` merujuk order yang sama. Endpoint harus idempoten berdasarkan `request_id`: pengiriman ulang request yang sama tidak boleh membuat tugas ganda.

Simpan pada order yang sama (atau metadata validasi yang sudah ada):

- `spv_rework_request_id`
- `spv_rework_status` (`requested` atau `completed`)
- `spv_rework_reason`
- `spv_rework_requested_at`
- `spv_rework_completed_at`

## 2. Tampilan Yii2

Di bagian atas halaman detail/edit order, tampilkan panel selama `spv_rework_status = requested`:

> Perlu Revisi dari SPV CS
>
> Alasan: {spv_rework_reason}
>
> Dikembalikan: {spv_rework_requested_at}

Status dan stage produksi yang sudah ada tetap ditampilkan tanpa perubahan. Setelah CS memperbaiki data, sediakan tombol eksplisit **Kirim revisi ke Main-ERP**.

## 3. Kirim revisi selesai ke Main-ERP

Tombol tersebut mengirim `POST {MAIN_ERP_URL}/api/intake/rework-completed` dengan header `X-Webhook-Signature` yang memakai `INTEGRATED_SYSTEM_WEBHOOK_SECRET`.

Payload berisi snapshot order lengkap yang sama dengan webhook order Yii2 saat ini:

```json
{
  "event": "spv_cs_rework_completed",
  "request_id": "UUID dari spv_rework_request_id",
  "order": {
    "id": 123,
    "kode_order": "MPM09265377"
  }
}
```

Main-ERP akan memvalidasi kecocokan `request_id`, `id`, dan `kode_order`, memperbarui snapshot order, lalu mengembalikan intake ke antrean `pending_spv_cs_validation`. Yii2 baru boleh menandai `spv_rework_status = completed` setelah respons HTTP Main-ERP berhasil.
