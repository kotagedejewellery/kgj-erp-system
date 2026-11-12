import { NextResponse } from "next/server";
import { requireInventoryManagement } from "@/lib/inventory/management-auth";
import {
  resolveReadyStockImportRows,
  type ReadyStockCatalogCandidate,
  type ReadyStockModelSelection,
} from "@/lib/inventory/ready-stock-catalog-mapping";
import { getReadyStockImportTotal, validateReadyStockImportTotal } from "@/lib/inventory/ready-stock-import";

type ImportRow = { modelCode?: unknown; materialCode?: unknown; size?: unknown; quantity?: unknown };
type CatalogProduct = { source_product_id: number; sku: string | null; name: string; cover_image_url: string | null };
type SelectionInput = { modelCode?: unknown; sourceProductId?: unknown };

function parseRows(value: unknown) {
  if (!Array.isArray(value)) return { error: "Data impor tidak valid" } as const;
  const rows = value.map((row, index) => {
    const item = row as ImportRow;
    const modelCode = typeof item.modelCode === "string" ? item.modelCode.trim().toUpperCase() : "";
    const materialCode = typeof item.materialCode === "string" ? item.materialCode.trim().toUpperCase() : "";
    const size = typeof item.size === "string" ? item.size.trim() : "";
    const quantity = Number(item.quantity);
    return { row: index + 2, modelCode, materialCode, size, quantity };
  });
  if (rows.some((row) => !row.modelCode || !row.materialCode || !row.size || !Number.isInteger(row.quantity) || row.quantity <= 0)) {
    return { error: "Terdapat baris stok yang tidak valid" } as const;
  }
  return { rows } as const;
}

function parseSelections(value: unknown) {
  if (value === undefined) return { selections: [] as ReadyStockModelSelection[] } as const;
  if (!Array.isArray(value)) return { error: "Pilihan model tidak valid" } as const;
  const selections = value.map((entry) => {
    const item = entry as SelectionInput;
    return {
      modelCode: typeof item.modelCode === "string" ? item.modelCode.trim().toUpperCase() : "",
      sourceProductId: Number(item.sourceProductId),
    };
  });
  if (selections.some((selection) => !selection.modelCode || !Number.isInteger(selection.sourceProductId) || selection.sourceProductId <= 0)) {
    return { error: "Pilihan model tidak valid" } as const;
  }
  if (new Set(selections.map((selection) => selection.modelCode)).size !== selections.length) return { error: "Pilihan model duplikat" } as const;
  return { selections } as const;
}

async function validateImport(auth: { admin: any }, body: Record<string, unknown>) {
  const brandId = Number(body.brand_id);
  const sourceMaterialId = Number(body.source_material_id);
  const locationId = typeof body.location_id === "string" ? body.location_id : "";
  const parsed = parseRows(body.rows);
  const parsedSelections = parseSelections(body.model_selections);
  if ("error" in parsed || "error" in parsedSelections || !Number.isInteger(brandId) || brandId <= 0 || !Number.isInteger(sourceMaterialId) || sourceMaterialId <= 0 || !locationId) {
    return { error: parsed.error ?? parsedSelections.error ?? "Data impor tidak valid" } as const;
  }
  const totalError = validateReadyStockImportTotal(parsed.rows);
  if (totalError) return { error: totalError } as const;
  if (brandId !== 2) return { error: "Impor stok awal ini khusus untuk brand Hijaz" } as const;
  const [{ data: material }, { data: location }] = await Promise.all([
    auth.admin.from("inventory_materials").select("code, name, requires_unit_weight").eq("source_material_id", sourceMaterialId).eq("is_active", true).maybeSingle(),
    auth.admin.from("inventory_locations").select("id").eq("id", locationId).eq("location_type", "warehouse").eq("is_active", true).maybeSingle(),
  ]);
  if (!material) return { error: "Bahan ready-stock tidak tersedia" } as const;
  if (material.requires_unit_weight) return { error: "Impor ini hanya untuk bahan yang tidak mewajibkan berat per cincin" } as const;
  if (!location) return { error: "Gudang tujuan tidak tersedia" } as const;

  const materialErrors = parsed.rows.flatMap((row) => row.materialCode !== material.code.trim().toUpperCase()
    ? [`Baris ${row.row}: bahan ${row.materialCode} tidak sesuai dengan ${material.code}`]
    : []);
  const seen = new Set<string>();
  parsed.rows.forEach((row) => {
    const key = `${row.modelCode}|${row.size}`;
    if (seen.has(key)) materialErrors.push(`Baris ${row.row}: model dan ukuran duplikat`);
    seen.add(key);
  });
  if (materialErrors.length) return { error: "Validasi impor gagal", errors: materialErrors } as const;

  const productCodes = [...new Set(parsed.rows.map((row) => row.modelCode))];
  const { data: products, error: productsError } = await auth.admin
    .from("inventory_catalog_products")
    .select("source_product_id, sku, name, cover_image_url")
    .eq("source_system", "yii2")
    .eq("source_available", true)
    .eq("is_published", true)
    .in("sku", productCodes);
  if (productsError) return { error: "Katalog model belum dapat diverifikasi" } as const;
  const candidates = ((products ?? []) as CatalogProduct[]).flatMap((product) => product.sku ? [{
    sourceProductId: product.source_product_id,
    sku: product.sku,
    name: product.name,
    coverImageUrl: product.cover_image_url,
  } satisfies ReadyStockCatalogCandidate] : []);
  const resolved = resolveReadyStockImportRows(parsed.rows, candidates, parsedSelections.selections);
  return { brandId, sourceMaterialId, locationId, materialName: material.name, totalUnits: getReadyStockImportTotal(parsed.rows), resolved } as const;
}

export async function POST(request: Request) {
  const auth = await requireInventoryManagement();
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const result = await validateImport(auth, body);
  if ("error" in result) return NextResponse.json({ error: result.errors?.join("; ") ?? result.error }, { status: 400 });
  if (body.action === "preview") {
    return NextResponse.json({
      data: {
        materialName: result.materialName,
        totalUnits: result.totalUnits,
        rows: result.resolved.rows,
        candidates: result.resolved.candidates,
        mappingErrors: result.resolved.errors,
      },
    });
  }
  if (result.resolved.errors.length) return NextResponse.json({ error: result.resolved.errors.join("; ") }, { status: 400 });

  const batchCode = typeof body.batch_code === "string" ? body.batch_code.trim().toUpperCase() : "";
  if (!/^[A-Z0-9-]{3,50}$/.test(batchCode)) return NextResponse.json({ error: "Kode batch hanya boleh huruf, angka, dan tanda hubung" }, { status: 400 });
  const { data: created, error } = await auth.admin.rpc("inventory_import_ready_stock_opening", {
    p_batch_code: batchCode,
    p_brand_id: result.brandId,
    p_location_id: result.locationId,
    p_source_material_id: result.sourceMaterialId,
    p_rows: result.resolved.rows.map((row) => ({ source_product_id: row.sourceProductId, size: row.size, quantity: row.quantity })),
    p_actor_id: auth.actorId,
  });
  if (error) return NextResponse.json({ error: error.message.includes("batch_exists") ? "Batch ini sudah pernah diimpor" : "Gagal mengimpor stok awal" }, { status: 409 });
  return NextResponse.json({ data: { created } }, { status: 201 });
}
