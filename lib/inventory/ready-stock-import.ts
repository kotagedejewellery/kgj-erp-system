export type ReadyStockImportRow = {
  modelCode: string;
  materialCode: string;
  size: string;
  quantity: number;
};

const MAX_INITIAL_READY_STOCK_UNITS = 1000;

export function getReadyStockImportTotal(rows: readonly Pick<ReadyStockImportRow, "quantity">[]): number {
  return rows.reduce((total, row) => total + row.quantity, 0);
}

export function validateReadyStockImportTotal(rows: readonly Pick<ReadyStockImportRow, "quantity">[]): string | null {
  return getReadyStockImportTotal(rows) > MAX_INITIAL_READY_STOCK_UNITS
    ? `Jumlah unit impor awal tidak boleh melebihi ${MAX_INITIAL_READY_STOCK_UNITS} unit per batch`
    : null;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [[]];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; } else quoted = !quoted;
    } else if (character === "," && !quoted) { rows.at(-1)!.push(field); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      rows.at(-1)!.push(field); rows.push([]); field = "";
    } else field += character;
  }
  rows.at(-1)!.push(field);
  return rows.filter((row) => row.some((value) => value.trim()));
}

export function parseReadyStockImportCsv(text: string): { rows: ReadyStockImportRow[]; errors: string[] } {
  const csv = parseCsv(text.replace(/^\uFEFF/, ""));
  const headers = csv.shift()?.map((header) => header.trim().toLowerCase()) ?? [];
  const indexes = {
    modelCode: headers.indexOf("kode"),
    materialCode: headers.indexOf("bahan"),
    size: headers.indexOf("ukuran"),
    quantity: headers.indexOf("sisa stok"),
  };
  if (Object.values(indexes).some((index) => index < 0)) return { rows: [], errors: ["Kolom CSV wajib: Kode, Bahan, Ukuran, dan Sisa Stok"] };

  const rows: ReadyStockImportRow[] = [];
  const errors: string[] = [];
  csv.forEach((line, index) => {
    const row = index + 2;
    const modelCode = line[indexes.modelCode]?.trim().toUpperCase() ?? "";
    const materialCode = line[indexes.materialCode]?.trim().toUpperCase() ?? "";
    const size = line[indexes.size]?.trim() ?? "";
    const quantityRaw = line[indexes.quantity]?.trim() ?? "";
    if (!modelCode && !materialCode && !size && !quantityRaw) return;
    if (!modelCode || !materialCode || !size) { errors.push(`Baris ${row}: Kode, Bahan, dan Ukuran wajib diisi`); return; }
    if (!/^\d+$/.test(quantityRaw)) { errors.push(`Baris ${row}: Sisa Stok harus bilangan bulat nol atau lebih`); return; }
    const quantity = Number(quantityRaw);
    if (quantity > 0) rows.push({ modelCode, materialCode, size, quantity });
  });
  return { rows, errors };
}
