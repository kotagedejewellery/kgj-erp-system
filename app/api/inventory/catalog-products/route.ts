import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";

export async function GET(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;

  const query = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (query.length < 2) return NextResponse.json({ products: [] });

  const { data, error } = await auth.admin
    .from("inventory_catalog_products")
    .select("source_product_id, sku, name, cover_image_url")
    .eq("source_system", "yii2")
    .eq("source_available", true)
    .eq("is_published", true)
    .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
    .order("name")
    .limit(20);
  if (error) return NextResponse.json({ error: "Katalog belum diperbarui" }, { status: 409 });

  return NextResponse.json({
    products: (data ?? []).map((product) => ({
      id: product.source_product_id,
      label: product.sku ? `${product.sku} — ${product.name}` : product.name,
      cover_image_url: product.cover_image_url,
    })),
  });
}
