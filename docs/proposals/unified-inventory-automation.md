# Unified Inventory Automation: Yii2 dan Main-ERP

> Status: **ditunda setelah MVP**. Dokumen ini mendeskripsikan integrasi
> lintas-sistem berintegritas tinggi (snapshot, lease, dan outbox). Ia bukan
> rencana implementasi MVP; gunakan `docs/proposals/inventory-mvp.md` sebagai
> baseline saat ini.

## Keputusan arsitektur

Inventory berlaku untuk semua order KGJ, HJZ, dan MP, baik custom maupun
ready-stock. Main-ERP adalah sumber kebenaran untuk material, produk jadi,
reservation, WIP, mutasi, retur, scrap, dan saldo per lokasi. Yii2 tetap
menjadi sumber order, komponen desain, bahan terpilih, dan berat appraisal.

Perubahan ini menggantikan pilot sebelumnya yang hanya mengandalkan allowlist
produk jadi dan tidak mengubah Yii2. Otomasi custom tidak akurat tanpa snapshot
material/berat yang eksplisit dari Yii2.

## Trigger kanonik

Gunakan stage key yang sudah ada, tanpa menambah atau mengganti state machine:

```text
approval_penerimaan_order --[approve]--> racik_bahan
```

Pada approval tersebut, Main-ERP menjalankan `approve-and-issue` dalam satu
transaksi database. Label aksi di UI boleh menjelaskan makna bisnisnya sebagai
"Setujui dan keluarkan stok ke produksi", tetapi stage key dan integrasi status
Yii2 tidak diubah. `approval_racik_bahan` adalah approval berikutnya dan tidak
boleh meng-issue stok kedua kali.

## Alur stok

| Sumber pemenuhan | Saat approval penerimaan order | Saat pengiriman |
| --- | --- | --- |
| Custom atau desain standar yang tetap dibuat | Material gudang dipindahkan ke WIP order berdasarkan kebutuhan tervalidasi. | Tidak ada issue material kedua. |
| Ready-stock yang benar-benar cincin jadi | Satu unit produk jadi dipindahkan dari gudang ke alokasi order. | Tidak ada issue produk kedua. |

Perpindahan ke WIP mengurangi stok **gudang yang tersedia**, tetapi material
tetap ada secara fisik di WIP. Dashboard wajib membedakan gudang, WIP, dan
total organisasi agar perpindahan tidak dibaca sebagai kehilangan material.

Hal yang sama berlaku bagi cincin jadi: pada approval, unit keluar dari stok
gudang/tersedia dan masuk ke lokasi/status `allocated_to_order`. Total fisik
perusahaan belum berkurang bila unit masih tersimpan menunggu serah-terima.
Dengan ini aturan bisnis "stok berkurang saat approval" terpenuhi tanpa
menghilangkan barang yang masih dapat diaudit secara fisik.

Satu order hanya mempunyai satu sumber pemenuhan pada approval: produk jadi
atau material. Ia tidak boleh mengurangi keduanya kecuali bisnis kelak
mendefinisikan proses perakitan yang terpisah.

## Unit cincin jadi

Untuk ready-stock, buat `stock_unit` satu baris untuk satu cincin fisik.
Minimal memuat product identity Yii2, ukuran, material/kadar, berat aktual,
brand/pool bila relevan, lokasi, dan status. Barcode/QR scan tidak diperlukan
pada rilis pertama; `unit_code` yang diinput atau diimpor sudah cukup.

Alurnya adalah `available` → `allocated_to_order` → `handed_over`. Sebelum
approval, operator memilih unit yang cocok untuk order; transaksi approval
mengunci unit tersebut sehingga satu unit tidak dapat dialokasikan pada dua
order. Pembatalan mengembalikan unit ke `available` hanya setelah pemeriksaan
kondisinya; unit bermasalah masuk `inspection`, bukan stok jual.

## Module inventory Main-ERP

Letakkan seluruh aturan di satu module dengan interface kecil:

- `reserve-requirement(orderSnapshot)`
- `approve-and-issue(orderId, snapshotVersion, actorId)`
- `release-reservation(orderId, actorId)`
- `return-from-wip(orderId, lines, actorId)`
- `reconcile-actual-usage(orderId, lines, actorId)`

`approve-and-issue` mengunci order, snapshot aktif, reservation, dan saldo
lokasi; lalu memvalidasi mapping/ketersediaan, menulis dua sisi mutasi
(gudang-ke-WIP atau gudang-ke-alokasi), audit actor, perubahan stage, dan
outbox dalam satu transaksi. Kunci unik `order_id + issue_reference` membuat
approve atau retry tidak dapat meng-issue dua kali.

