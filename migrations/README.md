# Database Migrations

Schema Main-ERP saat ini memakai model integrasi Yii2: `legacy_orders` sebagai data order intake dan `tracking_stages` + `stage_history` sebagai tracking produksi.

## Status migration

| Kelompok | File | Status |
|---|---|---|
| Arsip model BMS lama | `001`–`004` | Jangan dijalankan ulang. Hanya catatan historis. |
| Management | `005`, `006` | Schema task management lama; dipensiunkan oleh `043`. |
| Integrasi Yii2 dan tracking aktif | `009`–`020` | Menambahkan model order legacy, stage, sinkronisasi, brand, dan intake SPV CS. |
| Pembersihan model lama | `021`–`024` | Sudah menghapus CS/Marketing lama, Slots, Cekat, Order Form, tabel BMS lama, cabang, dan work instruction. |

- Migration `027` menambahkan data PCS/berat per unit serta outbox aktivasi Warranty.
- Migration `028` menambahkan inbox idempoten dan Contract Projection dari event Yii2.
- Migration `029` menambahkan receipt command Candidate agar retry validasi/aktivasi memakai `request_id` yang sama.
- Migration `030` menambahkan role dashboard `after_sales` untuk Garansi, tanpa mengubah role atau workspace SPV Operational.
- Migration `031` menjaga `candidate_sequence` asli pada event aktivasi agar Candidate tidak berubah ketika unit awal dihapus sebelum Preparation dikunci.
- Migration `032` menambahkan permission Claim non-workshop pada role `after_sales`, tanpa memberi akses Warranty ke SPV Operational.
- Migration `033` menambahkan Claim Projection idempoten untuk event `warranty_claim_changed` dari Yii2.
- Migration `034` memberi SPV Operational akses baca Garansi tanpa hak aktivasi atau Claim.
- Migration `035` menambahkan Warranty Work terpisah dan penerimaan idempoten `warranty_work_requested` dari Yii2.
- Migration `036` menambahkan outbox atomik untuk pembaruan Warranty Work ke Yii2.
- Migration `037` memberi After Sales permission untuk membatalkan Claim dan mengajukan Exception kuota.
- Migration `038` memberi role workshop yang sudah ada permission khusus untuk memperbarui Warranty Work; SPV tidak mendapat akses ini.
- Migration `039` menyimpan ID bukti kerja dari Yii2 secara atomik pada Warranty Work aktif.
- Migration `040` menahan completion sebagai `completion_pending` sampai Claim kanonik selesai dan menambah handshake pembatalan Warranty Work.
- Migration `041` menerima Exception request dari Yii2 dan menulis keputusan SPV beserta outbox secara atomik.
- Migration `042` mewajibkan `actor_id` pada event Work ke Yii2 dan melengkapi event Work yang belum terkirim dari audit Work lokal.
- Migration `043` menonaktifkan akun `leader_*` dan menghapus data task Management. Ia tidak mengubah order, produksi, akun pengguna lain, atau file pada storage bucket `task-attachments`.
- Migration `044` menambah core Inventory MVP: lokasi, material, saldo, unit ready-stock, mutasi, dan RPC issue custom atomik pada approval penerimaan order. Migration ini forward-only dan belum diterapkan otomatis.
- Migration `045` menambahkan role dashboard `management` khusus Inventory dengan `role_group` terpisah `inventory`. Migration ini berhenti bila masih ada akun Management lama yang aktif agar tidak ada akun legacy yang memperoleh akses baru secara tidak sengaja.
- Migration `046` menambahkan status aktivasi Inventory yang default-nya mati, lokasi Gudang Utama/WIP, dan RPC pencatatan saldo awal atomik. Approval lama tetap berjalan sampai Management mengaktifkan Inventory secara eksplisit.
- Migration `047` memperketat kecocokan ready-stock terhadap produk, bahan, dan ukuran order serta menambahkan retur stok immutable dari WIP/alokasi kembali ke gudang.
- Migration `049` menambah referensi katalog Yii2 read-only serta RPC pencatatan stok awal ready-stock yang atomik dengan mutation ledger. Ia tidak mengubah order, stage, approval, rework, maupun webhook legacy.
- Migration `051` membedakan bahan ready-stock yang wajib ditimbang per unit dari bahan yang dikelola per jumlah unit. Ia menambahkan impor stok awal atomik untuk Perak Hijaz dan tidak mengubah order, stage, approval, rework, atau webhook legacy.

## Tabel inti aktif

- Identitas dan akses: `roles`, `users`, `activity_logs`, `notifications`, `qr_codes`, `stage_personnel`.
- Order Yii2 dan produksi: `legacy_orders`, `tracking_stages`, `stage_history`, `legacy_rework_logs`, `legacy_deliveries`, `legacy_quality_checklist_results`.
- Sinkronisasi dan intake: `sync_logs`, `legacy_status_sync_queue`, `legacy_approval_lock_sync_queue`, `legacy_order_intakes`, `brand_intake_policies`.
- Migration `025` menambahkan metadata dan retry pengiriman rework SPV CS pada `legacy_order_intakes`.
- Management: tabel `management_*` hanya tersisa sebagai schema lama setelah `043`; data task dihapus, sedangkan objek storage attachment perlu dibersihkan terpisah setelah diverifikasi.
- Warranty: `warranty_preparations`, `warranty_preparation_units`, `warranty_activation_outbox`.
- Warranty inbound: `warranty_event_inbox`, `warranty_contract_projections`, `warranty_claim_projections`.
- Warranty command receipt: `warranty_candidate_commands`.

Nama `legacy_*` di atas adalah tabel aktif. Jangan tertukar dengan tabel BMS lama tanpa prefix tersebut.

## Ketentuan penerapan

1. Jangan menjalankan `001`–`004` pada database aktif atau database baru yang ditujukan untuk Main-ERP saat ini.
2. Migration di folder ini adalah dokumentasi reverse-engineered; schema live Supabase tetap menjadi sumber kebenaran.
   Khusus `roles.allowed_stages`, schema live bertipe `jsonb`; gunakan `'[]'::jsonb` untuk role tanpa stage.
3. Sebelum migration baru, ekspor schema live dan pastikan dependensi view, policy RLS, constraint, serta data sudah diperiksa.
4. Untuk verifikasi schema live, gunakan:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

## Tabel yang sudah dipensiunkan

Migration `021`–`024` menghapus seluruh tabel model lama, termasuk `cs_orders`, `orders`, `branches`, `work_instructions`, Slots, Cekat, Marketing, dan Customer Service dashboard lama. Tabel tersebut tidak boleh dibuat kembali kecuali ada keputusan arsitektur baru.
