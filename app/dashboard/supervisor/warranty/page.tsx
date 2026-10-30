"use client";

import { FormEvent, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CircleAlert, Search, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, fetcher } from "@/lib/api";
import Header from "@/components/layout/MobileHeader";
import Sidebar from "@/components/layout/MobileSidebar";
import WarrantyClaimActions, { type WarrantyEntitlement } from "@/components/warranty/WarrantyClaimActions";

type Entitlement = WarrantyEntitlement & {
  quota_initial?: number;
  quota_used?: number;
  quota_reserved?: number;
  approved_grant?: number;
};

type ClaimSummary = {
  reference: string;
  status: string;
  claim_version: number;
  condition_notes: string | null;
  work_reference: string | null;
  updated_at: string;
};

type Contract = {
  reference: string;
  order_reference: string;
  customer_name: string | null;
  customer_phone: string | null;
  unit_code: string;
  brand_code: string;
  plan_code: string;
  expires_at: string;
  starting_weight_gram?: string | null;
  latest_weight_gram?: string | null;
  status: string;
  entitlements: Entitlement[];
};

type SearchResult = {
  data: {
    items: Contract[];
    pagination: { page: number; page_size: number; total: number };
  };
};

type ContractDetailResult = {
  data: { contract: Contract; entitlements: Entitlement[]; claims: ClaimSummary[] };
};

type ClaimDetailResult = {
  data: {
    claim: { reference: string; status: string; claim_version: number; condition_notes: string | null; repair_notes: string | null; final_weight_gram: string | null; work_reference: string | null; updated_at: string };
    contract: { reference: string };
    entitlement: Entitlement;
    attachments: { id: string; original_name: string; mime_type: string; file_size_bytes: number; state: string }[];
    audit_events: { event_type: string; actor_display_name: string | null; created_at: string }[];
  };
};

