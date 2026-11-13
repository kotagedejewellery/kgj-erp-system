# Glossary

## Material balance

Jumlah material tersedia pada satu lokasi. Saldo berubah hanya melalui mutasi
inventory yang dicatat di Main-ERP.

## Material family

Kelompok bahan utama yang ditetapkan pada master Bahan Baku, misalnya Perak
atau Palladium. Ini hanya metadata filter baca-saja untuk Ketersediaan Stok
Yii2; bukan kadar, saldo, maupun harga.

## Stock unit

Satu cincin jadi fisik yang dapat dialokasikan paling banyak kepada satu order.

## Ring classification

Penanda fisik ready-stock untuk Pria, Wanita, atau Unisex. Stok historis yang
belum diperiksa memakai nilai Belum diklasifikasikan dan tidak diartikan sebagai
Unisex.

## WIP

Bahan yang telah dikeluarkan dari gudang untuk order produksi, tetapi belum
menjadi produk selesai.

## Mutation

Catatan permanen penerimaan, koreksi, perpindahan ke WIP, alokasi unit, retur,
atau scrap yang mengubah saldo inventory.

## Management Inventory

Role dashboard khusus untuk mengelola inventory. Role ini tidak memiliki hak
approval produksi dan tidak mewarisi dashboard Leader lama.

## Catalog master

Data produk, kategori, SKU, status publikasi, dan gambar katalog yang dimiliki
Yii2. Data ini tidak menyatakan ketersediaan fisik barang.

## Catalog reference

Salinan read-only catalog master di Main-ERP untuk menampilkan dan memilih
model produk pada Inventory. Referensi katalog bukan unit stok dan tidak dapat
mengubah data katalog di Yii2.
