# ADR 0002: Yii2 owns the catalog; Main-ERP owns physical inventory

Status: Accepted

Yii2 remains the canonical owner of product, category, SKU, publication, and
catalog-cover data. Main-ERP will keep a read-only catalog reference snapshot
only to select and display products in Inventory; it remains the sole owner of
physical stock units, material balances, WIP, locations, mutations, returns,
and inventory audit. The catalog sync is a manually triggered full snapshot,
separate from order webhooks and status callbacks, so it cannot change orders,
stages, approvals, rework, payments, or inventory mutations.

## Consequences

Main-ERP identifies catalog products by `(source_system, source_product_id)`.
SKU and model codes are display attributes only. A Yii2 product becoming
unpublished or absent from a successfully received snapshot is marked
unavailable in Main-ERP; no physical unit, mutation, or audit record is
deleted. Creating a physical stock unit remains an explicit Main-ERP action.
