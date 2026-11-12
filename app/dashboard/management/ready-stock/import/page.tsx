"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { fetcher, mutator } from "@/lib/api";
import { getReadyStockImportTotal, parseReadyStockImportCsv, type ReadyStockImportRow } from "@/lib/inventory/ready-stock-import";
import { MANAGEMENT_ROUTES } from "@/lib/routes";

type Data = {
  locations: { id: string; name: string }[];
  materials: { code: string; name: string; source_material_id: number; requires_unit_weight: boolean }[];
};

type CatalogCandidate = {
  sourceProductId: number;
  sku: string;
  name: string;
  coverImageUrl: string | null;
};

type ModelCandidates = {
  modelCode: string;
  candidates: CatalogCandidate[];
  selectedSourceProductId: number | null;
};

type Preview = {
  rows: { modelCode: string; modelName: string; size: string; quantity: number }[];
  materialName: string;
  totalUnits: number;
  candidates: ModelCandidates[];
  mappingErrors: string[];
};

const inputClass = "mt-1 w-full rounded border border-gold/20 bg-carbon p-2 text-sm text-cream";
const HIJAZ_BRAND_ID = "2";

export default function ReadyStockImportPage() {
  const [rows, setRows] = useState<ReadyStockImportRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [modelSelections, setModelSelections] = useState<Record<string, string>>({});
  const [locationId, setLocationId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [batchCode, setBatchCode] = useState("HJZ-AWAL-2026");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data, error, isLoading } = useQuery<Data>({
    queryKey: ["ready-stock"],
    queryFn: () => fetcher("/api/inventory/ready-stock"),
  });
  const eligibleMaterials = data?.materials.filter((material) => !material.requires_unit_weight) ?? [];
  const modelSelectionsPayload = Object.entries(modelSelections)
    .filter(([, sourceProductId]) => sourceProductId)
    .map(([modelCode, sourceProductId]) => ({ modelCode, sourceProductId: Number(sourceProductId) }));

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreview(null);
    setModelSelections({});
    setMessage("");
    if (!file) return;
    const parsed = parseReadyStockImportCsv(await file.text());
    setRows(parsed.rows);
    setCsvErrors(parsed.errors);
  };

  const previewImport = async () => {
    setMessage("");
    setPreview(null);
    setIsSubmitting(true);
    try {
      const result = await mutator<{ data: Preview }>("/api/inventory/ready-stock/import", {
        method: "POST",
        body: {
          action: "preview",
          brand_id: HIJAZ_BRAND_ID,
          location_id: locationId,
          source_material_id: materialId,
          model_selections: modelSelectionsPayload,
          rows,
        },
      });
      setPreview(result.data);
      setModelSelections((current) => Object.fromEntries(result.data.candidates.map((candidate) => [
        candidate.modelCode,
        current[candidate.modelCode] ?? String(candidate.selectedSourceProductId ?? ""),
      ])));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Validasi impor gagal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const importStock = async () => {
    setMessage("");
    setIsSubmitting(true);
    try {
      const result = await mutator<{ data: { created: number } }>("/api/inventory/ready-stock/import", {
        method: "POST",
        body: {
          brand_id: HIJAZ_BRAND_ID,
          location_id: locationId,
          source_material_id: materialId,
          batch_code: batchCode,
          model_selections: modelSelectionsPayload,
          rows,
        },
      });
      setMessage(`${result.data.created} unit cincin berhasil dicatat sebagai stok awal.`);
      setRows([]);
      setPreview(null);
      setModelSelections({});
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Impor stok awal gagal");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="inventory-management flex min-h-screen bg-night">
      <Sidebar role="management" />
      <div className="min-w-0 flex-1">
        <Header userEmail="" role="management" />
        <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-ivory">Impor stok awal ready-stock</h1>
              <p className="mt-1 text-sm text-white/50">Untuk stok yang dikelola per jumlah unit tanpa timbang, seperti cincin Perak Hijaz.</p>
            </div>
            <Link href={MANAGEMENT_ROUTES.READY_STOCK} className="text-sm font-medium text-gold underline underline-offset-4">Kembali ke Ready-stock</Link>
          </div>
          {message && <p role="status" className="rounded-lg border border-gold/20 bg-cocoa p-3 text-sm text-cream">{message}</p>}
          {error ? <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">Gagal memuat data import.</p> : isLoading ? <div className="h-72 animate-pulse rounded-lg bg-cocoa" /> : (
            <section className="space-y-4 rounded-lg border border-gold/15 bg-cocoa p-4">
              <div>
                <h2 className="font-semibold text-cream">1. Unggah dan validasi file</h2>
                <p className="mt-1 text-sm text-white/50">Perbarui katalog di halaman Ready-stock sebelum mengunggah CSV. Gunakan tab Stock Hijaz dengan kolom: Kode, Bahan, Ukuran, Sisa Stok. Baris dengan stok 0 diabaikan.</p>
              </div>
              <input type="file" accept=".csv,text/csv" onChange={loadFile} className="block w-full text-sm text-cream file:mr-3 file:rounded file:border-0 file:bg-gold file:px-3 file:py-2 file:text-sm file:font-medium file:text-night" />
              {csvErrors.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-rose-200">{csvErrors.map((item) => <li key={item}>{item}</li>)}</ul>}
              {rows.length > 0 && <p className="text-sm text-emerald-200">{rows.length} kombinasi model/ukuran, total {getReadyStockImportTotal(rows)} unit, siap divalidasi.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <p className="text-sm text-cream">Brand<span className="mt-1 block rounded border border-gold/20 bg-night p-2 text-cream">Hijaz</span></p>
                <label className="text-sm text-cream">Gudang tujuan<select value={locationId} onChange={(event) => { setLocationId(event.target.value); setPreview(null); }} className={inputClass}><option value="">Pilih gudang</option>{data?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                <label className="text-sm text-cream">Bahan<select value={materialId} onChange={(event) => { setMaterialId(event.target.value); setPreview(null); }} className={inputClass}><option value="">Pilih bahan</option>{eligibleMaterials.map((material) => <option key={material.source_material_id} value={material.source_material_id}>{material.code} — {material.name}</option>)}</select><span className="mt-1 block text-xs text-white/45">Hanya bahan dengan berat unit tidak wajib yang dapat memakai impor ini.</span></label>
                <label className="text-sm text-cream">Kode batch impor<input value={batchCode} onChange={(event) => { setBatchCode(event.target.value.toUpperCase()); setPreview(null); }} className={inputClass} /><span className="mt-1 block text-xs text-white/45">Gunakan sekali. Kode yang sama tidak dapat diimpor ulang.</span></label>
              </div>
              <button type="button" onClick={previewImport} disabled={isSubmitting || !rows.length || csvErrors.length > 0 || !locationId || !materialId} className="rounded bg-gold px-3 py-2 text-sm font-medium text-night disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Memvalidasi..." : "Tampilkan preview"}</button>
            </section>
          )}
          {preview && (
            <section className="space-y-4 rounded-lg border border-gold/25 bg-cocoa p-4">
              <div>
                <h2 className="font-semibold text-cream">2. Cocokkan model katalog</h2>
                <p className="mt-1 text-sm text-white/50">Model dengan satu kandidat dipilih otomatis. Jika kandidat lebih dari satu, pilih berdasarkan nama dan gambar sebelum mengimpor.</p>
              </div>
              {preview.candidates.map((model) => (
                <div key={model.modelCode} className="rounded border border-gold/10 bg-night/30 p-3">
                  <p className="text-sm font-medium text-cream">Kode CSV: {model.modelCode}</p>
                  {model.candidates.length === 0 ? <p className="mt-2 text-sm text-rose-200">Tidak ada model published yang cocok. Periksa kode CSV atau katalog Yii2.</p> : model.candidates.length === 1 ? <CatalogCandidate candidate={model.candidates[0]} /> : <label className="mt-2 block text-sm text-cream">Pilih model yang benar<select value={modelSelections[model.modelCode] ?? ""} onChange={(event) => setModelSelections((current) => ({ ...current, [model.modelCode]: event.target.value }))} className={inputClass}><option value="">Pilih model</option>{model.candidates.map((candidate) => <option key={candidate.sourceProductId} value={candidate.sourceProductId}>{candidate.name} (ID {candidate.sourceProductId})</option>)}</select></label>}
                  {model.candidates.length > 1 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{model.candidates.map((candidate) => <CatalogCandidate key={candidate.sourceProductId} candidate={candidate} />)}</div>}
                </div>
              ))}
              {preview.mappingErrors.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">{preview.mappingErrors.map((mappingError) => <li key={mappingError}>{mappingError}</li>)}</ul>}
              {preview.mappingErrors.length > 0 && <button type="button" onClick={previewImport} disabled={isSubmitting} className="rounded border border-gold/35 px-3 py-2 text-sm font-medium text-gold disabled:cursor-not-allowed disabled:opacity-60">Perbarui preview setelah memilih model</button>}
              {preview.rows.length > 0 && <><div><h2 className="font-semibold text-cream">3. Konfirmasi impor</h2><p className="mt-1 text-sm text-white/50">{preview.materialName} dicatat tanpa berat per unit.</p><p className="mt-2 text-base font-semibold text-amber-100">Total yang akan dibuat: {preview.totalUnits} unit cincin.</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-white/45"><tr><th className="p-2">Kode</th><th>Model</th><th>Ukuran</th><th className="text-right">Unit</th></tr></thead><tbody>{preview.rows.slice(0, 12).map((row) => <tr key={`${row.modelCode}-${row.size}`} className="border-t border-white/5 text-cream"><td className="p-2">{row.modelCode}</td><td>{row.modelName}</td><td>{row.size}</td><td className="text-right">{row.quantity}</td></tr>)}</tbody></table></div>{preview.rows.length > 12 && <p className="text-sm text-white/50">Menampilkan 12 dari {preview.rows.length} baris valid.</p>}<button type="button" onClick={importStock} disabled={isSubmitting} className="rounded bg-gold px-3 py-2 text-sm font-medium text-night disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Mengimpor..." : `Konfirmasi dan catat ${preview.totalUnits} unit`}</button></>}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function CatalogCandidate({ candidate }: { candidate: CatalogCandidate }) {
  return <div className="mt-2 flex items-center gap-3 rounded border border-white/10 p-2 text-sm text-cream">{candidate.coverImageUrl ? <img src={candidate.coverImageUrl} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded bg-cocoa text-xs text-white/40">Tanpa foto</div>}<span>{candidate.name}<span className="block text-xs text-white/45">ID {candidate.sourceProductId}</span></span></div>;
}
