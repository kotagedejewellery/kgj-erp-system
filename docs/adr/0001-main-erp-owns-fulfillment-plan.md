# ADR 0001: Main-ERP owns the fulfillment plan

Status: Superseded by `docs/proposals/inventory-mvp.md`

## Context

Order katalog Yii2 dapat tetap menjadi custom. Karena itu `id_produk` tidak
menentukan apakah order harus meng-issue bahan atau cincin jadi.

## Deferred decision

Jika integrasi snapshot lintas sistem diperlukan setelah MVP, Yii2 dapat
mengirim snapshot fakta order dan Main-ERP dapat menyimpan fulfillment plan.
MVP membaca fakta order yang sudah tersinkron di `legacy_orders` dan tidak
membutuhkan snapshot hash atau fulfillment plan durable.

## Consequences

Yii2 tetap tidak memiliki saldo inventory. Keputusan kompleks tentang snapshot
dan invalidasi plan ditunda; integrasi legacy tetap tidak berubah pada MVP.
