# Proposal Inventory Ready-Stock: Yii2 dan Main-ERP

## Keputusan

Main-ERP menjadi sumber kebenaran untuk stok produk jadi: saldo fisik, reservasi,
mutasi, opname, lokasi, dan approval koreksi. Yii2 tetap menjadi sumber katalog
dan lifecycle order penjualan. Tidak ada saldo atau mutasi inventory kedua di Yii2.

Identitas katalog kanonik adalah `yii2:{id_produk}`. `id_brand` adalah konteks
operasional/penjualan dan hanya menjadi bagian key saldo bila bisnis menyatakan
stok fisik produk yang sama memang dipisahkan per brand.

## Bukti yang dipakai

- `Project Requirement Brief.pdf`, halaman 2--5, mensyaratkan SKU, stok
  fisik/reserved/available, mutasi yang dapat ditelusuri, lokasi, opname, serta
  pencegahan pengurangan ganda. Brief juga membatasi MVP pada produk jadi
  ready-stock; bahan baku, transfer, notifikasi, barcode, dan marketplace
  eksternal ditahapkan.
- `lib/legacy/adapter.ts` saat ini menerima `id_brand` dan `id_produk`, bukan
  klasifikasi ready-stock atau baris item order. `produk_sku` untuk tampilan
  diperoleh dari `produkInfo(id_produk)`, sebuah label lokal yang tidak aman
  dipakai sebagai kunci integrasi karena SKU katalog dapat duplikat, berbeda
  kapitalisasi, atau tidak bersih.
- `lib/legacy/ingest.ts` menganggap setiap payload Yii2 sebagai pembaruan order
  dan menempatkannya pada state machine 20 tahap. Ini tidak boleh dipakai
  sebagai trigger mutasi stok ready-stock.
- `lib/legacy/push-status.ts` hanya mengirim pembaruan `id_status` ke Yii2.
  Kontrak itu tidak membawa SKU, kuantitas, ataupun event idempotensi inventory.
- `app/api/intake/[orderId]/decision/route.ts` mengirim approval-lock hanya
  untuk `id_brand = 3`. Lock saat ini adalah callback best-effort dan bukan
  transaksi inventory umum. Pembatasan tersebut berada pada pengirim Main-ERP,
  bukan endpoint Yii2; callback tidak boleh digunakan untuk membatasi brand,
  trigger reserve, atau kontrak inventory.

## Batas perubahan Yii2 untuk MVP

Yii2 tidak membutuhkan menu inventory atau role baru. Untuk pilot terkendali,
bahkan tidak perlu perubahan Yii2: Main-ERP memelihara allowlist produk
ready-stock dengan kunci unik `source_system + legacy_product_id` dan kuantitas
jual satu unit. Jika brand benar-benar memisahkan stok fisik, key saldo dapat
ditambah `operational_brand_id`. Ini aman hanya bila daftar pilot kecil dan
dikelola oleh operasional.

Bila allowlist mulai rapuh, tambahkan hanya kontrak integrasi penjualan
ready-stock berikut:

1. Tandai baris order secara eksplisit sebagai `ready_stock` atau
   `made_to_order/custom`; jangan menyimpulkan dari `id_produk`.
2. Untuk setiap baris ready-stock, kirim `order_id`, nomor order, item reference,
   `product_id`, SKU/nama sebagai snapshot tampilan, dan kuantitas. Kunci
   integrasi tetap `source_system + product_id`, bukan SKU. Konteks brand tetap
   dikirim bila diperlukan untuk menentukan saldo/lokasi operasional.
3. Saat konfirmasi order, Yii2 memanggil perintah reserve Main-ERP secara
   sinkron dengan key idempotensi stabil. Order hanya boleh berstatus confirmed
   bila reserve berhasil; ini mencegah oversell saat dua order masuk bersamaan.
4. Cancellation sebelum serah-terima dan serah-terima/pengiriman dikirim sebagai
   event ber-ID unik dan dapat di-retry. Gunakan pola outbox/integrasi yang sudah
   dipakai Yii2, bukan polling payload order umum yang dipancarkan pada setiap
   penyimpanan.

