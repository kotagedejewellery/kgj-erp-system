# Kontrak Inventory Yii2 ↔ Main-ERP v2

Status: **ditunda setelah MVP**. Kontrak ini menggantikan v1 bila integrasi
snapshot lintas sistem diperlukan; ia bukan prasyarat implementasi MVP.

Kontrak ini additive dan terpisah dari `order-sync` legacy. Ia tidak mengubah
stage key, status Yii2, maupun payload integrasi lama.

## Kepemilikan data

Yii2 mengirim fakta order: identitas, brand, pembatalan, komponen, bahan,
ukuran, berat appraisal, dan referensi produk katalog bila ada. Nilai tersebut
menjadi snapshot ber-version dan di-hash.

Main-ERP memilih dan menyimpan `fulfillment_plan` untuk snapshot tertentu:

| Sumber | Data wajib di Main-ERP | Saat issue |
| --- | --- | --- |
| `custom_material` | mapping material dan kebutuhan WIP | material gudang → WIP order |
| `finished_good` | `stock_unit_id` yang cocok dan available | unit cincin jadi → allocated to order |

SVP Operational memilih plan sebelum approval. `id_produk` atau
`source_product_id` adalah fakta/referensi katalog; keduanya tidak menentukan
`fulfillment_source`. Snapshot Yii2 yang lebih baru membatalkan plan yang
belum di-issue dan meminta SVP memilih ulang.

## Otentikasi

Gunakan secret inventory khusus, terpisah dari Warranty serta `order-sync`.
Setiap request memakai `X-Inventory-Key-Id`, `X-Inventory-Timestamp`, dan
`X-Inventory-Signature`; signature adalah HMAC SHA-256 atas:

```text
HTTP_METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + SHA256(RAW_BODY)
```

Timestamp lebih dari lima menit ditolak. Credential hanya backend-to-backend.

## Snapshot event: Yii2 → Main-ERP

`POST /api/inventory/v2/events`

Yii2 menulis outbox pada transaksi yang sama dengan perubahan komponen, bahan,
ukuran, berat appraisal, referensi produk, atau pembatalan. Retry memakai
`event_id` dan body identik.

```json
{
  "schema_version": 2,
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
    "source_product_id": "99",
    "order_state": "active",
    "cancelled_at": null
  },
  "requirements": [
    {
      "source_component_id": "901",
      "component_ref": "pria",
      "gender": "pria",
      "source_material_id": "28",
      "ring_size": "17",
      "appraised_weight_grams": "8.250"
    }
  ]
}
```

`source_component_id` adalah `order_komponen.id`, integer positif kanonik dan
unik dalam snapshot. `source_product_id` boleh `null`; bila ada, ia hanya
referensi katalog. Main-ERP menerima event sekali berdasarkan `(source,
event_id)`, hanya memproyeksikan version lebih baru, dan menolak version sama
dengan hash berbeda.

## Snapshot hash

`snapshot.hash` adalah SHA-256 hex dari JCS (RFC 8785) atas
`snapshot_content` berikut. Requirement diurutkan menaik berdasarkan nilai
numerik `source_component_id`. `appraised_weight_grams` wajib berupa gram
positif dalam string decimal kanonik dengan tepat tiga digit pecahan, misalnya
`"8.250"`; bentuk `"8.25"`, `"08.250"`, `"8.2500"`, dan `"0.000"` ditolak
sebelum hash dibuat.

```json
{
  "order_source_id": "12345",
  "brand_id": 1,
  "order_state": "active",
  "cancelled_at": null,
  "source_product_id": null,
  "requirements": []
}
```

`order_state` bernilai `active` atau `cancelled`. Saat active,
`cancelled_at` harus `null`; saat cancelled, wajib timestamp UTC ISO-8601.
Tidak ada `fulfillment_source`, `stock_unit_id`, maupun keputusan Main-ERP
dalam hash Yii2.

### Vector JCS wajib

**Vector A — active order**

```json
{"brand_id":1,"cancelled_at":null,"order_source_id":"12345","order_state":"active","requirements":[{"appraised_weight_grams":"8.250","component_ref":"pria","gender":"pria","ring_size":"17","source_component_id":"2","source_material_id":"28"},{"appraised_weight_grams":"4.500","component_ref":"wanita","gender":"wanita","ring_size":"15","source_component_id":"10","source_material_id":"29"}],"source_product_id":null}
```

```text
SHA-256: ca0fdc54af45d8ca438465d16a522dca24eb832c32b670d34c506bad65ac2900
```

**Vector B — cancelled order**

```json
{"brand_id":1,"cancelled_at":"2026-11-02T10:15:00.000Z","order_source_id":"12345","order_state":"cancelled","requirements":[],"source_product_id":null}
```

```text
SHA-256: dce457e2399f8214996504a3377b437b35f985e3de5294f3c169c71f254877b8
```

**Vector C — katalog dengan fakta material**

```json
{"brand_id":1,"cancelled_at":null,"order_source_id":"12345","order_state":"active","requirements":[{"appraised_weight_grams":"8.250","component_ref":"pria","gender":"pria","ring_size":"17","source_component_id":"901","source_material_id":"28"}],"source_product_id":"99"}
```

