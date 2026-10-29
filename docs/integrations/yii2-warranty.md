# Delivery Warranty Yii2 ↔ Main-ERP

> Status: **Accepted — schema version 1.** Migration `027` dan `028` telah
> dijalankan manual oleh pemilik database. Aktivasi integrasi menunggu
> konfigurasi secret, migration `029`, deployment kedua aplikasi, dan satu
> pilot order baru.

Dokumen ini adalah runbook delivery Main-ERP untuk kontrak Warranty v1 yang
diterima bersama Yii2. Kontrak wire dan aturan domain kanonik tetap berada di
dokumentasi Warranty Core Yii2.

## Batas implementasi saat ini

Main-ERP sudah menyediakan:

- **Order Detail → Warranty Preparation**, satu baris untuk satu cincin fisik;
- event keluar `warranty_activation_ready` setelah Preparation siap dan stage
  `selesai` tercatat;
- outbox aktivasi yang idempoten serta retry;
- endpoint masuk `POST /api/warranty/v1/events` untuk
  `warranty_contract_activated` dan `warranty_claim_changed`;
- inbox idempoten serta Contract dan Claim Projection untuk kebutuhan worklist.
- validasi dan aktivasi Candidate per unit dari panel Warranty Preparation,
  dengan receipt `request_id` yang dipakai ulang pada retry.
- Plan Version pada Warranty Preparation dibatasi ke brand order KGJ/Hijaz dan
  durasi 1, 2, 3, 5, atau 10 tahun yang disetujui.
- After Sales memiliki menu **Aktivasi Garansi** untuk mencari nomor order,
  mengelola Preparation, memvalidasi Candidate, dan mengaktifkan Contract tanpa
  memasuki workspace SPV.

Main-ERP juga menyediakan Claim reguler non-workshop dari workspace After Sales:
buat draft, ajukan dan reservasi kuota, unggah bukti, serta selesaikan Claim
bila benefit tidak memerlukan Workshop Work. Claim memakai `benefit_code`,
sesuai endpoint Yii2 yang aktif saat ini.

Warranty Work, cancellation workshop, Exception SPV, serta ringkasan operasional
Garansi tersedia pada Main-ERP. Dashboard analitik per periode/brand/cabang
tetap bukan bagian dari delivery v1; projection tidak boleh dipakai untuk
menghitung atau mengubah kuota.

Worklist Contract read-only tersedia pada workspace **After Sales → Garansi** untuk operator dengan
permission `warranty.contract.read`. Operator dapat membuka detail Contract,
benefit/kuota, dan riwayat Claim. Detail Claim beserta lampiran dan audit hanya
ditampilkan bila operator juga memiliki `warranty.claim.read`. Seluruh data
dibaca langsung dari query kanonik Yii2 dan tidak disimpan sebagai state lokal.

Integrasi ini tidak mengubah order, workflow 20 stage, `tracking_stages`,
`stage_history`, `legacy_orders`, maupun modul klaim Yii2 lama.

## Konfigurasi rahasia dan URL

Buat tiga nilai acak yang berbeda dan simpan hanya pada secret manager. Jangan
commit nilai tersebut atau menaruhnya pada `.env.example`.

| Tujuan | Pemilik konfigurasi | Nilai yang sama di kedua sisi |
| --- | --- | --- |
| Main-ERP → Yii2 | `WARRANTY_MAIN_ERP_SECRET` dan Yii2 server-only secret store | Secret A |
| Yii2 → Main-ERP | Yii2 server-only outbox secret dan `WARRANTY_YII2_SECRET` | Secret B |
| Autentikasi cron HTTP Main-ERP | `CRON_SECRET` | Secret C / secret cron yang telah dipakai ERP |

Tambahkan environment variable berikut pada deployment Main-ERP:

