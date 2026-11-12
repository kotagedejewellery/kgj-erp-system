export type ReadyStockCatalogCandidate = {
  sourceProductId: number;
  sku: string;
  name: string;
  coverImageUrl: string | null;
};

export type ReadyStockModelSelection = {
  modelCode: string;
  sourceProductId: number;
};

type ImportRow = {
  row: number;
  modelCode: string;
  materialCode: string;
  size: string;
  quantity: number;
};

export function resolveReadyStockImportRows<T extends ImportRow>(
  rows: readonly T[],
  products: readonly ReadyStockCatalogCandidate[],
  selections: readonly ReadyStockModelSelection[],
) {
  const candidatesByCode = new Map<string, ReadyStockCatalogCandidate[]>();
  products.forEach((product) => {
    const code = product.sku.trim().toUpperCase();
    const candidates = candidatesByCode.get(code) ?? [];
    candidates.push(product);
    candidatesByCode.set(code, candidates);
  });
  const selectionByCode = new Map(selections.map((selection) => [selection.modelCode.trim().toUpperCase(), selection.sourceProductId]));
  const modelCodes = [...new Set(rows.map((row) => row.modelCode))];
  const errors: string[] = [];
  const selectedByCode = new Map<string, ReadyStockCatalogCandidate>();
  const candidates = modelCodes.map((modelCode) => {
    const options = (candidatesByCode.get(modelCode) ?? []).sort((left, right) => left.sourceProductId - right.sourceProductId);
    const selectedSourceProductId = selectionByCode.get(modelCode);
    const selected = selectedSourceProductId === undefined
      ? options.length === 1 ? options[0] : undefined
      : options.find((option) => option.sourceProductId === selectedSourceProductId);
    if (!options.length) errors.push(`Model ${modelCode} tidak ditemukan di katalog aktif`);
    else if (selectedSourceProductId !== undefined && !selected) errors.push(`Pilihan model untuk ${modelCode} tidak valid`);
    else if (!selected) errors.push(`Kode ${modelCode} memiliki lebih dari satu model katalog. Pilih model yang benar.`);
    if (selected) selectedByCode.set(modelCode, selected);
    return { modelCode, candidates: options, selectedSourceProductId: selected?.sourceProductId ?? null };
  });

  return {
    rows: errors.length ? [] : rows.map((row) => {
      const product = selectedByCode.get(row.modelCode)!;
      return { ...row, sourceProductId: product.sourceProductId, modelName: product.name };
    }),
    candidates,
    errors,
  };
}