## Batas Main-ERP untuk MVP

- Master `inventory_sku` menyimpan relasi unik `(source_system,
  legacy_product_id)`, SKU/nama sebagai snapshot tampilan, status aktif, dan
  atribut inventory minimum; saldo dan buku besar mutasi hanya ada di sini.
  `operational_brand_id` hanya dipakai di saldo bila disetujui sebagai pemisah
  stok fisik.
- Satu lokasi awal, namun semua saldo dan mutasi membawa `location_id` sejak
  awal agar lebih dari satu lokasi dapat ditambahkan tanpa migrasi model.
- Satu reservation unik per `source + order_id + item_reference`; mutasi tidak
  dihapus, koreksi memakai mutasi kompensasi setelah approval. Satu module
  inventory dengan interface `approve-and-reserve`, `release`, dan `issue`
  harus menyimpan reservation/mutasi/outbox dalam satu transaksi database;
  handler approval atau delivery tidak boleh menyusun operasi itu sendiri.
- Ready-stock memakai lifecycle inventory sendiri. Ia tidak boleh memajukan,
  melompati, ataupun memanfaatkan `tracking_stages` 20-tahap yang khusus
  produksi pesanan. Dengan demikian, proses intake harus mengenali order
  ready-stock sebelum membuat tracking produksi. Untuk pilot, penyerahan dibuat
  sebagai aksi inventory Main-ERP yang memanggil `issue` dengan referensi order
  unik; alur `legacy_deliveries` saat ini terikat pada stage produksi dan tidak
  dipakai ulang sebelum ia dipisahkan secara aman.

## Keputusan bisnis yang harus dikunci

1. Siapa yang mengubah order ke confirmed, cancelled, dan handed-over: Yii2 atau
   Main-ERP? Rekomendasi pilot: Main-ERP menjadi pemilik keputusan confirmed,
   lalu memanggil `approve-and-reserve` satu kali. Pada state map saat ini,
   `konfirmasi` adalah tahap Customer Care yang terlambat dan bukan konfirmasi
   penjualan; ia tidak boleh menjadi trigger reserve. Callback approval-lock
   tetap asinkron setelah keputusan sukses dan bukan syarat reserve.
2. Apakah satu order boleh berisi lebih dari satu SKU dan apakah pasangan cincin
   dihitung sebagai satu unit atau dua unit?
3. Brand/lokasi mana yang masuk pilot dan siapa approver penyesuaian opname?

Tanpa tiga keputusan itu, pemetaan status tidak boleh diikat ke `id_status`
lama maupun stage produksi.

## Langkah implementasi setelah keputusan bisnis

Pilot tanpa perubahan Yii2 mensyaratkan Main-ERP menjadi pemilik tindakan
`confirmed`, `cancelled`, dan `handed-over` untuk order allowlist. Setelah
penetapan brand/lokasi pilot dan pemilik tindakan tersebut, kerjakan berurutan:

1. migration forward-only untuk master mapping, saldo per lokasi, reservation,
   mutation immutable, dan outbox;
2. satu module inventory dengan interface `approve-and-reserve`, `release`, dan
   `issue`, yang mengunci saldo dan menyimpan seluruh perubahan dalam satu
   transaksi database;
3. action Main-ERP yang memanggil module tersebut, exception queue untuk order
   tanpa mapping, serta callback lock sebagai efek asinkron;
4. import saldo awal yang dapat direkonsiliasi terhadap spreadsheet dan pilot
   satu brand/satu lokasi; dan
5. test konkurensi reserve, retry/idempotensi, release, issue, dan larangan
   pemrosesan order non-allowlist.

Jika satu tindakan bisnis kembali menjadi milik Yii2, gantikan langkah 3 dengan
kontrak event inventory terpisah yang memiliki `event_id`, `order_id`, item
reference, product identity, kuantitas, dan outbox Yii2. Webhook order umum
tidak boleh diberi arti tambahan.