type WarrantySummary = {
  data: {
    active_contracts: number;
    expiring_within_30_days: number;
    active_works: number;
    pending_exceptions: number;
    failed_outbox: number;
    dead_letter_outbox: number;
    last_synced_at: string | null;
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function WarrantyWorklist({ role = "supervisor" }: { role?: "supervisor" | "after_sales" }) {
  const router = useRouter();
  const loginPath = role === "after_sales" ? "/login" : "/workshop/login";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedContract, setSelectedContract] = useState<string | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [canReadClaim, setCanReadClaim] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (!result?.data) {
          router.push(loginPath);
          return;
        }
        setUserName(result.data.username || result.data.full_name || "");
        setCanReadClaim(result.data.role?.permissions?.["warranty.claim.read"] === true || result.data.role?.name === "superadmin");
      })
      .catch(() => router.push(loginPath));
  }, [loginPath, router]);

  const search = useQuery<SearchResult>({
    queryKey: ["warranty-contracts", term, page],
    queryFn: () => fetcher<SearchResult>(`/api/warranty/contracts?query=${encodeURIComponent(term)}&page=${page}`),
    enabled: Boolean(term),
    retry: false,
  });
  const contractDetail = useQuery<ContractDetailResult>({
    queryKey: ["warranty-contract", selectedContract],
    queryFn: () => fetcher<ContractDetailResult>(`/api/warranty/contracts/${encodeURIComponent(selectedContract ?? "")}`),
    enabled: Boolean(selectedContract),
    retry: false,
  });
  const claimDetail = useQuery<ClaimDetailResult>({
    queryKey: ["warranty-claim", selectedClaim],
    queryFn: () => fetcher<ClaimDetailResult>(`/api/warranty/claims/${encodeURIComponent(selectedClaim ?? "")}`),
    enabled: Boolean(selectedClaim) && canReadClaim,
    retry: false,
  });
  const summary = useQuery<WarrantySummary>({
    queryKey: ["warranty-summary"],
    queryFn: () => fetcher<WarrantySummary>("/api/warranty/summary"),
    enabled: role === "supervisor",
    retry: false,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextTerm = input.trim();
    if (!nextTerm) return;
    setPage(1);
    setTerm(nextTerm);
  }

  const pagination = search.data?.data.pagination;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.page_size)) : 1;

  return (
    <div className="flex h-screen flex-col bg-[#26211c] md:flex-row">
      <Sidebar role={role} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userEmail={userName} role={role} logoutPath={loginPath} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="min-w-0 space-y-5">
            <div>
              <h1 className="text-xl font-bold text-ivory sm:text-2xl">Cari Contract Garansi</h1>
              <p className="mt-1 text-sm text-white/65">Cari Contract aktif berdasarkan pelanggan, telepon, nomor order, atau referensi Contract.</p>
            </div>

            {role === "supervisor" && summary.data && (
              <section className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-white/10 bg-[#1C1917] p-4"><p className="text-xs text-white/45">Contract aktif</p><p className="mt-2 text-2xl font-semibold text-[#f0f4ff]">{summary.data.data.active_contracts}</p><p className="mt-1 text-xs text-amber-200">{summary.data.data.expiring_within_30_days} berakhir ≤ 30 hari</p></div>
                  <div className="rounded-lg border border-white/10 bg-[#1C1917] p-4"><p className="text-xs text-white/45">Work aktif</p><p className="mt-2 text-2xl font-semibold text-[#f0f4ff]">{summary.data.data.active_works}</p><p className="mt-1 text-xs text-white/50">PIC, proses, QC, atau konfirmasi Core</p></div>
                  <Link href="/dashboard/supervisor/warranty/exceptions" className="rounded-lg border border-[#c9a227]/30 bg-[#1C1917] p-4 transition-colors hover:bg-[#2a2522]"><p className="text-xs text-white/45">Exception menunggu SPV</p><p className="mt-2 text-2xl font-semibold text-[#c9a227]">{summary.data.data.pending_exceptions}</p><p className="mt-1 text-xs text-white/50">Buka untuk mengambil keputusan</p></Link>
                  <div className={`rounded-lg border p-4 ${summary.data.data.dead_letter_outbox > 0 ? "border-rose-400/35 bg-rose-500/10" : "border-white/10 bg-[#1C1917]"}`}><p className="text-xs text-white/45">Kesehatan integrasi</p><p className="mt-2 text-2xl font-semibold text-[#f0f4ff]">{summary.data.data.failed_outbox + summary.data.data.dead_letter_outbox}</p><p className="mt-1 text-xs text-white/50">{summary.data.data.dead_letter_outbox} dead-letter · {summary.data.data.failed_outbox} menunggu retry</p></div>
                </div>
                <p className="text-xs text-white/40">Sinkronisasi Warranty terakhir: {summary.data.data.last_synced_at ? formatDate(summary.data.data.last_synced_at) : "belum ada"}</p>
              </section>
            )}

            <form onSubmit={submit} className="flex max-w-5xl gap-2">
              <label className="sr-only" htmlFor="warranty-search">Cari Contract</label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  id="warranty-search"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Nama, telepon, nomor order, atau Contract"
                  className="w-full rounded-lg border border-white/10 bg-[#1C1917] py-2.5 pl-10 pr-3 text-sm text-[#e8e2d4] outline-none placeholder:text-white/30 focus:border-[#c9a227]/70"
                />
              </div>
              <button type="submit" className="rounded-lg bg-[#c9a227] px-4 text-sm font-semibold text-[#1C1917] transition-colors hover:bg-[#dfbb40]">
                Cari
              </button>
            </form>

            {!term && (
              <div className="max-w-5xl rounded-lg border border-dashed border-white/15 bg-[#1C1917] px-4 py-8 text-center sm:px-6">
                <h2 className="text-sm font-semibold text-[#e8e2d4]">Cari Contract aktif</h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
                  Contract dapat dicari setelah order selesai dan aktivasi berhasil diproses oleh Warranty Core.
                </p>
                {role === "after_sales" && (
                  <Link href="/dashboard/after-sales/aktivasi" className="mt-4 inline-flex text-sm font-semibold text-[#c9a227] hover:text-[#dfbb40]">
                    Buka Aktivasi Garansi
                  </Link>
                )}
              </div>
            )}

            {search.isLoading && <p className="text-sm text-white/50">Memuat Contract…</p>}
            {search.error instanceof ApiError && search.error.status === 403 && (
              <div className="flex items-start gap-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Anda belum memiliki permission untuk membaca Contract garansi.
              </div>
            )}
            {search.error && !(search.error instanceof ApiError && search.error.status === 403) && (
              <div className="flex items-start gap-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {search.error instanceof Error ? search.error.message : "Contract tidak dapat dimuat."}
              </div>
            )}

            {search.data && (
              <section className="overflow-hidden rounded-lg border border-white/10 bg-[#1C1917]">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-medium text-[#e8e2d4]">{pagination?.total ?? 0} Contract ditemukan</p>
                  <ShieldCheck className="h-5 w-5 text-[#c9a227]" aria-hidden="true" />
                </div>
                {search.data.data.items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-white/50">Tidak ada Contract yang sesuai.</p>
                ) : (
                  <div className="divide-y divide-white/10">
                    {search.data.data.items.map((contract) => (
                      <article key={contract.reference} className="space-y-3 px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#f0f4ff]">{contract.customer_name || "Pelanggan"}</p>
                            <p className="mt-0.5 text-xs text-white/50">{contract.order_reference} · {contract.unit_code} · {contract.reference}</p>
                          </div>
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">{contract.status}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
                          <span>{contract.brand_code} · {contract.plan_code}</span>
                          <span>Berlaku hingga {formatDate(contract.expires_at)}</span>
                          {contract.customer_phone && <span>{contract.customer_phone}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {contract.entitlements.map((benefit) => (
                            <span key={benefit.benefit_code} className="rounded bg-white/5 px-2 py-1 text-xs text-[#e8e2d4]">
                              {benefit.benefit_code}: {benefit.quota_available}
                            </span>
                          ))}
                        </div>
                        <button type="button" onClick={() => { setSelectedContract(contract.reference); setSelectedClaim(null); }} className="text-xs font-medium text-[#c9a227] hover:text-[#dfbb40]">
                          Lihat detail Contract
                        </button>
                      </article>
                    ))}
                  </div>
                )}
                {pagination && totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm text-white/60">
                    <span>Halaman {pagination.page} dari {totalPages}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)} className="rounded border border-white/10 p-1.5 hover:bg-white/5 disabled:opacity-40" aria-label="Halaman sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
                      <button type="button" disabled={pagination.page >= totalPages} onClick={() => setPage(pagination.page + 1)} className="rounded border border-white/10 p-1.5 hover:bg-white/5 disabled:opacity-40" aria-label="Halaman berikutnya"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {selectedContract && (
              <section className="rounded-lg border border-white/10 bg-[#1C1917] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-[#f0f4ff]">Detail Contract</h2>
                    <p className="mt-0.5 text-xs text-white/50">{selectedContract}</p>
                  </div>
                  <button type="button" onClick={() => { setSelectedContract(null); setSelectedClaim(null); }} className="rounded p-1 text-white/50 hover:bg-white/5 hover:text-white" aria-label="Tutup detail Contract"><X className="h-4 w-4" /></button>
                </div>
                {contractDetail.isLoading && <p className="mt-4 text-sm text-white/50">Memuat detail Contract…</p>}
                {contractDetail.error && <p className="mt-4 text-sm text-rose-200">{contractDetail.error instanceof Error ? contractDetail.error.message : "Detail Contract tidak dapat dimuat."}</p>}
                {contractDetail.data && (
                  <div className="mt-4 space-y-5">
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div><p className="text-xs text-white/45">Pelanggan</p><p className="mt-1 text-[#e8e2d4]">{contractDetail.data.data.contract.customer_name || "—"}</p></div>
                      <div><p className="text-xs text-white/45">Berat awal / terakhir</p><p className="mt-1 text-[#e8e2d4]">{contractDetail.data.data.contract.starting_weight_gram ?? "—"} g / {contractDetail.data.data.contract.latest_weight_gram ?? "—"} g</p></div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#e8e2d4]">Benefit dan kuota</h3>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left text-xs">
                          <thead className="border-b border-white/10 text-white/45"><tr><th className="px-2 py-2">Benefit</th><th className="px-2 py-2">Awal</th><th className="px-2 py-2">Terpakai</th><th className="px-2 py-2">Reservasi</th><th className="px-2 py-2">Tersedia</th></tr></thead>
                          <tbody className="text-[#e8e2d4]">
                            {contractDetail.data.data.entitlements.map((benefit) => <tr key={benefit.benefit_code} className="border-b border-white/5"><td className="px-2 py-2">{benefit.benefit_code}</td><td className="px-2 py-2">{benefit.quota_initial}</td><td className="px-2 py-2">{benefit.quota_used}</td><td className="px-2 py-2">{benefit.quota_reserved}</td><td className="px-2 py-2 font-semibold text-emerald-300">{benefit.quota_available}</td></tr>)}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#e8e2d4]">Riwayat Claim</h3>
                      {contractDetail.data.data.claims.length === 0 ? <p className="mt-2 text-sm text-white/50">Belum ada Claim.</p> : (
                        <div className="mt-2 divide-y divide-white/10 rounded border border-white/10">
                          {contractDetail.data.data.claims.map((claim) => <div key={claim.reference} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-xs"><div><p className="font-medium text-[#e8e2d4]">{claim.reference}</p><p className="mt-0.5 text-white/50">{claim.status} · v{claim.claim_version}{claim.work_reference ? ` · ${claim.work_reference}` : ""}</p></div>{canReadClaim && <button type="button" onClick={() => setSelectedClaim(claim.reference)} className="font-medium text-[#c9a227] hover:text-[#dfbb40]">Detail Claim</button>}</div>)}
                        </div>
                      )}
                    </div>
                    {role === "after_sales" && (
                      <WarrantyClaimActions
                        contractReference={contractDetail.data.data.contract.reference}
                        entitlements={contractDetail.data.data.entitlements}
                        onChanged={() => { void contractDetail.refetch(); void search.refetch(); }}
                        onClaimCreated={(reference) => setSelectedClaim(reference)}
                      />
                    )}
                  </div>
                )}
              </section>
            )}

            {selectedClaim && canReadClaim && (
              <section className="rounded-lg border border-white/10 bg-[#1C1917] p-4">
                <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-[#f0f4ff]">Detail Claim</h2><p className="mt-0.5 text-xs text-white/50">{selectedClaim}</p></div><button type="button" onClick={() => setSelectedClaim(null)} className="rounded p-1 text-white/50 hover:bg-white/5 hover:text-white" aria-label="Tutup detail Claim"><X className="h-4 w-4" /></button></div>
                {claimDetail.isLoading && <p className="mt-4 text-sm text-white/50">Memuat detail Claim…</p>}
                {claimDetail.error && <p className="mt-4 text-sm text-rose-200">{claimDetail.error instanceof Error ? claimDetail.error.message : "Detail Claim tidak dapat dimuat."}</p>}
                {claimDetail.data && role === "after_sales" && (
                  <WarrantyClaimActions
                    contractReference={claimDetail.data.data.contract.reference}
                    entitlements={[claimDetail.data.data.entitlement]}
                    claim={claimDetail.data.data.claim}
                    claimEntitlement={claimDetail.data.data.entitlement}
                    attachmentCount={claimDetail.data.data.attachments.length}
                    onChanged={() => { void claimDetail.refetch(); void contractDetail.refetch(); void search.refetch(); }}
                    onClaimCreated={(reference) => setSelectedClaim(reference)}
                  />
                )}
                {claimDetail.data && <div className="mt-4 space-y-3 text-sm text-[#e8e2d4]"><p>Status: <span className="font-semibold">{claimDetail.data.data.claim.status}</span> · v{claimDetail.data.data.claim.claim_version}</p><p>Benefit: {claimDetail.data.data.entitlement.benefit_code} · kuota tersedia {claimDetail.data.data.entitlement.quota_available}</p>{claimDetail.data.data.claim.condition_notes && <p>Kondisi: {claimDetail.data.data.claim.condition_notes}</p>}{claimDetail.data.data.claim.work_reference && <p>Workshop: {claimDetail.data.data.claim.work_reference}</p>}<p className="text-xs text-white/50">{claimDetail.data.data.attachments.length} lampiran · {claimDetail.data.data.audit_events.length} audit event</p></div>}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function WarrantyWorklistPage() {
  return <WarrantyWorklist />;
}