```env
WARRANTY_YII2_BASE_URL=https://<domain-yii2>
WARRANTY_MAIN_ERP_KEY_ID=main-erp
WARRANTY_MAIN_ERP_SECRET=<Secret-A>
WARRANTY_YII2_SECRET=<Secret-B>
CRON_SECRET=<Secret-C>
```

`WARRANTY_YII2_BASE_URL` adalah base URL tanpa path. `main-erp` adalah key ID
publik, bukan secret. Main-ERP menerima event Yii2 hanya dengan key ID `yii2`.

Di sisi Yii2, Secret A/B **tidak boleh** disimpan di
`common/config/params-local.php`, karena file itu terlacak Git. Yii2 perlu
memiliki loader server-only yang membaca lokasi yang di-ignore Git atau secret
environment deployment sebelum secret dikonfigurasi. Secret A digunakan untuk
menerima key ID `main-erp`; Secret B digunakan dispatcher Yii2 untuk key ID
`yii2` dan target:

```text
https://<domain-main-erp>/api/warranty/v1/events
```

Setiap request memakai HMAC kontrak v1. Main-ERP menganggap event berhasil
hanya bila dapat menyimpan inbox dan projection dalam satu transaksi lalu
mengembalikan HTTP `202`. Event dengan pasangan `order.source_id` dan
`order.reference` yang tidak cocok ditolak sebagai `422 order_identity_mismatch`.
Kedua server harus memakai jam tersinkron; request dengan selisih waktu lebih
dari lima menit ditolak.

Untuk staging/demo, gunakan URL dan Secret A/B yang khusus staging. Staging
tidak boleh mengirim event ke domain produksi atau memakai secret produksi.

## Akses operator

Gunakan role dashboard `after_sales` untuk After Sales dan Warranty
Administrator. Workspace ini terpisah dari dashboard SPV Operational dan hanya
menampilkan menu Garansi. Permission harus dipetakan granular, bukan hanya
boolean administrator:

| Aksi | Permission Main-ERP |
| --- | --- |
| Membaca Contract dan detailnya | `warranty.contract.read` |
| Membaca detail Claim | `warranty.claim.read` |
| Validasi Candidate | `warranty.activation.validate` |
| Aktivasi Candidate | `warranty.activation.activate` |
| Membuat Claim | `warranty.claim.create` |
| Submit Claim | `warranty.claim.submit` |
| Menyelesaikan non-workshop Claim | `warranty.claim.complete_non_workshop` |

Role `after_sales` juga memakai `warranty.claim.create`,
`warranty.claim.submit`, dan `warranty.claim.complete_non_workshop` untuk
Claim reguler, serta `warranty.claim.cancel` dan
`warranty.exception.request` bila diperlukan. Workshop memakai permission
`warranty.work.update` yang hanya diberikan ke role produksi/QC terkait.
`operational_supervisor` memakai `warranty.exception.decide`: ia hanya
memutuskan request, tidak mengubah kuota lokal dan tidak dapat menyetujui
permohonannya sendiri.

Main-ERP juga memiliki Warranty Work terpisah untuk PIC, progres, QC,
lampiran, berat akhir, dan handshake pembatalan. Completion hanya tampil final
setelah event `warranty_claim_changed` dari Yii2 mengonfirmasi Claim selesai.
Setiap event `warranty_work_updated` membawa `data.actor_id` dari operator yang
melakukan tindakan; `pic_id` tetap hanya identitas PIC Work.
Superadmin memantau dead-letter dan Exception yang kehilangan identitas pemohon
di **Superadmin → Integrasi Garansi**. Replay selalu memakai `event_id` dan
payload yang sama; pemulihan pemohon hanya menggunakan satu identitas yang
tercatat pada audit request asli.

## Mengaktifkan delivery

1. Buat atau verifikasi loader server-only yang di-ignore Git pada Yii2.
2. Simpan Secret A/B pada environment deployment Main-ERP dan storage
   server-only Yii2; simpan Secret C hanya untuk endpoint cron HTTP Main-ERP.