Handler `app/api/supervisor/approve` saat ini menjalankan perubahan stage dan
sinkronisasi Yii2 secara terpisah; ia harus menjadi caller module tersebut,
bukan menyimpan logika stok sendiri. Callback `spv_cs_approved_lock` tetap
asinkron setelah commit dan bukan syarat keberhasilan issue.

Hanya transisi `approval_penerimaan_order` ke `racik_bahan` yang memanggil
module ini. Status Yii2 yang telah dipetakan, termasuk grup status yang ada,
tidak diubah; perubahan label aksi di Main-ERP tidak mengubah kontrak stage.

## Kontrak Yii2 yang diperlukan

Pertahankan `order-sync` lama untuk kompatibilitas. Tambahkan outbox snapshot
order-material additive, dengan `event_id` dan `snapshot_version` monotonik
per order. Payload minimal memuat identitas order/brand, status bisnis,
komponen pria/wanita, identitas bahan Yii2, ukuran, berat appraisal, dan
referensi order. Ia tidak memuat keputusan sumber pemenuhan;
Main-ERP memilih dan menyimpan fulfillment plan setelah menerima snapshot valid.

Yii2 mengirim snapshot setelah transaksi sukses bila komponen, bahan, ukuran,
berat appraisal, atau pembatalan berubah. Main-ERP hanya memakai versi terbaru;
retry event yang sama tidak boleh mengubah reservation atau mutation kedua kali.
`OrderKomponen.jumlah`, harga order, SKU, dan nama produk bukan kuantitas logam.

Outbox asinkron memperbarui projection, tetapi tidak sendiri menjamin bahwa
snapshot pada layar SVP adalah versi terbaru Yii2 ketika approval diklik. Untuk
aturan stale yang ketat, gunakan production lock dengan lease dan receipt
idempoten. Kontraknya memakai `request_id`, `lock_id`, `snapshot_version`,
payload hash, actor, dan `expires_at`.

1. `acquire-production-lock(orderId, expectedSnapshotVersion)` memeriksa versi
   Yii2 secara atomik, menolak versi lama dengan `409`, dan mengembalikan lease.
2. Sebelum memanggil Yii2, Main-ERP membuat dan menyimpan `issue_request_id`
   pada record request durable. Ia kemudian memanggil
   `mark-issue-intent(lockId, issueRequestId)`. Yii2 mengubah lease menjadi
   `issue_committing` dan menutup perubahan data material.
3. Main-ERP menjalankan `approve-and-issue` secara atomik dengan
   `issue_request_id` sebagai idempotency key, lalu outbox memanggil
   `finalize-production-lock(lockId, issueReceipt)`.
4. Jika issue gagal, Main-ERP memanggil `release-production-lock`. Reconciliation
   Yii2 membaca status `issueRequestId` dari Main-ERP bila release/finalize gagal.

Lease `leased` boleh kadaluarsa otomatis karena belum ada issue. Tetapi
`issue_committing` tidak boleh otomatis membuka edit hanya karena jaringan
putus: Main-ERP mungkin telah commit issue. Ia harus fail-closed sampai
reconciliation membuktikan issue gagal atau finalisasi berhasil. Tidak ada
desain dua database yang sekaligus dapat menjamin tidak pernah terkunci dan
tidak pernah memakai snapshot stale saat terjadi network partition.

State lock Yii2 dan state issue request Main-ERP terpisah:

```text
Yii2: unlocked -> leased -> issue_committing -> finalized
Main-ERP: prepared -> committed | aborted
```

Main-ERP menyimpan `prepared` secara durable sebelum meminta `issue_intent`.
Ia menulis `committed` bersama mutation ledger dan perpindahan stage dalam satu
transaksi. `aborted` bersifat terminal, wajib menyimpan alasan, dan hanya boleh
ditulis bila transaksi membuktikan tidak ada issue/mutation ledger untuk request
tersebut.

Endpoint status Main-ERP mengembalikan `committed`, `aborted`, atau
`processing` berdasarkan record request durable. Yii2 hanya boleh release saat
menerima `aborted`; jangan memakai `not_found`, timeout, atau status sementara
sebagai izin release. Setiap command mengikat `issue_request_id`, `order_id`,
`lock_id`, `snapshot_version`, `snapshot_hash`, dan `actor_id`. Reuse request
ID dengan payload hash berbeda harus `409 Conflict`; retry dengan payload sama
mengembalikan receipt semula.

