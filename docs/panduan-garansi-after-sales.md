# Panduan Penggunaan Garansi dan After Sales

## Tujuan

Fitur Garansi mengelola hak garansi per cincin fisik, mulai dari aktivasi setelah order selesai, Claim pelanggan, pekerjaan Workshop, QC, pembatalan, hingga Exception kuota.

Garansi adalah layanan purna jual. Fitur ini **tidak mengubah** stage produksi, status order, tracking stages, stage history, atau modul order garansi lama. Order yang telah selesai tetap berstatus selesai saat Garansi diproses.

## Prasyarat Sistem

Sebelum pengguna mulai, Superadmin/administrator memastikan:

1. Migration Garansi Main-ERP 027 sampai 042 telah dijalankan secara berurutan.
2. Main-ERP dan Yii2 sudah dideploy dengan konfigurasi HMAC yang sama.
3. Cron Main-ERP dan worker Yii2 berjalan setiap menit.
4. Akun pengguna berstatus **active** dan memakai role yang tepat.
5. Pilot memakai order baru, bukan Claim legacy.

## Role, Login, dan Tanggung Jawab

| Role | Login | Menu | Tugas |
| --- | --- | --- | --- |
| After Sales | Buka **/login**, pilih **After Sales**, lalu masukkan email dan password. | Aktivasi Garansi, Garansi | Menyiapkan unit, mengaktifkan Contract, membuat Claim, menyelesaikan Claim non-workshop, membatalkan Claim, dan mengajukan Exception. |
| Workshop: jewelry expert finishing, lebur bahan, pembentukan awal, poles, laser, racik, packing | Buka **/workshop/login**, pilih user dan PIN; gunakan login manual bila diperlukan. | Warranty Work | Memulai Work, menjadi PIC, mengerjakan cincin, mengunggah bukti, dan mengirim Work ke QC. |
| QC 1 / QC 2 | Buka **/workshop/login**, pilih user dan PIN; gunakan login manual bila diperlukan. | Warranty Work | Memeriksa QC dan menyelesaikan Work. |
| SPV Operational | Buka **/workshop/login**, gunakan login manual dengan username/email dan password. | Garansi, Exception Garansi | Membaca Garansi dan menyetujui atau menolak Exception kuota. |
| Superadmin | Buka **/login**, pilih **Super Admin**, lalu masukkan email dan password. | Integrasi Garansi | Kelola akun dan menangani delivery event gagal atau identitas pemohon Exception yang belum terbaca. |

> PIC bukan role baru. PIC adalah user Workshop yang pertama kali menekan **Mulai Work** pada satu Warranty Work. PIC dapat berbeda dari user QC.

## Alur Ringkas

~~~text
Order selesai
→ After Sales menyiapkan unit garansi
→ Yii2 mengaktifkan Contract dan benefit
→ After Sales membuat Claim
→ Non-workshop: After Sales menyelesaikan Claim
  atau
→ Workshop: PIC mengerjakan → QC memeriksa → Yii2 menutup Claim
→ Jika kuota tidak ada: After Sales ajukan Exception → SPV memutuskan
~~~

## 1. Aktivasi Garansi per Cincin

**Pelaku: After Sales**

1. Login sebagai **After Sales**.
2. Buka menu **Aktivasi Garansi**.
3. Cari nomor order.
4. Pastikan order sudah berada pada stage **selesai**.
5. Tambahkan satu unit untuk setiap cincin fisik. Isi:
   - kode unit/PCS;
   - gender;
   - berat awal hasil pengukuran;
   - Plan Version/paket Garansi sesuai brand order.
6. Ulangi bila order memiliki lebih dari satu cincin.
7. Klik **Tandai siap** setelah seluruh unit lengkap.
8. Tunggu Candidate terkirim dan diterima Yii2.
9. Klik **Validasi** untuk setiap unit.
10. Setelah validasi berhasil, klik **Aktifkan**.

Hasilnya adalah satu Warranty Contract aktif untuk setiap cincin. Paket, benefit, kuota, dan berat awal dibekukan sebagai snapshot oleh Yii2.

### Jika Aktivasi Belum Dapat Dilakukan

