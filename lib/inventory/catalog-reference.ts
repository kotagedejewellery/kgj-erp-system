import { z } from "zod";

const nullableText = z.string().min(1).nullable();

const categorySchema = z.object({
  source_category_id: z.number().int().positive(),
  name: z.string().trim().min(1),
  image_url: nullableText,
});

const productSchema = z.object({
  source_product_id: z.number().int().positive(),
  sku: nullableText,
  name: z.string().trim().min(1),
  is_published: z.boolean(),
  legacy_primary_category_id: z.number().int().positive().nullable(),
  category_ids: z.array(z.number().int().positive()),
  cover_image_url: nullableText,
});

const snapshotSchema = z.object({
  contract_version: z.literal(1),
  source_system: z.literal("yii2"),
  snapshot_at: z.string().trim().min(1),
  categories: z.array(categorySchema),
  products: z.array(productSchema),
}).superRefine((snapshot, context) => {
  const categoryIds = new Set<number>();
  for (const category of snapshot.categories) {
    if (categoryIds.has(category.source_category_id)) {
      context.addIssue({ code: "custom", message: "ID kategori katalog duplikat" });
      break;
    }
    categoryIds.add(category.source_category_id);
  }

  const productIds = new Set<number>();
  for (const product of snapshot.products) {
    if (productIds.has(product.source_product_id)) {
      context.addIssue({ code: "custom", message: "ID produk katalog duplikat" });
      break;
    }
    productIds.add(product.source_product_id);
  }
});

export type InventoryCatalogSnapshot = z.infer<typeof snapshotSchema>;

export function parseInventoryCatalogSnapshot(value: unknown): InventoryCatalogSnapshot {
  return snapshotSchema.parse(value);
}