Production lock membekukan hanya komponen/material, bahan, ukuran, gender,
dan berat appraisal. Pembayaran tetap dapat diubah kecuali
bisnis secara eksplisit meminta lock order menyeluruh. Callback
`spv_cs_approved_lock` lama tetap terpisah sebagai lock bisnis umum setelah
commit. Semua ini adalah kontrak integritas data, bukan trigger inventory dan
bukan perluasan webhook legacy.

Yii2 menolak seluruh perubahan inventory-relevant saat lock berstatus `leased`,
`issue_committing`, atau `finalized`; hanya `released` yang membuka kembali
perubahan tersebut. Dengan ini snapshot hash yang dikunci tetap berlaku sampai
Main-ERP meng-issue atau pembatalan terbukti durable. Pembayaran tetap berada
di luar daftar field yang dibekukan.

Main-ERP memelihara mapping `source_system + source_material_id` ke material
inventory, satuan (`DECIMAL` gram untuk logam), lokasi/pool, dan formula waste.
Snapshot dengan bahan/berat yang belum bisa dipetakan masuk exception queue dan
memblok approval issue.

## Pembatalan dan rekonsiliasi

- Sebelum issue: release reservation tanpa mutasi fisik.
- Sesudah issue tetapi bahan belum dipakai: `return-from-wip`, tidak menghapus
  mutation awal.
- Sesudah proses berjalan: catat pemakaian aktual, sisa, retur, dan scrap
  sebagai mutation kompensasi/rekonsiliasi dengan approval bila melewati
  toleransi.

Legacy delete webhook Yii2 hanya menandai exception/reconciliation. Ia tidak
boleh mem-release reservation maupun membalik issue secara otomatis.

Produk jadi dari WIP, batu, box, dan komponen non-logam hanya ikut otomatis
setelah material master, formula kebutuhan, dan titik pencatatan aktualnya
disetujui. Jangan menyimpulkan kuantitasnya dari struktur komponen saat ini.

## Keputusan wajib sebelum implementasi

1. Definisi operasional ready-stock: cincin jadi atau desain standar yang masih
   dibuat dari bahan.
2. Formula kebutuhan dan waste/susut per material, termasuk toleransi selisih
   serta approver-nya.
3. Material/kategori mana yang dilacak pada rilis pertama dan lokasi fisiknya
   (gudang serta WIP).
4. Apakah pool fisik material KGJ/HJZ/MP bersama atau dipisah.
5. Titik dan PIC pencatatan pemakaian aktual, retur, serta scrap.

## Urutan implementasi

1. Validasi schema Supabase hidup dan buat migration forward-only untuk master
   material, mapping, lokasi, saldo, reservation, WIP, mutation, inbox, dan
   outbox.
2. Implementasikan receiver snapshot Yii2 dan exception queue beserta test
   urutan versi/idempotensi, serta acquire/intent/release/finalize production
   lock dan rekonsiliasinya.
3. Implementasikan module inventory serta RPC/transaksi approval-to-issue;
   hubungkan hanya ke transisi `approval_penerimaan_order` ke `racik_bahan`.
4. Tambahkan tindakan retur/WIP dan rekonsiliasi aktual dengan permission pada
   role Main-ERP yang ada; tidak membuat role Yii2 baru.
5. Import saldo awal, rekonsiliasi fisik, dan pilot satu lokasi sebelum semua
   brand/pool dibuka.

## Rollout tanpa mengganggu data berjalan

Seluruh schema dan kontrak baru bersifat additive. Jangan backfill, reserve,
atau issue otomatis untuk order historis. Tetapkan cutover eksplisit: hanya
order pilot yang dibuat atau mencapai `approval_penerimaan_order` setelah
tanggal aktivasi dan memiliki snapshot inventory valid yang diproses oleh
module baru. Stage key, urutan stage, status Yii2 yang dipetakan, slot produksi,
dan `order-sync` legacy tetap dipertahankan; hanya transisi approval tersebut
yang dapat ditolak bila snapshot stale, mapping tidak lengkap, atau stok/unit
tidak tersedia.

Sebelum aktivasi, import saldo awal dan stock unit, kemudian rekonsiliasi fisik.
Mulai dari satu gudang dan pool/brand terbatas, pantau exception queue serta
rekonsiliasi harian selama pilot. Perluasan hanya dilakukan setelah UAT timeout,
retry, stale snapshot, issue ganda, cancellation, retur, dan scrap lulus.
