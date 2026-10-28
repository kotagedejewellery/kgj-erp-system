# Deploy Main-ERP ke VPS 1

Konfigurasi ini menjalankan Main-ERP sebagai satu container Next.js di jaringan Docker eksternal `proxy`. Traefik VPS 1 menangani HTTPS untuk `erp.kotagedejewellery.tech` dan meneruskan request ke port internal `3000`; aplikasi tidak membuka port host sendiri. Database, Auth, Storage, Realtime, dan RLS tetap memakai Supabase Cloud ERP.

## Prasyarat

- DNS `erp.kotagedejewellery.tech` sudah mengarah ke IP VPS 1.
- Jaringan Docker `proxy` dan Traefik sudah berjalan.
- URL Supabase dapat diakses browser pada `NEXT_PUBLIC_SUPABASE_URL`, termasuk endpoint Auth, REST, Realtime, dan Storage.
- Repository sudah tersedia pada `/opt/apps/sistem-erp/main-erp` dan user VPS dapat melakukan `git fetch origin`.

## Konfigurasi VPS

Di direktori aplikasi di VPS, buat `.env.production` dengan izin baca hanya untuk operator. Jangan commit file ini.

```dotenv
NEXT_PUBLIC_APP_URL=https://erp.kotagedejewellery.tech
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=
PUSHER_APP_ID=
PUSHER_SECRET=
LIVE_SYSTEM_BASE_URL=https://backend.example.com
CRON_SECRET=
```

Jalankan:

```bash
docker compose --env-file .env.production -f compose.production.yml config
docker compose --env-file .env.production -f compose.production.yml \
  up -d --build --force-recreate
```

## Auto deploy

Push ke `main` menjalankan workflow CI terlebih dahulu. Hanya commit yang CI-nya sukses yang dideploy oleh `.github/workflows/deploy.yml`. Repository harus memiliki secret `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, dan `VPS_SSH_KNOWN_HOSTS`; gunakan `VPS_USER=Kotagede-Jewellery`.

Workflow tidak menjalankan migration ataupun perintah Docker global. Migration Supabase Cloud adalah proses manual, forward-only, dan memerlukan review/approval tersendiri.

Setelah container aktif, cek `https://erp.kotagedejewellery.tech/login`, login, dan endpoint integrasi yang memakai `CRON_SECRET` sebelum mengalihkan trafik produksi.

## Batasan cutover

Konfigurasi ini tidak membuat atau mengubah Supabase Cloud, DNS, firewall, maupun data. Jangan membuat database/container Supabase lokal, menjalankan migration otomatis, atau mengubah Traefik global. Setelah deploy, jalankan `~/vps-audit.sh` untuk memastikan hanya container ERP baru yang ditambahkan.
