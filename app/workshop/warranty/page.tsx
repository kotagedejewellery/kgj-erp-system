"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, FileUp, Loader2, Play, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import BrandHeader from "@/components/qr/BrandHeader";
import { fetcher, mutator } from "@/lib/api";

type WarrantyWork = {
  id: string;
  work_reference: string;
  claim_reference: string;
  benefit_code: string;
  condition_notes: string | null;
  status: "requested" | "in_progress" | "qc" | "completion_pending" | "cancellation_requested";
  requires_qc: boolean;
  requires_final_weight: boolean;
  requires_attachment: boolean;
  pic_id: string | null;
  attachment_ids: unknown[];
  order: { kode_order: string } | null;
};

type WorksResult = { data: WarrantyWork[] };
type MeResult = { data: { id: string; role: { name: string; permissions: Record<string, boolean> } } };

function statusLabel(status: WarrantyWork["status"]) {
  return {
    requested: "Menunggu PIC",
    in_progress: "Dikerjakan",
    qc: "Menunggu QC",
    completion_pending: "Menunggu Warranty Core",
    cancellation_requested: "Menunggu pembatalan",
  }[status];
}

export default function WorkshopWarrantyPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResult["data"] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [finalWeight, setFinalWeight] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const works = useQuery<WorksResult>({
    queryKey: ["warranty-works"],
    queryFn: () => fetcher<WorksResult>("/api/warranty/works"),
    retry: false,
  });

  useEffect(() => {
    fetch("/api/me")
      .then(async (response) => response.ok ? response.json() : null)
      .then((result: MeResult | null) => {
        if (!result?.data?.role?.permissions?.["warranty.work.update"]) {
          router.replace("/workshop/input");
          return;
        }
        setMe(result.data);
      })
      .catch(() => router.replace("/workshop/login"));
  }, [router]);

  async function updateWork(work: WarrantyWork, action: "start" | "send_qc" | "complete" | "approve_cancel" | "reject_cancel") {
    setBusy(`${work.id}:${action}`);
    setError("");
    try {
      await mutator("/api/warranty/works", {
        body: {
          work_id: work.id,
          action,
          final_weight_gram: action === "complete" && finalWeight ? Number(finalWeight) : undefined,
        },
      });
      setFinalWeight("");
      await works.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Warranty Work tidak dapat diperbarui");
    } finally {
      setBusy(null);
    }
  }

  async function uploadEvidence(work: WarrantyWork, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(`${work.id}:attachment`);
    setError("");
    const form = new FormData();
    form.set("file", file);
    try {
      await mutator(`/api/warranty/works/${encodeURIComponent(work.id)}/attachments`, { body: form });
      event.target.value = "";
      await works.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bukti kerja tidak dapat diunggah");
    } finally {
      setBusy(null);
    }
  }

  const selected = works.data?.data.find((work) => work.id === selectedId) ?? null;
  const isQc = me?.role.name === "qc_1" || me?.role.name === "qc_2";

  return (
    <div className="w-full max-w-[520px]">
      <BrandHeader subtitle="Warranty Work" />
      <div className="mb-4 flex items-center justify-between">
        <Link href="/workshop/input" className="inline-flex items-center gap-1 text-[12px] font-medium text-stone-500 hover:text-stone-700">
          <ChevronLeft className="h-4 w-4" /> Input produksi
        </Link>
        <span className="inline-flex items-center gap-1 text-[11px] text-stone-400"><ShieldCheck className="h-3.5 w-3.5" /> Terpisah dari order produksi</span>
      </div>

      {error && <p className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
      {works.isLoading && <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-amber-500" /></div>}
      {works.error && <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">{works.error instanceof Error ? works.error.message : "Warranty Work tidak dapat dimuat"}</p>}
      {works.data?.data.length === 0 && <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-[13px] text-stone-400">Belum ada Warranty Work yang perlu ditangani.</div>}

      <div className="space-y-3">
        {works.data?.data.map((work) => (
          <article key={work.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <button type="button" className="w-full text-left" onClick={() => setSelectedId(selectedId === work.id ? null : work.id)}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-mono text-[11px] font-semibold text-stone-500">{work.work_reference}</p><p className="mt-1 text-[14px] font-semibold text-stone-800">{work.benefit_code}</p><p className="mt-1 text-[11px] text-stone-400">{work.order?.kode_order ?? "—"} · {work.claim_reference}</p></div>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">{statusLabel(work.status)}</span>
              </div>
            </button>
            {selected?.id === work.id && (
              <div className="mt-4 border-t border-stone-100 pt-3">
                {work.condition_notes && <p className="text-[12px] leading-relaxed text-stone-600">{work.condition_notes}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-stone-500">
                  {work.requires_qc && <span className="rounded bg-stone-100 px-2 py-1">QC wajib</span>}
                  {work.requires_final_weight && <span className="rounded bg-stone-100 px-2 py-1">Berat akhir wajib</span>}
                  {work.requires_attachment && <span className="rounded bg-stone-100 px-2 py-1">Bukti wajib</span>}
                </div>
                {work.status === "requested" && <button type="button" disabled={busy !== null} onClick={() => updateWork(work, "start")} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"><Play className="h-3.5 w-3.5" /> Ambil pekerjaan</button>}
                {work.status === "in_progress" && work.pic_id === me?.id && <button type="button" disabled={busy !== null} onClick={() => updateWork(work, "send_qc")} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-stone-700 px-3 py-2 text-[12px] font-semibold text-white hover:bg-stone-800 disabled:opacity-50"><Send className="h-3.5 w-3.5" /> Kirim ke QC</button>}
                {(work.status === "qc" || work.status === "cancellation_requested") && isQc && (
                  <div className="mt-4 space-y-3">
                    {work.requires_attachment && <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-[12px] font-semibold text-amber-800 hover:bg-amber-50"><FileUp className="h-3.5 w-3.5" /> Unggah bukti ({work.attachment_ids.length})<input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" disabled={busy !== null} onChange={(event) => uploadEvidence(work, event)} /></label>}
                    {work.requires_final_weight && <label className="block text-[12px] font-medium text-stone-600">Berat akhir (gram)<input type="number" min="0.001" step="0.001" value={finalWeight} onChange={(event) => setFinalWeight(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-200 px-3 py-2 text-[13px] outline-none focus:border-amber-400" /></label>}
                    <button type="button" disabled={busy !== null || (work.requires_attachment && work.attachment_ids.length === 0) || (work.requires_final_weight && !finalWeight)} onClick={() => updateWork(work, "complete")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Selesaikan QC</button>
                  </div>
                )}
                {work.status === "completion_pending" && <p className="mt-3 text-[12px] text-amber-700">Menunggu Warranty Core mengonfirmasi Claim selesai.</p>}
                {work.status === "cancellation_requested" && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[12px] text-amber-700">After Sales meminta pembatalan Work ini.</p>
                    {work.pic_id === me?.id && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy !== null} onClick={() => updateWork(work, "approve_cancel")} className="rounded-lg border border-rose-300 px-3 py-2 text-[12px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Setujui pembatalan</button><button type="button" disabled={busy !== null} onClick={() => updateWork(work, "reject_cancel")} className="rounded-lg border border-stone-300 px-3 py-2 text-[12px] font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">Tolak pembatalan</button></div>}
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