3. Deploy ulang Main-ERP dan Yii2.
4. Jadwalkan dispatcher Yii2 sesuai kontrak:

   ```text
   yii warranty/deliver --limit=25
   ```

   Worker CLI Yii2 tidak memakai Secret C.

5. Aktifkan outbox Main-ERP dengan cron satu menit untuk
   `GET /api/warranty/cron`. Endpoint memerlukan header:

   ```text
   Authorization: Bearer <CRON_SECRET>
   ```

   Di cron-job.org, buat satu job GET setiap menit ke
   `https://<domain-main-erp>/api/warranty/cron` dan kirim header
   `Authorization: Bearer <CRON_SECRET>`. Jangan menambah jadwal ini sebelum
   kedua secret dan receiver Yii2 siap.

6. Worker menerima hanya HTTP `202` sebagai delivery sukses. Retry selalu
   menggunakan `event_id` asli; setelah kegagalan ke-12, event menjadi
   `dead_letter` untuk direplay operator.

## Pilot dan verifikasi

Gunakan satu order **baru**, bukan enam Legacy Claim:

1. Biarkan order mencapai stage `selesai`.
2. Warranty administrator menambahkan satu Warranty Preparation per cincin,
   dengan `unit_code`, berat awal terukur, dan Plan Version yang dipilih dari
   opsi brand order.
3. Tandai Preparation siap. Main-ERP membuat satu activation outbox dan tidak
   mengubah workflow order.
4. Setelah outbox berstatus `delivered`, validasi setiap Candidate dari panel
   Preparation, lalu aktifkan Candidate yang tervalidasi. Klik ulang memakai
   `request_id` yang sama dan tidak membuat aktivasi kedua.
5. Pastikan Yii2 menerima `warranty_activation_ready` dan menerbitkan
   `warranty_contract_activated` setelah Contract benar-benar aktif.
6. Pastikan Main-ERP menyimpan event dan projection:

   ```sql
   SELECT source, event_id, event_type, applied_at
   FROM public.warranty_event_inbox
   ORDER BY created_at DESC;

   SELECT contract_reference, unit_code, brand_code, activated_at, expires_at
   FROM public.warranty_contract_projections
   ORDER BY created_at DESC;

   SELECT claim_reference, claim_version, canonical_status, quota_available
   FROM public.warranty_claim_projections
   ORDER BY last_updated_at DESC;
   ```

7. Periksa log kedua aplikasi: tidak boleh ada signature failure, event duplikat
   yang mengubah state, atau `order_identity_mismatch`.

Jika pilot gagal, nonaktifkan jadwal cron terlebih dahulu. Jangan menghapus
inbox, outbox, projection, Contract Yii2, atau data order untuk mencoba ulang;
perbaiki konfigurasi dan replay event dengan `event_id` yang sama.

## Catatan operasional

- Aktivasi memakai StageKey `selesai`, tetapi `activated_at` tetap waktu stage
  tersebut committed. Preparation yang selesai belakangan tidak mengubahnya.
- Data PCS dan berat tidak boleh dibagi otomatis dari agregat pria/wanita.
- Enam klaim legacy tetap diselesaikan pada modul lama dan tidak ikut automation
  maupun laporan Warranty v1.
- Projection Main-ERP bersifat eventual-consistent; ia bukan sumber kebenaran
  kuota atau Claim.

## Koreksi teknis yang menunggu sinkronisasi dokumen Yii2

Implementasi Yii2 yang aktif menerima `benefit_code` dan `condition_notes` pada
Claim draft; Appendix A masih menyebut `entitlement_reference`. Selain itu,
`candidate_sequence` perlu didefinisikan sebagai stabil dan deterministik, bukan
wajib kontigu, karena unit dapat dihapus sebelum Preparation dikunci. Kedua
perubahan ini adalah koreksi kontrak teknis, bukan perubahan benefit atau aturan
bisnis.
