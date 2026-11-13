import { NextRequest, NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import { parseReadyStockGalleryQuery } from "@/lib/inventory/ready-stock-gallery";
import type { ReadyStockGallerySummary } from "@/lib/inventory/ready-stock-summary";

type ModelGalleryRow = ReadyStockGallerySummary & { total_models: number | string };

export async function GET(request: NextRequest) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;

  const filters = parseReadyStockGalleryQuery(request.nextUrl.searchParams);
  const { data, error } = await auth.admin.rpc("inventory_ready_stock_model_gallery", {
    p_page: filters.page,
    p_page_size: filters.pageSize,
    p_query: filters.query || null,
  });
  if (error) return NextResponse.json({ error: "Gagal memuat ringkasan model ready-stock" }, { status: 409 });

  const rows = (data ?? []) as ModelGalleryRow[];
  return NextResponse.json({
    models: rows.map(({ total_models: _totalModels, ...model }) => model),
    meta: {
      page: filters.page,
      page_size: filters.pageSize,
      total: Number(rows[0]?.total_models ?? 0),
    },
  });
}
