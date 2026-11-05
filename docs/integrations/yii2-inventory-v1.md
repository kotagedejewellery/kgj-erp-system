# Kontrak Inventory Yii2 ↔ Main-ERP v1

Status: **arsip integrasi yang ditunda**. Dokumen ini tidak dipakai untuk MVP
atau implementasi baru tanpa keputusan eksplisit fase integrasi lintas sistem.

Kontrak ini additive dan terpisah dari `order-sync` legacy. Ia tidak mengubah
stage key, status Yii2, ataupun payload order-sync yang sudah ada.

## Otentikasi

Gunakan secret inventory khusus, berbeda dari secret Warranty dan order-sync.
Secret tidak boleh disimpan pada `params-local.php` atau file konfigurasi lain
yang terlacak Git. Yii2 membaca secret dari konfigurasi lokal yang di-ignore
atau environment deployment server-only; Main-ERP membacanya dari secret
environment deployment.

| Arah | Key ID | Secret penerima |
| --- | --- | --- |
| Yii2 → Main-ERP | `yii2` | `INVENTORY_YII2_SECRET` |
| Main-ERP → Yii2 | `main-erp` | `INVENTORY_MAIN_ERP_SECRET` |

Setiap request memakai header `X-Inventory-Key-Id`, `X-Inventory-Timestamp`,
dan `X-Inventory-Signature`. Signature adalah HMAC SHA-256 dari:

```text
HTTP_METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + SHA256(RAW_BODY)
```

Timestamp lebih dari lima menit dari waktu penerima ditolak. Credential hanya
boleh dipakai backend; browser tidak menerima secret atau memanggil command
integrasi langsung.

## Event snapshot: Yii2 → Main-ERP

`POST /api/inventory/v1/events`

Yii2 menulis event pada outbox dalam transaksi yang sama dengan perubahan
komponen, bahan, ukuran, berat appraisal, sumber pemenuhan, atau pembatalan.
Pengiriman retry menggunakan `event_id` dan payload yang identik.

```json
{
  "schema_version": 1,
  "event_id": "uuid",
  "event_type": "inventory_order_snapshot",
  "occurred_at": "2026-11-02T10:15:00.000Z",
  "order": {
    "source": "yii2",
    "source_id": "12345",
    "reference": "KGJ-12345",
    "brand_id": 1
  },
  "snapshot": {
    "version": 7,
    "hash": "sha256-hex",
    "fulfillment_source": "custom_material",
    "source_product_id": null,
    "order_state": "active",
    "cancelled_at": null
  },
  "requirements": [
    {
      "component_ref": "pria",
      "source_component_id": "901",
      "gender": "pria",
      "source_material_id": "28",
      "ring_size": "17",
      "appraised_weight_grams": "8.250"
    }
  ]
}
```

`fulfillment_source` bernilai `custom_material` atau `finished_good`.
Setiap requirement custom wajib mempunyai `source_component_id` stabil dari
`order_komponen`; `component_ref` hanya label tampilan dan tidak boleh menjadi
identitas. Snapshot `finished_good` wajib membawa `source_product_id` pada
`snapshot`, walaupun `requirements` kosong. Finished good tidak membawa
kebutuhan material untuk issue; Main-ERP memilih `stock_unit` secara eksplisit
sebelum approval. Main-ERP menerima event sekali berdasarkan `(source,
event_id)` dan hanya memproyeksikan `snapshot.version` yang lebih baru. Versi
sama dengan hash berbeda adalah konflik.

Untuk `custom_material`, `source_product_id` boleh `null` atau berisi referensi
model katalog asal. Bila ada, ia hanya metadata desain dan tidak pernah
mengubah sumber issue menjadi produk jadi; sumber issue tetap ditentukan
eksklusif oleh `fulfillment_source`.

`source_component_id = order_komponen.id` telah diverifikasi oleh Yii2 sebagai
primary key ActiveRecord yang berelasi ke `id_order`. Verifikasi schema staging
aktif tetap menjadi acceptance gate deployment.

### Snapshot hash

`snapshot.hash` adalah SHA-256 hex dari representasi JSON Canonicalization
Scheme (JCS, RFC 8785) atas objek `snapshot_content` berikut, bukan atas raw
body event:

```json
{
  "order_source_id": "12345",
  "brand_id": 1,
  "order_state": "active",
  "cancelled_at": null,
  "fulfillment_source": "custom_material",
  "source_product_id": null,
  "requirements": []
}
```

`requirements` harus diurutkan menaik menurut nilai numerik
`source_component_id` sebelum JCS diterapkan. Berat dikirim sebagai string
decimal dan tidak diubah menjadi float. `order_state` bernilai `active` atau
`cancelled`; `cancelled_at` wajib ISO-8601 UTC saat cancelled dan `null` saat
active. Yii2 dan Main-ERP wajib memakai objek/field yang sama ini ketika
menghitung hash; perubahan isi bisnis selalu menghasilkan hash baru.