| Kondisi | Tindakan |
| --- | --- |
| Order belum selesai | Tunggu proses order normal; jangan memindahkan stage secara manual. |
| PCS, berat awal, atau paket belum lengkap | Lengkapi Warranty Preparation. |
| Candidate belum diterima Yii2 | Tunggu cron. Bila tetap gagal, minta Superadmin memeriksa Integrasi Garansi. |
| Validasi gagal | Periksa kode unit, berat awal, dan paket yang dipilih. |

## 2. Mencari Contract dan Membuat Claim

**Pelaku: After Sales**

1. Buka menu **Garansi**.
2. Cari berdasarkan nama pelanggan, telepon, nomor order, atau referensi Contract.
3. Buka Contract yang sesuai dan periksa unit, masa berlaku, benefit, kuota, serta riwayat Claim.
4. Pilih benefit yang akan digunakan.
5. Klik **Buat Claim** lalu isi kondisi cincin/kebutuhan pelanggan.
6. Pada Claim draft, klik **Ajukan Claim dan reservasi kuota**.

Yii2 memeriksa Contract, benefit, masa berlaku, dan kuota secara kanonik. Bila berhasil, kuota menjadi **reserved**; kuota belum terpakai hingga Claim benar-benar selesai.

## 3. Claim Non-workshop

Claim non-workshop adalah benefit yang tidak membutuhkan pengerjaan fisik oleh Workshop.

**Pelaku: After Sales**

1. Buka detail Claim yang sudah berhasil direservasi.
2. Unggah bukti jika diwajibkan.
   - Format: JPEG, PNG, atau PDF.
   - Ukuran maksimum: 10 MiB per file.
3. Isi berat akhir jika diwajibkan.
4. Klik **Selesaikan Claim**.
5. Tunggu status Claim menjadi **completed**.

Yii2 memindahkan kuota dari reserved ke used hanya setelah penyelesaian berhasil. Claim batal tidak memakai kuota.

## 4. Claim yang Memerlukan Workshop

Setelah After Sales mengajukan Claim dengan benefit Workshop, Yii2 mengirim permintaan Work ke Main-ERP. Main-ERP membuat satu Warranty Work untuk satu Claim. Operator tidak membuat Work baru secara manual.

### 4.1 PIC Memulai dan Mengerjakan Work

**Pelaku: user Workshop yang memiliki permission warranty work update**

1. Login di **/workshop/login**.
2. Buka workspace Workshop, lalu pilih **Warranty Work**.
3. Buka Work dengan status **requested**.
4. Klik **Mulai Work**.

User yang menekan tombol tersebut otomatis tercatat sebagai PIC Work.

5. Kerjakan cincin sesuai kebutuhan Claim.
6. Unggah bukti kerja bila diwajibkan.
7. Bila pekerjaan siap diperiksa, klik **Kirim ke QC**.

PIC tidak memindahkan order ke stage produksi mana pun. PIC hanya mengubah status Warranty Work terpisah.

### 4.2 QC Menyelesaikan Work

**Pelaku: QC 1 atau QC 2**

1. Login di **/workshop/login**.
2. Buka **Warranty Work** dengan status **qc**.
3. Periksa hasil pekerjaan, lampiran, dan berat akhir bila diwajibkan.
4. Klik **Selesaikan Work**.

Main-ERP mengirim event Work beserta identitas QC sebagai actor ID. Status dapat menjadi **completion pending** selama Yii2 memvalidasi QC, lampiran, berat, dan benefit.

Work baru final setelah Yii2 mengirim Claim **completed** kembali ke Main-ERP.

## 5. Pembatalan Claim

**Pelaku awal: After Sales**

1. Buka detail Claim.
2. Isi alasan pembatalan.
3. Klik **Batalkan Claim**.

| Kondisi Claim | Hasil |
| --- | --- |
| Belum memiliki Warranty Work | Yii2 membatalkan Claim dan melepaskan reservation. |
| Sudah memiliki Warranty Work | Yii2 meminta keputusan pembatalan ke Workshop. |

Untuk Claim yang sudah memiliki Work, PIC membuka Work berstatus **cancellation requested**, lalu memilih setujui atau tolak pembatalan. Reservation baru dilepas setelah Yii2 mengonfirmasi hasil pembatalan.

## 6. Exception Kuota

**Pelaku pengaju: After Sales. Pelaku keputusan: SPV Operational.**

Gunakan Exception ketika Yii2 menolak Claim karena kuota tidak tersedia atau kuota habis saat submit.

