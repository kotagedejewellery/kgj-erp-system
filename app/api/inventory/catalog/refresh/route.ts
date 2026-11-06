import { NextResponse } from "next/server";
import { parseInventoryCatalogSnapshot } from "@/lib/inventory/catalog-reference";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";

const batchSize = 200;

function catalogUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/inventory-catalog`;
}

export async function POST() {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;

  const baseUrl = process.env.YII_CATALOG_BASE_URL;
  const syncKey = process.env.YII_CATALOG_SYNC_KEY;
  if (!baseUrl || !syncKey) {
    return NextResponse.json({ error: "Koneksi katalog Yii2 belum dikonfigurasi" }, { status: 409 });
  }

  let response: Response;
  try {
    response = await fetch(catalogUrl(baseUrl), {
      headers: { "X-Inventory-Catalog-Key": syncKey },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Katalog Yii2 tidak dapat dihubungi" }, { status: 502 });
  }
  if (!response.ok) {
    return NextResponse.json({ error: "Katalog Yii2 menolak pembaruan" }, { status: 502 });
  }

  let snapshot;
  try {
    snapshot = parseInventoryCatalogSnapshot(await response.json());
  } catch {
    return NextResponse.json({ error: "Data katalog Yii2 tidak sesuai kontrak" }, { status: 502 });
  }

  const seenAt = new Date().toISOString();
  const categories = snapshot.categories.map((category) => ({
    source_system: snapshot.source_system,
    source_category_id: category.source_category_id,
    name: category.name,
    image_url: category.image_url,
    source_available: true,
    last_seen_at: seenAt,
    updated_at: seenAt,
  }));
  const products = snapshot.products.map((product) => ({
    source_system: snapshot.source_system,
    source_product_id: product.source_product_id,
    sku: product.sku,
    name: product.name,
    is_published: product.is_published,
    legacy_primary_category_id: product.legacy_primary_category_id,
    category_ids: product.category_ids,
    cover_image_url: product.cover_image_url,
    source_available: true,
    last_seen_at: seenAt,
    updated_at: seenAt,
  }));

  for (let index = 0; index < categories.length; index += batchSize) {
    const { error } = await auth.admin
      .from("inventory_catalog_categories")
      .upsert(categories.slice(index, index + batchSize), { onConflict: "source_system,source_category_id" });
    if (error) return NextResponse.json({ error: "Referensi kategori katalog gagal disimpan" }, { status: 409 });
  }
  for (let index = 0; index < products.length; index += batchSize) {
    const { error } = await auth.admin
      .from("inventory_catalog_products")
      .upsert(products.slice(index, index + batchSize), { onConflict: "source_system,source_product_id" });
    if (error) return NextResponse.json({ error: "Referensi produk katalog gagal disimpan" }, { status: 409 });
  }

  const [categoriesResult, productsResult] = await Promise.all([
    auth.admin.from("inventory_catalog_categories").update({ source_available: false, updated_at: seenAt }).eq("source_system", snapshot.source_system).lt("last_seen_at", seenAt),
    auth.admin.from("inventory_catalog_products").update({ source_available: false, updated_at: seenAt }).eq("source_system", snapshot.source_system).lt("last_seen_at", seenAt),
  ]);
  if (categoriesResult.error || productsResult.error) {
    return NextResponse.json({ error: "Status referensi katalog gagal diperbarui" }, { status: 409 });
  }

  return NextResponse.json({
    success: true,
    categories: categories.length,
    products: products.length,
    snapshot_at: snapshot.snapshot_at,
  });
}
