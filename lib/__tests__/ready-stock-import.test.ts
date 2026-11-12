import { describe, expect, it } from "vitest";
import { getReadyStockImportTotal, parseReadyStockImportCsv, validateReadyStockImportTotal } from "@/lib/inventory/ready-stock-import";

describe("parseReadyStockImportCsv", () => {
  it("uses only positive Sisa Stok rows from the Stock Hijaz export", () => {
    expect(parseReadyStockImportCsv("Kode,Bahan,Ukuran,Sisa Stok\nS-02,PERAK,16,2\nS-03,PERAK,17,0\n")).toEqual({
      rows: [{ modelCode: "S-02", materialCode: "PERAK", size: "16", quantity: 2 }],
      errors: [],
    });
  });

  it("rejects malformed rows instead of guessing inventory data", () => {
    expect(parseReadyStockImportCsv("Kode,Bahan,Ukuran,Sisa Stok\nS-02,PERAK,16,1.5\n")).toEqual({
      rows: [],
      errors: ["Baris 2: Sisa Stok harus bilangan bulat nol atau lebih"],
    });
  });

  it("accepts a CSV export with a blank title row before the headers", () => {
    expect(parseReadyStockImportCsv("\nKode,Bahan,Ukuran,Sisa Stok\nS-02,PERAK,16,2\n")).toEqual({
      rows: [{ modelCode: "S-02", materialCode: "PERAK", size: "16", quantity: 2 }],
      errors: [],
    });
  });

  it("counts units and rejects an initial batch that is too large", () => {
    const rows = [{ modelCode: "S-02", materialCode: "PERAK", size: "16", quantity: 1001 }];
    expect(getReadyStockImportTotal(rows)).toBe(1001);
    expect(validateReadyStockImportTotal(rows)).toBe("Jumlah unit impor awal tidak boleh melebihi 1000 unit per batch");
  });
});
