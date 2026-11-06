# Kontrak Referensi Katalog Yii2 → Main-ERP v1

Status: **implemented, pending connection UAT**. Kontrak ini hanya mengaktifkan
referensi katalog read-only; tidak mengubah flow order.

## Tujuan dan batasan

Yii2 mengirim snapshot penuh katalog sebagai referensi read-only agar Inventory
Main-ERP dapat menampilkan dan memilih model produk. Snapshot tidak membuat
stok, tidak mengubah order/stage/approval/rework/pembayaran, dan tidak memakai
`order-sync` maupun callback status legacy.

Yii2 tetap pemilik produk, kategori, SKU, status publish, dan cover katalog.
Main-ERP tetap pemilik unit cincin fisik, bahan, saldo, WIP, mutasi, dan audit.

## Transport

Endpoint yang diusulkan di Yii2:

```text
GET /api/inventory-catalog
```

Endpoint hanya dapat dipanggil backend Main-ERP dengan credential katalog
khusus. MVP memakai full snapshot melalui tombol manual **Perbarui Katalog**
di Main-ERP; tidak ada `updated_since`, scheduler, atau webhook katalog.

Main-ERP menyimpan konfigurasi server-only berikut (nilai secret tidak boleh
masuk git atau tampil pada UI):

```text
YII_CATALOG_BASE_URL=https://<domain-yii2>
YII_CATALOG_SYNC_KEY=<secret-katalog-yang-sama>
```

Tombol hanya membaca snapshot lalu memperbarui tabel referensi katalog. Bila
Yii2 tidak dapat dihubungi atau payload tidak valid, referensi lama tetap
digunakan dan tidak ada stok, order, atau mutasi yang berubah.

## Payload v1

```json
{
  "contract_version": 1,
  "source_system": "yii2",
  "snapshot_at": "2026-11-05T10:00:00+07:00",
  "categories": [
    {
      "source_category_id": 7,
      "name": "Cincin Palladium",
      "image_url": null
    }
  ],
  "products": [
    {
      "source_product_id": 123,
      "sku": "S-02",
      "name": "Cincin Palladium S-02",
      "is_published": true,
      "legacy_primary_category_id": 7,
      "category_ids": [7, 12],
      "cover_image_url": null
    }
  ]
}
```

`cover_image_url` berasal dari foto cover aktif `produk_foto`, bukan
`produk.id_file`, karena field tersebut dapat menunjuk file model 3D.
`legacy_primary_category_id` dan `category_ids` harus dikirim terpisah;
Main-ERP memakai `category_ids` untuk filter dan tidak menebak salah satunya.

## Validasi penerima

- `contract_version` harus `1` dan `source_system` harus `yii2`.
- ID kategori dan produk harus integer positif serta unik di dalam snapshot.
- `name` wajib; `sku`, `image_url`, dan `cover_image_url` boleh `null`.
- `category_ids` boleh kosong dan tidak harus sama dengan kategori legacy utama.
- Produk tanpa cover tetap valid.
- Snapshot gagal divalidasi tidak boleh memperbarui referensi katalog lama.

## Aturan pemrosesan Main-ERP

- Upsert memakai `(source_system, source_product_id)`, bukan SKU.
- Setelah full snapshot lengkap diterima, produk yang tidak lagi dikirim atau
  tidak publish hanya ditandai `source_unavailable`/`unpublished`.
- Unit stok, mutasi, retur, dan audit yang merujuk produk tidak pernah dihapus.
- Main-ERP menyimpan snapshot tampilan nama/SKU/gambar saat unit fisik dibuat.
- Kode spreadsheet seperti `S-02` dipetakan manual ke produk Yii2; nama atau
  SKU tidak boleh dipakai untuk menebak mapping.

## UAT kontrak

Yii2 dan Main-ERP memverifikasi fixture v1, termasuk produk multi-kategori,
produk unpublished, produk tanpa cover, dan perubahan cover. Sync hanya boleh
menampilkan referensi katalog pada form Ready-stock; tidak boleh membuat unit,
mutasi, issue, callback status, atau perubahan order.
