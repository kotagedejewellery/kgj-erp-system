import { komponenLabel } from "@/lib/legacy/komponen-labels";

type LegacyOrderComponents = { komponen: unknown };

export type SourceMaterialOption = {
  id: number;
  name: string;
};

export function sourceMaterialOptions(
  rows: LegacyOrderComponents[],
): SourceMaterialOption[] {
  const options = new Map<number, string>();

  for (const row of rows) {
    if (!Array.isArray(row.komponen)) continue;
    for (const component of row.komponen) {
      if (!component || typeof component !== "object") continue;
      const id = Number((component as { id_jenis_bahan?: unknown }).id_jenis_bahan);
      if (!Number.isInteger(id) || id <= 0) continue;
      const name = komponenLabel(id);
      if (!name || name.startsWith("#")) continue;
      options.set(id, name);
    }
  }

  return Array.from(options, ([id, name]) => ({ id, name }))
    .sort((first, second) => first.name.localeCompare(second.name) || first.id - second.id);
}

export function hasSourceMaterialId(
  rows: LegacyOrderComponents[],
  sourceMaterialId: number,
): boolean {
  return sourceMaterialOptions(rows).some((option) => option.id === sourceMaterialId);
}