### After Sales Mengajukan Exception

1. Pada detail Claim, isi alasan yang jelas.
2. Klik **Ajukan Exception kuota**.
3. Tunggu status Claim menjadi menunggu keputusan SPV.

After Sales tidak boleh mengubah kuota secara manual.

### SPV Operational Memutuskan Exception

1. Login di **/workshop/login** dengan login manual.
2. Buka **Garansi → Exception Garansi**.
3. Baca nomor Claim, nomor order, dan alasan pengajuan.
4. Isi alasan keputusan.
5. Pilih **Setujui** atau **Tolak**.

Jika disetujui, Yii2 membuat Exception Grant dan reservation secara atomik bila Claim masih memenuhi syarat. SPV tidak dapat menyetujui Exception miliknya sendiri.

Jika layar menampilkan **Menunggu pemulihan identitas**, SPV tidak boleh memutuskan request tersebut. Superadmin harus memulihkan identitas pemohon dari audit.

## 7. Tugas Superadmin

1. Login sebagai **Super Admin**.
2. Buka menu **Integrasi Garansi**.
3. Periksa:
   - **Event dead-letter**: event yang tidak terkirim setelah retry otomatis;
   - **Exception tanpa identitas pemohon**: request aman tetapi belum dapat diputuskan SPV.
4. Untuk dead-letter, periksa error lalu klik **Antrekan ulang** setelah penyebab diperbaiki.
5. Untuk Exception tanpa pemohon, klik **Pulihkan identitas**.

Replay mempertahankan event ID yang sama. Jangan membuat event baru, mengubah kuota, atau menghapus outbox/inbox untuk memperbaiki kegagalan.

## Status yang Perlu Dipahami

| Objek | Status | Arti |
| --- | --- | --- |
| Claim | draft | Claim dibuat, belum diajukan. |
| Claim | verified and reserved | Kuota sudah direservasi. |
| Claim | awaiting SPV exception | Menunggu keputusan SPV. |
| Claim | completed | Claim selesai; kuota telah digunakan. |
| Claim | cancelled | Claim dibatalkan; kuota tidak digunakan. |
| Work | requested | Yii2 sudah meminta Work; belum diambil PIC. |
| Work | in progress | PIC sedang mengerjakan. |
| Work | qc | Menunggu pemeriksaan QC. |
| Work | completion pending | Main-ERP sudah mengirim completion dan menunggu validasi Yii2. |
| Work | completed | Yii2 telah mengonfirmasi Claim selesai. |
| Work | cancellation requested | Menunggu keputusan pembatalan dari PIC. |

## Larangan Operasional

- Jangan mengubah stage order untuk memproses Garansi.
- Jangan membuat Warranty Work manual; Work dibuat dari event Yii2.
- Jangan mengubah kuota di Main-ERP atau database.
- Jangan memakai Claim legacy sebagai data pilot.
- Jangan menghapus inbox, outbox, Contract, Claim, atau Work untuk mengulang proses.
- Jangan meminta SPV menyetujui Exception miliknya sendiri.

## Checklist Pilot

Sebelum dibuka untuk penggunaan umum, uji dengan satu order baru:

1. Aktivasi satu unit garansi.
2. Claim non-workshop sampai completed.
3. Claim Workshop: requested → in progress → qc → completed.
4. Pembatalan Claim yang sudah memiliki Work.
5. Exception kuota: pengajuan After Sales dan keputusan oleh SPV lain.
6. Simulasi delivery gagal, lalu replay dari **Integrasi Garansi**.

## Penanganan Kendala

| Kendala | Tindakan pertama |
| --- | --- |
| Menu tidak terlihat | Pastikan akun aktif dan role/permission sesuai. |
| Candidate belum terkirim | Pastikan order selesai, Preparation siap, dan cron aktif. |
| Work tidak muncul | Pastikan Claim membutuhkan Workshop; minta Superadmin memeriksa Integrasi Garansi. |
| Work berhenti di completion pending | Tunggu event kanonik Yii2; bila terlalu lama, cek outbox dan HMAC. |
| Yii2 menolak Work 422 | Pastikan migration 042 diterapkan dan payload memiliki actor ID. |
| Exception tidak dapat diputuskan | Pastikan pemohon berbeda dari SPV; bila identitas kosong, gunakan pemulihan audit oleh Superadmin. |

