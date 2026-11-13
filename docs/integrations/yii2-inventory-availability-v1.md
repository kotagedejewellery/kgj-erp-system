# Ketersediaan Inventory Main-ERP → Yii2 v1

Status: **implemented, pending Yii2 connection UAT**.

Yii2 dapat menampilkan ketersediaan stok sebagai informasi baca-saja. Main-ERP
tetap satu-satunya pemilik saldo, unit fisik, alokasi, dan mutasi inventory.
Respons tidak membuat reservasi dan tidak menjamin stok masih tersedia ketika
approval dilakukan.

## Endpoint

```text
GET /api/integrations/inventory-availability
Header: X-Inventory-Read-Key: <secret-khusus>
```

Konfigurasi Main-ERP bersifat server-only:

```text
YII_INVENTORY_READ_KEY=<secret-khusus-untuk-ketersediaan>
```

Endpoint fail-closed: tanpa key atau key salah, responsnya `401`. Secret ini
berbeda dari secret webhook order, status callback, dan katalog.

## Respons

Tanpa parameter, respons memberi ringkasan bahan gudang dan kelompok
ready-stock yang tersedia. Tidak ada ID unit fisik pada respons.

Dengan parameter berikut, respons juga memberi kecukupan untuk satu order Yii2
yang telah tersinkron ke Main-ERP:

```text
?legacy_order_id=<id-order-Yii2>
```

Respons `order.custom` menghitung kebutuhan bahan dan susut yang berlaku di
Main-ERP; `order.readyStock` menghitung unit yang cocok berdasarkan brand,
produk katalog, bahan, dan ukuran. Yii2 hanya menampilkan hasilnya dan tidak
menentukan sumber issue.

Setiap variasi `ready_stock` juga membawa metadata filter dari inventori fisik:

```json
{
  "material_family": "perak",
  "ring_type": "pria",
  "location_label": "Gudang Hijaz"
}
```

`material_family` berasal dari master Bahan Baku, `ring_type` berasal dari
klasifikasi unit fisik (`pria`, `wanita`, atau `unisex`), dan `location_label`
berasal dari gudang unit. Nilai `null` berarti data lama belum diklasifikasikan;
Yii2 tidak boleh menebak nilainya dari nama bahan atau model.

## Batasan

- Tidak ada write, reservasi, pengurangan, retur, atau perubahan stage.
- Panggilan endpoint tidak boleh memengaruhi order, approval, rework,
  pembayaran, webhook legacy, ataupun status Yii2.
- Saat approval, Main-ERP tetap memeriksa ulang stok secara atomik; tampilan
  sebelumnya dapat berubah karena order lain disetujui lebih dahulu.
