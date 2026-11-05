# Inventory MVP Main-ERP

Status: **baseline implementasi MVP**.

Tujuan MVP adalah mengganti dashboard Leader yang sudah dihentikan dengan
dashboard Inventory Main-ERP untuk stok material, cincin jadi, WIP, dan mutasi
order. Yii2 tetap menjadi sumber order; Main-ERP adalah satu-satunya tempat
saldo dan transaksi inventory dicatat.

## Batas MVP

MVP mendukung KGJ, HJZ, dan MPM sebagai konteks brand, dengan role dashboard
`management` khusus Inventory dan tanpa saldo inventory di Yii2. Data order yang sudah tersimpan di `legacy_orders`
(`id_brand`, `komponen`, `berat_cincin_pria`, dan `berat_cincin_wanita`) dipakai
sebagai dasar layar approval. Tidak ada outbox Yii2, production lock lintas
sistem, hash snapshot, lease, maupun konfigurasi pilot khusus pada MVP.

## Fitur yang dibangun

1. Dashboard Inventory: total gram gudang, unit cincin jadi tersedia,
   WIP, dan mutasi terakhir.
2. Master minimum: Gudang Utama/WIP, material, stok awal, dan `stock_unit` untuk setiap
   cincin jadi ready-stock. Unit ready-stock membawa produk, bahan Yii2, ukuran,
   dan berat aktual agar tidak dapat dialokasikan ke cincin yang berbeda.
3. Riwayat mutasi immutable: stok awal, gudang-ke-WIP, alokasi cincin jadi,
   dan retur.
5. Aksi inventory pada approval yang sudah ada:
   `approval_penerimaan_order → racik_bahan`.

## Alur approval

Pada tahap approval, SVP Operational memilih satu sumber pemenuhan:

- **Custom**: Main-ERP membaca bahan dan berat dari order tersinkron, lalu
  mengurangi saldo gudang dan menambah WIP order.
- **Ready-stock**: SVP memilih satu `stock_unit` cincin jadi; unit berpindah dari
  tersedia ke teralokasi untuk order.

Satu order hanya memakai salah satu sumber. Pengiriman tidak menulis mutasi
stok kedua. Setelah order dibatalkan, Management dapat mencatat retur sebagai
mutasi baru; riwayat tidak dihapus dan retur tidak pernah dipicu oleh soft-delete Yii2.

Setelah issue berhasil commit, Main-ERP mengirim stage `racik_bahan` ke callback
status Yii2 yang sudah ada. Pengiriman memakai antrean retry status legacy;
kegagalan callback tidak mengulang issue stok. `order_deleted` dari Yii2 untuk
order yang sudah memiliki issue inventory diabaikan agar proyeksi, tracking,
dan audit stok tidak hilang.

## Akses

- `management`: dashboard inventory, master minimum, stok awal, dan retur stok tercatat.
- `superadmin`: membuat, menonaktifkan, dan mengelola akun Management.
- `operational_supervisor`: approval dan issue stok pada tahap approval.
- Role produksi yang ada: melihat WIP yang relevan.

Role `management` tidak memulihkan akun `leader_*`, task Management, maupun
hak approval produksi. Ia memakai `role_group` khusus `inventory`, sehingga tidak
mewarisi akses data operasional dari kebijakan RLS lama. Tidak ada role Yii2 baru.

## Data minimum sebelum pemakaian

Management mengimpor material, lokasi, saldo awal, dan unit cincin jadi yang
benar-benar tersedia. Aktivasi membutuhkan Gudang/WIP default, minimal satu
mapping bahan Yii2 aktif, serta saldo gudang positif. Sebelum itu approval tetap berjalan
dengan alur legacy. Setelah aktif, order dengan data bahan atau berat yang belum
lengkap ditolak sebelum stage berpindah agar saldo tidak salah.

## Ditunda

Penerimaan bahan manual, stok opname/koreksi, scrap, transfer lokasi, batas
stok minimum, ledger/export lanjutan, serta kontrak lintas sistem kompleks
merupakan opsi fase berikutnya bila MVP sederhana terbukti tidak cukup.