`source_component_id` harus integer positif kanonik (`1`, `2`, dan seterusnya),
bukan `0`, negatif, atau memiliki nol awal seperti `002`; satu snapshot tidak
boleh memuat ID komponen yang sama dua kali. `finished_good` wajib memiliki
`source_product_id` non-kosong dan requirements kosong. `custom_material` boleh
memiliki referensi katalog seperti dijelaskan di atas, tetapi tidak boleh
ditafsirkan sebagai finished good.

### Test vector JCS wajib

Kedua codebase wajib memiliki test yang menghasilkan canonical JSON dan SHA-256
berikut. Tidak boleh memakai `json_encode()` atau `JSON.stringify()` biasa
tanpa implementasi JCS dan pengurutan requirement di atas.

**Vector A — active custom**

```json
{"brand_id":1,"cancelled_at":null,"fulfillment_source":"custom_material","order_source_id":"12345","order_state":"active","requirements":[{"appraised_weight_grams":"8.250","component_ref":"pria","gender":"pria","ring_size":"17","source_component_id":"2","source_material_id":"28"},{"appraised_weight_grams":"4.500","component_ref":"wanita","gender":"wanita","ring_size":"15","source_component_id":"10","source_material_id":"29"}],"source_product_id":null}
```

```text
SHA-256: 80bafb17d43c4186c22f03d5994b415d4a4b22a82c3077f6cf77a13fadacce33
```

**Vector B — cancelled custom**

```json
{"brand_id":1,"cancelled_at":"2026-11-02T10:15:00.000Z","fulfillment_source":"custom_material","order_source_id":"12345","order_state":"cancelled","requirements":[],"source_product_id":null}
```

```text
SHA-256: 2ef3e691df790c866a5c5bd6438ad7e40c7f827889e2da698464b405b490d53c
```

## Production lock: Main-ERP → Yii2

`request_id` dan `actor_id` wajib pada seluruh command. Field lain wajib
sesuai command berikut.

| Command | Endpoint | Field wajib | Hasil utama |
| --- | --- | --- | --- |
| Acquire lease | `POST /api/inventory/v1/production-locks/acquire` | `request_id`, `order_id`, `snapshot_version`, `snapshot_hash`, `actor_id` | `lock_id`, snapshot, `expires_at` atau `409 stale_snapshot` |
| Renew lease | `POST /api/inventory/v1/production-locks/{lock_id}/renew` | `request_id`, `lock_id`, `actor_id` | lease baru; hanya state `leased` |
| Mark issue intent | `POST /api/inventory/v1/production-locks/{lock_id}/issue-intent` | `request_id`, `issue_request_id`, `order_id`, `lock_id`, `snapshot_version`, `snapshot_hash`, `actor_id` | state `issue_committing` |
| Release lock | `POST /api/inventory/v1/production-locks/{lock_id}/release` | `request_id`, `issue_request_id`, `order_id`, `lock_id`, `actor_id` | state `released`; hanya request `aborted` |
| Finalize lock | `POST /api/inventory/v1/production-locks/{lock_id}/finalize` | `request_id`, `issue_request_id`, `order_id`, `lock_id`, `snapshot_version`, `snapshot_hash`, `actor_id`, `issue_receipt` | state `finalized`, issue receipt |

`issue_request_id` sudah dibuat dan disimpan durable oleh Main-ERP sebelum
`mark-issue-intent`.

Yii2 lock state: `unlocked → leased → issue_committing → finalized`.
`leased` dapat kadaluarsa. `issue_committing` tidak dapat kadaluarsa menjadi
editable dan hanya dapat final/release melalui reconciliation. Yii2 memblok
perubahan komponen/material, bahan, ukuran, gender, berat appraisal, dan sumber
pemenuhan saat state `leased`, `issue_committing`, atau `finalized`; pembayaran
tetap editable.

## Reconciliation: Yii2 → Main-ERP

`GET /api/inventory/v1/issue-requests/{issue_request_id}`

Main-ERP mengembalikan salah satu status durable berikut:

```json
{ "issue_request_id": "uuid", "status": "committed", "issue_receipt": "..." }
```

```json
{ "issue_request_id": "uuid", "status": "aborted", "reason": "stok_tidak_cukup" }
```

```json
{ "issue_request_id": "uuid", "status": "processing" }
```

Yii2 boleh release hanya untuk `aborted`. Timeout, `not_found`, atau
`processing` wajib tetap fail-closed dan menimbulkan alert/retry.

## Idempotensi dan respons

- Request ID yang sama dan hash body yang sama mengembalikan receipt pertama.
- Request ID yang sama dan hash body berbeda mengembalikan `409 idempotency_conflict`.
- Snapshot stale mengembalikan `409 stale_snapshot` tanpa lock atau mutation.
- Identitas order yang tidak cocok mengembalikan `422 order_identity_mismatch`.
- Respons autentikasi gagal adalah `401` tanpa detail secret.

## Acceptance test jaringan

Sebelum pilot, kedua tim membuktikan: retry event snapshot, snapshot stale,
approve ganda, timeout setelah acquire, timeout setelah issue intent, issue
lokal gagal, finalize/release gagal, reconnect reconciliation, legacy delete,
ready-stock unit ganda, material kurang, return, dan scrap.
