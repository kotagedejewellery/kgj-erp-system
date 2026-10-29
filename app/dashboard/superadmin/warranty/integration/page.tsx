"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, ShieldAlert, UserRoundCheck } from "lucide-react";
import Header from "@/components/layout/MobileHeader";
import Sidebar from "@/components/layout/MobileSidebar";
import { fetcher, mutator } from "@/lib/api";

type DeadLetter = {
  source: "activation" | "work";
  event_id: string;
  event_type: string;
  attempt_count: number;
  last_error: string | null;
  last_http_status: number | null;
  created_at: string;
  updated_at: string;
};

type UnresolvedException = {
  exception_request_id: string;
  claim_reference: string;
  reason: string;
  created_at: string;
};

type IntegrationResult = {
  data: {
    dead_letters: DeadLetter[];
    unresolved_exceptions: UnresolvedException[];
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function WarrantyIntegrationPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const integration = useQuery<IntegrationResult>({
    queryKey: ["warranty-integration"],
    queryFn: () => fetcher<IntegrationResult>("/api/warranty/integration"),
    retry: false,
  });

  useEffect(() => {
    fetch("/api/me").then(async (response) => response.ok ? response.json() : null).then((result) => {
      setUserName(result?.data?.username || result?.data?.full_name || "");
    }).catch(() => {});
  }, []);

  async function retry(deadLetter: DeadLetter) {
    setBusyId(deadLetter.event_id);
    setError("");
    try {
      await mutator("/api/warranty/integration", {
        body: { action: "retry_outbox", source: deadLetter.source, event_id: deadLetter.event_id },
      });
      await integration.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Event tidak dapat diantrekan ulang");
    } finally {
      setBusyId(null);
    }
  }

  async function recoverRequester(item: UnresolvedException) {
    setBusyId(item.exception_request_id);
    setError("");
    try {
      await mutator("/api/warranty/integration", {
        body: { action: "recover_exception_requester", exception_request_id: item.exception_request_id },
      });
      await integration.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Identitas pemohon tidak dapat dipulihkan");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#26211c] md:flex-row">
      <Sidebar role="superadmin" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={userName} role="superadmin" logoutPath="/login" onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="min-w-0 space-y-7">
            <header>
              <h1 className="text-xl font-bold text-ivory sm:text-2xl">Integrasi Garansi</h1>
              <p className="mt-1 max-w-3xl text-sm text-white/55">Pulihkan delivery yang berhenti tanpa mengubah event, Contract, kuota, atau workflow order.</p>
            </header>

            {error && <div role="alert" className="flex gap-2 rounded-lg border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
            {integration.isLoading && <p className="py-10 text-sm text-white/55">Memuat status integrasiâ€¦</p>}
            {integration.error && <p role="alert" className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100">{integration.error instanceof Error ? integration.error.message : "Status integrasi tidak dapat dimuat"}</p>}

            {integration.data && <>
              <section aria-labelledby="dead-letter-title">
                <div className="mb-3 flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-rose-200" /><div><h2 id="dead-letter-title" className="font-semibold text-[#f0f4ff]">Event dead-letter</h2><p className="mt-1 text-sm text-white/55">Replay mempertahankan event ID dan payload yang sama. Yii2 akan memprosesnya secara idempoten.</p></div></div>
                {integration.data.data.dead_letters.length === 0 ? <p className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-sm text-white/50">Tidak ada event Garansi yang berhenti.</p> : <div className="overflow-x-auto rounded-lg border border-white/10"><table className="min-w-full text-left text-sm"><thead className="bg-[#1C1917] text-xs text-white/45"><tr><th className="px-4 py-3 font-medium">Jenis</th><th className="px-4 py-3 font-medium">Event</th><th className="px-4 py-3 font-medium">Kegagalan terakhir</th><th className="px-4 py-3 font-medium">Aksi</th></tr></thead><tbody className="divide-y divide-white/10">{integration.data.data.dead_letters.map((item) => <tr key={`${item.source}-${item.event_id}`} className="bg-[#26211c]"><td className="px-4 py-3 text-[#e8e2d4]"><p>{item.event_type}</p><p className="mt-1 text-xs text-white/45">{item.source === "activation" ? "Aktivasi" : "Workshop / Exception"} Â· {item.attempt_count} percobaan</p></td><td className="px-4 py-3 text-xs text-white/55">{item.event_id}<p className="mt-1">{formatDate(item.updated_at)}</p></td><td className="max-w-sm px-4 py-3 text-xs text-rose-100">{item.last_error || "Tidak ada detail error"}{item.last_http_status ? ` (HTTP ${item.last_http_status})` : ""}</td><td className="px-4 py-3"><button type="button" disabled={busyId === item.event_id} onClick={() => retry(item)} className="inline-flex items-center gap-1.5 rounded-md border border-[#c9a227]/60 px-3 py-2 text-xs font-semibold text-[#e8e2d4] hover:bg-[#c9a227]/10 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />{busyId === item.event_id ? "Mengantrekanâ€¦" : "Antrekan ulang"}</button></td></tr>)}</tbody></table></div>}
              </section>

              <section aria-labelledby="exception-recovery-title">
                <div className="mb-3 flex items-start gap-3"><UserRoundCheck className="mt-0.5 h-5 w-5 text-amber-200" /><div><h2 id="exception-recovery-title" className="font-semibold text-[#f0f4ff]">Exception tanpa identitas pemohon</h2><p className="mt-1 text-sm text-white/55">SPV tidak dapat memutuskan request ini hingga identitas pemohon dipulihkan dari audit yang sama.</p></div></div>
                {integration.data.data.unresolved_exceptions.length === 0 ? <p className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-sm text-white/50">Seluruh Exception pending memiliki pemohon yang dapat diaudit.</p> : <div className="space-y-3">{integration.data.data.unresolved_exceptions.map((item) => <article key={item.exception_request_id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-amber-300/25 bg-[#1C1917] p-4"><div><p className="font-medium text-[#f0f4ff]">{item.claim_reference}</p><p className="mt-1 text-xs text-white/50">{item.exception_request_id} Â· {formatDate(item.created_at)}</p><p className="mt-3 text-sm text-[#e8e2d4]">{item.reason}</p></div><button type="button" disabled={busyId === item.exception_request_id} onClick={() => recoverRequester(item)} className="inline-flex items-center gap-1.5 rounded-md border border-[#c9a227]/60 px-3 py-2 text-xs font-semibold text-[#e8e2d4] hover:bg-[#c9a227]/10 disabled:opacity-50"><UserRoundCheck className="h-3.5 w-3.5" />{busyId === item.exception_request_id ? "Memulihkanâ€¦" : "Pulihkan identitas"}</button></article>)}</div>}
              </section>
            </>}
          </div>
        </main>
      </div>
    </div>
  );
}
