import { NextResponse } from "next/server";
import { searchCatalogProducts } from "@/lib/inventory/catalog-products";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";

export async function GET(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;

  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ products: searchCatalogProducts(query) });
}