```text
SHA-256: 7d4fd0c5e46409cca829b674e860d97f0d3703f1c608a85ebb10fdd1515ceaad
```

PHP Yii2 dan TypeScript Main-ERP wajib lulus ketiga vector ini sebelum outbox
atau lock v2 diaktifkan.

## Preflight Yii2 sebelum freeze

Yii2 menjalankan laporan read-only untuk kandidat satu brand sejak tanggal
cutover:

```text
yii inventory/preflight <brandId> <fromDate YYYY-MM-DD>
```

Laporan mencatat kandidat `eligible` dan exception, minimal
`multiple_components_per_gender` atau `missing_appraisal_weight`. Preflight atau
snapshot builder boleh mengubah `8.25` menjadi `8.250` hanya dengan padding nol;
nilai yang membutuhkan pembulatan atau tidak valid harus menjadi exception.
Hasher menerima hanya payload yang sudah kanonik dan tidak melakukan normalisasi.

Laporan berbasis tanggal adalah bukti readiness. Saat cutover diaktifkan, aturan
eligibility runtime tetap harus memakai konfigurasi Main-ERP `cutover_at` lengkap
dengan zona waktu `Asia/Jakarta`, misalnya `2026-11-10 09:00:00 WIB`. Nilai ini
tidak masuk payload maupun hash Yii2, agar order legacy pada hari yang sama tidak
ikut diproses. Main-ERP membandingkannya dengan waktu aksi
`approval_penerimaan_order → racik_bahan` yang dilakukan di Main-ERP, bukan
waktu order dibuat atau snapshot diterima.

## Fulfillment plan: Main-ERP internal

Sebelum approval stage `approval_penerimaan_order → racik_bahan`, Main-ERP
menyimpan plan durable yang mengikat `order_id`, `snapshot_version`,
`snapshot_hash`, `fulfillment_source`, actor SVP, dan waktu pemilihan.

`finished_good` wajib juga menyimpan `stock_unit_id`; `custom_material` tidak
boleh menyimpan unit produk jadi. Plan hanya valid untuk snapshot yang diikatnya
dan divalidasi lagi dalam transaksi `approve-and-issue`.

Approval hanya boleh memakai snapshot `active`. Untuk `finished_good`, Main-ERP
memvalidasi bahwa stock unit cocok dengan referensi produk, ukuran, bahan/kadar,
serta pool/lokasi yang dipilih pilot. Bila snapshot tidak memiliki referensi
produk yang diperlukan, SVP harus memilih `custom_material` atau memasukkan
order ke exception queue; sistem tidak boleh menebak unit cincin jadi.

Custom pilot hanya eligible bila untuk setiap gender yang tercantum pada order
terdapat tepat satu komponen material tersimpan, berat appraisalnya tersedia
dan positif, mapping material tersedia, serta formula waste tersedia.
Ready-stock pilot hanya eligible bila fulfillment plan memilih tepat satu
`stock_unit`; order pasangan atau multi-unit masuk exception sampai model
mendukung lebih dari satu unit.

## Keputusan sumber data yang wajib sebelum freeze

Yii2 menyimpan berat appraisal per gender, sedangkan requirement diidentifikasi
oleh `source_component_id`. Komponen material pilot adalah row `order_komponen`
yang masih tersimpan dan memiliki `id_jenis_bahan`; ia tidak memiliki status
atau soft-delete sendiri. Pilot harus membuktikan tepat satu komponen material
untuk setiap gender yang tercantum pada order. Jika tidak, Yii2 harus mengirim
berat appraisal per
komponen; Main-ERP tidak boleh membagi atau menebak berat. Untuk custom,
auto-issue menggunakan bahan, berat appraisal per gender, mapping material,
dan formula waste—bukan `order_komponen.jumlah`.

## Production lock dan reconciliation

Endpoint lock v2 memakai path `/v2/`: acquire, renew, issue-intent, release,
finalize, dan `GET /api/inventory/v2/issue-requests/{issue_request_id}`.
Seluruh command mengikat `request_id`, `order_id`, `snapshot_version`,
`snapshot_hash`, `actor_id`, serta `lock_id`/`issue_request_id` bila relevan.

State Yii2 tetap `unlocked → leased → issue_committing → finalized`.
`issue_committing` tetap fail-closed sampai Main-ERP membuktikan request
`committed` atau `aborted` secara durable. Lock Yii2 membekukan fakta snapshot:
komponen, bahan, ukuran, gender, dan berat appraisal. Pembayaran tetap
editable; Yii2 tidak menyimpan fulfillment plan.

## Acceptance gate

Sebelum pilot, kedua tim membuktikan hash parity, snapshot stale, approve
ganda, timeout acquire/intent/finalize/release, issue ganda, cancel, stock
kurang, stock unit ganda, return, scrap, serta reconciliation setelah network
partition. Exception queue menyimpan alasan deterministik
`multiple_components_per_gender`, `missing_appraisal_weight`,
`material_mapping_missing`, atau `formula_missing`. Pemetaan satu berat per
gender yang tercantum ke satu komponen material harus terbukti sebelum freeze.
Snapshot `cancelled` hanya berasal dari
pembatalan bisnis eksplisit; legacy delete tetap reconciliation. Order historis
tidak boleh diproses otomatis.
