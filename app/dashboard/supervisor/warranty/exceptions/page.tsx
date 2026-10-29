"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, CircleAlert, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Header from "@/components/layout/MobileHeader";
import Sidebar from "@/components/layout/MobileSidebar";
import { fetcher, mutator } from "@/lib/api";

type ExceptionRequest = {
  exception_request_id: string;
  claim_reference: string;
  reason: string;
  requested_by: string | null;
  created_at: string;
  order: { kode_order: string } | null;
};

type Result = { data: ExceptionRequest[] };
type Decision = "approved" | "rejected";

export default function WarrantyExceptionsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [selected, setSelected] = useState<ExceptionRequest | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requests = useQuery<Result>({ queryKey: ["warranty-exceptions"], queryFn: () => fetcher<Result>("/api/warranty/exceptions"), retry: false });

  useEffect(() => {
    fetch("/api/me").then(async (response) => response.ok ? response.json() : null).then((result) => {
      if (!result?.data?.role?.permissions?.["warranty.exception.decide"]) {
        router.replace("/dashboard/supervisor/bottleneck");
        return;
      }
      setUserName(result.data.username || result.data.full_name || "");
    }).catch(() => router.replace("/workshop/login"));
  }, [router]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim()) setDecision("approved");
  }

  async function decide() {
    if (!selected || !decision || !reason.trim()) return;
    setBusy(true);
    setError("");
    try {
      await mutator("/api/warranty/exceptions", { body: { exception_request_id: selected.exception_request_id, decision, reason: reason.trim() } });
      setSelected(null);
      setDecision(null);
      setReason("");
      await requests.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Keputusan Exception tidak dapat disimpan");
      setDecision(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#26211c] md:flex-row">
      <Sidebar role="supervisor" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={userName} role="supervisor" logoutPath="/workshop/login" onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="min-w-0 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-bold text-ivory sm:text-2xl">Exception Garansi</h1><p className="mt-1 text-sm text-white/55">Setujui atau tolak tambahan kuota tanpa mengubah kuota lokal.</p></div><Link href="/dashboard/supervisor/warranty" className="inline-flex items-center gap-1 text-xs font-medium text-[#c9a227] hover:text-[#dfbb40]"><ChevronLeft className="h-4 w-4" /> Garansi</Link></div>
            {error && <div className="flex gap-2 rounded-lg border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
            {requests.isLoading && <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-[#c9a227]" /></div>}
            {requests.error && <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">{requests.error instanceof Error ? requests.error.message : "Permintaan Exception tidak dapat dimuat"}</div>}
            {requests.data?.data.length === 0 && <div className="rounded-lg border border-dashed border-white/15 bg-[#1C1917] px-4 py-10 text-center text-sm text-white/50">Tidak ada Exception Garansi yang menunggu keputusan.</div>}
            <div className="space-y-3">{requests.data?.data.map((item) => <article key={item.exception_request_id} className="rounded-lg border border-white/10 bg-[#1C1917] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-[#f0f4ff]">{item.claim_reference}</p><p className="mt-1 text-xs text-white/50">{item.order?.kode_order ?? "Order tidak tersedia"} · {item.exception_request_id}</p></div>{item.requested_by ? <button type="button" onClick={() => { setSelected(item); setReason(""); }} className="rounded-md bg-[#c9a227] px-3 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#dfbb40]">Tinjau</button> : <span className="rounded-md border border-amber-300/35 px-3 py-2 text-xs text-amber-100">Menunggu pemulihan identitas</span>}</div><p className="mt-3 text-sm text-[#e8e2d4]">{item.reason}</p>{!item.requested_by && <p className="mt-3 text-xs text-amber-100">Keputusan dikunci demi mencegah self-approval. Superadmin perlu memulihkan identitas pemohon dari audit.</p>}</article>)}</div>
          </div>
        </main>
      </div>
      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"><form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-white/10 bg-[#2a2522] p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-[#f0f4ff]">Keputusan Exception</h2><p className="mt-1 text-xs text-white/50">{selected.claim_reference} · {selected.exception_request_id}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded p-1 text-white/50 hover:bg-white/5"><X className="h-4 w-4" /></button></div><p className="mt-4 text-sm text-[#e8e2d4]">{selected.reason}</p><label className="mt-4 block text-xs text-white/55">Alasan keputusan<textarea required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full resize-y rounded-md border border-white/10 bg-[#1C1917] px-3 py-2 text-sm text-[#e8e2d4] outline-none focus:border-[#c9a227]/60" /></label><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy || !reason.trim()} onClick={() => setDecision("rejected")} className="rounded-md border border-rose-300/40 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/10 disabled:opacity-50">Tolak</button><button type="submit" disabled={busy || !reason.trim()} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#15221a] hover:bg-emerald-400 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Setujui</button></div></form></div>}
      <ConfirmDialog isOpen={decision !== null} title={decision === "approved" ? "Setujui Exception?" : "Tolak Exception?"} message={decision === "approved" ? "Yii2 akan memvalidasi dan bila masih memenuhi syarat, membuat Grant serta reservation secara kanonik." : "Permintaan ditolak tanpa menambah kuota."} confirmText={decision === "approved" ? "Setujui" : "Tolak"} variant={decision === "approved" ? "warning" : "danger"} isLoading={busy} onConfirm={decide} onCancel={() => setDecision(null)} />
    </div>
  );
}
