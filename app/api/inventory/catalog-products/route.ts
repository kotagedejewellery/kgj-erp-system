import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";

export async function GET(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;

  const searchParams = new URL(request.url).searchParams;
  const query = (searchParams.get("q") ?? "").trim();
  const productId = Number(searchParams.get("id"));
  if (!Number.isInteger(productId) || productId <= 0) {
    if (query.length < 2) return NextResponse.json({ products: [] });
  }

  let catalogQuery = auth.admin
    .from("inventory_catalog_products")
    .select("source_product_id, sku, name, cover_image_url")
    .eq("source_system", "yii2")
    .eq("source_available", true)
    .eq("is_published", true);
  if (Number.isInteger(productId) && productId > 0) {
    catalogQuery = catalogQuery.eq("source_product_id", productId);
  } else {
    catalogQuery = catalogQuery.or(`name.ilike.%${query}%,sku.ilike.%${query}%`).order("name").limit(20);
  }
  const { data, error } = await catalogQuery;
  if (error) return NextResponse.json({ error: "Katalog belum diperbarui" }, { status: 409 });

  return NextResponse.json({
    products: (data ?? []).map((product) => ({
      id: product.source_product_id,
      label: product.sku ? `${product.sku} — ${product.name}` : product.name,
      cover_image_url: product.cover_image_url,
    })),
  });
}
