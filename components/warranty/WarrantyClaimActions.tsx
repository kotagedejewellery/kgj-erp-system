"use client";

import { ChangeEvent, useState } from "react";
import { Check, FileUp, Loader2, Plus } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { mutator } from "@/lib/api";

export type WarrantyEntitlement = {
  benefit_code: string;
  quota_available: number;
  requires_workshop?: boolean;
  requires_final_weight?: boolean;
  requires_attachment?: boolean;
};

export type WarrantyClaimActionDetail = {
  reference: string;
  status: string;
  claim_version: number;
};

type CommandResponse = {
  data?: {
    data?: { reference?: string };
  };
};

type ConfirmAction = "submit" | "complete" | "cancel" | "request_exception" | null;

export default function WarrantyClaimActions({
  contractReference,
  entitlements,
  claim,
  claimEntitlement,
  attachmentCount = 0,
  onChanged,
  onClaimCreated,
}: {
  contractReference: string;
  entitlements: WarrantyEntitlement[];
  claim?: WarrantyClaimActionDetail;
  claimEntitlement?: WarrantyEntitlement;
  attachmentCount?: number;
  onChanged: () => void;
  onClaimCreated: (reference: string) => void;
}) {
  const [benefitCode, setBenefitCode] = useState<string | null>(null);
  const [conditionNotes, setConditionNotes] = useState("");
  const [finalWeight, setFinalWeight] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitNeedsReview, setSubmitNeedsReview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const selectedBenefit = entitlements.find((entitlement) => entitlement.benefit_code === benefitCode);
  const entitlement = claim ? claimEntitlement ?? null : null;

  async function createClaim() {
    if (!benefitCode || !conditionNotes.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await mutator<CommandResponse>("/api/warranty/claims", {
        body: {
          action: "create",
          contract_reference: contractReference,
          benefit_code: benefitCode,
          condition_notes: conditionNotes.trim(),
        },
      });
      const reference = result.data?.data?.reference;
      if (!reference) throw new Error("Warranty Core tidak mengembalikan referensi Claim");
      setBenefitCode(null);
      setConditionNotes("");
      onClaimCreated(reference);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Claim tidak dapat dibuat");
    } finally {
      setLoading(false);
    }
  }

  async function submitClaim() {
    if (!claim) return;
    setLoading(true);
    setError("");
    setSubmitNeedsReview(false);
    try {
      await mutator("/api/warranty/claims", {
        body: { action: "submit", claim_reference: claim.reference, expected_version: claim.claim_version },
      });
      setConfirmAction(null);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Claim tidak dapat diajukan");
      setSubmitNeedsReview(true);
      setConfirmAction(null);
      onChanged();
    } finally {
      setLoading(false);
    }
  }

  async function completeClaim() {
    if (!claim) return;
    setLoading(true);
    setError("");
    try {
      await mutator("/api/warranty/claims", {
        body: {
          action: "complete_non_workshop",
          claim_reference: claim.reference,
          expected_version: claim.claim_version,
          final_weight_gram: finalWeight || undefined,
        },
      });
      setConfirmAction(null);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Claim tidak dapat diselesaikan");
      setConfirmAction(null);
    } finally {
      setLoading(false);
    }
  }

  async function runClaimAction(action: "cancel" | "request_quota_exception") {
    if (!claim || !reason.trim()) return;
    setLoading(true);
    setError("");
    try {
      await mutator("/api/warranty/claims", {
        body: {
          action,
          claim_reference: claim.reference,
          expected_version: claim.claim_version,
          reason: reason.trim(),
        },
      });
      setReason("");
      setConfirmAction(null);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tindakan Claim tidak dapat diproses");
      setConfirmAction(null);
    } finally {
      setLoading(false);
    }
  }

  async function uploadAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !claim) return;
    setLoading(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    try {
      await mutator(`/api/warranty/claims/${encodeURIComponent(claim.reference)}/attachments`, { body: form });
      event.target.value = "";
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Lampiran tidak dapat diunggah");
    } finally {
      setLoading(false);
    }
  }

  if (!claim) {
    return (
      <section className="border-t border-white/10 pt-4">
        <h3 className="text-sm font-semibold text-[#e8e2d4]">Buat Claim</h3>
        <p className="mt-1 text-xs text-white/50">Pilih satu benefit untuk satu Claim. Kuota baru direservasi setelah Claim diajukan.</p>
        {!benefitCode ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {entitlements.map((item) => (
              <button
                key={item.benefit_code}
                type="button"
                onClick={() => setBenefitCode(item.benefit_code)}
                className="rounded-md border border-[#c9a227]/45 px-3 py-2 text-xs font-medium text-[#e8e2d4] transition-colors hover:bg-[#c9a227]/10"
              >
                {item.benefit_code} · sisa {item.quota_available}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 space-y-3 rounded-lg bg-[#2a2522] p-3">
            <p className="text-xs text-[#e8e2d4]">Benefit: <span className="font-semibold">{selectedBenefit?.benefit_code}</span></p>
            <label className="block text-xs text-white/55">
              Kondisi cincin dan kebutuhan pelanggan
              <textarea
                required
                value={conditionNotes}
                onChange={(event) => setConditionNotes(event.target.value)}
                rows={3}
                className="mt-1 w-full resize-y rounded-md border border-white/10 bg-[#1C1917] px-2 py-2 text-sm text-[#e8e2d4] outline-none focus:border-[#c9a227]/60"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setBenefitCode(null); setConditionNotes(""); }} className="rounded-md px-3 py-2 text-xs text-white/60 hover:bg-white/5">Batal</button>
              <button type="button" disabled={loading || !conditionNotes.trim()} onClick={createClaim} className="inline-flex items-center gap-1.5 rounded-md bg-[#c9a227] px-3 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#dfbb40] disabled:opacity-50">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Buat Claim
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-rose-200">{error}</p>}
      </section>
    );
  }

  const requiresWorkshop = entitlement?.requires_workshop === true;
  const requiresAttachment = entitlement?.requires_attachment === true;
  const requiresFinalWeight = entitlement?.requires_final_weight === true;
  const mayComplete = claim.status === "verified_and_reserved" && !requiresWorkshop;

  return (
    <section className="mt-4 border-t border-white/10 pt-4">
      <h3 className="text-sm font-semibold text-[#e8e2d4]">Tindakan Claim</h3>
      {claim.status === "draft" && (
        <button type="button" disabled={loading} onClick={() => setConfirmAction("submit")} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#c9a227] px-3 py-2 text-xs font-semibold text-[#1C1917] hover:bg-[#dfbb40] disabled:opacity-50">
          <Check className="h-3.5 w-3.5" /> Ajukan Claim dan reservasi kuota
        </button>
      )}
      {requiresWorkshop && claim.status === "verified_and_reserved" && <p className="mt-2 text-xs text-white/50">Claim ini memerlukan Workshop Work dan belum dapat diselesaikan dari After Sales.</p>}
      {mayComplete && (
        <div className="mt-3 space-y-3 rounded-lg bg-[#2a2522] p-3">
          {requiresAttachment && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#c9a227]/45 px-3 py-2 text-xs font-medium text-[#e8e2d4] hover:bg-[#c9a227]/10">
              <FileUp className="h-3.5 w-3.5" /> Unggah bukti {attachmentCount > 0 ? `(${attachmentCount})` : ""}
              <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" disabled={loading} onChange={uploadAttachment} />
            </label>
          )}
          {requiresFinalWeight && (
            <label className="block text-xs text-white/55">
              Berat akhir (gram)
              <input type="number" min="0.001" step="0.001" value={finalWeight} onChange={(event) => setFinalWeight(event.target.value)} className="mt-1 w-full rounded-md border border-white/10 bg-[#1C1917] px-2 py-2 text-sm text-[#e8e2d4] outline-none focus:border-[#c9a227]/60" />
            </label>
          )}
          <button type="button" disabled={loading || (requiresAttachment && attachmentCount < 1) || (requiresFinalWeight && !finalWeight)} onClick={() => setConfirmAction("complete")} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#15221a] hover:bg-emerald-400 disabled:opacity-50">
            <Check className="h-3.5 w-3.5" /> Selesaikan Claim
          </button>
        </div>
      )}
      {!(["completed", "cancelled"] as string[]).includes(claim.status) && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <label className="block text-xs text-white/55">
            Alasan pembatalan atau Exception
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              className="mt-1 w-full resize-y rounded-md border border-white/10 bg-[#1C1917] px-2 py-2 text-sm text-[#e8e2d4] outline-none focus:border-[#c9a227]/60"
              placeholder="Wajib diisi sebelum mengajukan tindakan"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {(claim.status === "draft" || claim.status === "awaiting_spv_exception") && (entitlement?.quota_available === 0 || submitNeedsReview) && (
              <button type="button" disabled={loading || !reason.trim()} onClick={() => setConfirmAction("request_exception")} className="rounded-md border border-[#c9a227]/60 px-3 py-2 text-xs font-semibold text-[#e8e2d4] hover:bg-[#c9a227]/10 disabled:opacity-50">
                Ajukan Exception kuota
              </button>
            )}
            <button type="button" disabled={loading || !reason.trim()} onClick={() => setConfirmAction("cancel")} className="rounded-md border border-rose-300/35 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/10 disabled:opacity-50">
              Batalkan Claim
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-200">{error}</p>}
      <ConfirmDialog
        isOpen={confirmAction === "submit"}
        title="Ajukan Claim?"
        message="Kuota benefit akan direservasi setelah Warranty Core memvalidasi Claim ini."
        confirmText="Ajukan Claim"
        variant="warning"
        isLoading={loading}
        onConfirm={submitClaim}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        isOpen={confirmAction === "complete"}
        title="Selesaikan Claim?"
        message="Kuota yang direservasi akan dipindahkan menjadi terpakai."
        confirmText="Selesaikan"
        variant="warning"
        isLoading={loading}
        onConfirm={completeClaim}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        isOpen={confirmAction === "request_exception"}
        title="Ajukan Exception kuota?"
        message="Permintaan akan masuk ke SPV Operational. Kuota tidak berubah sebelum keputusan disetujui oleh Warranty Core."
        confirmText="Ajukan Exception"
        variant="warning"
        isLoading={loading}
        onConfirm={() => runClaimAction("request_quota_exception")}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        isOpen={confirmAction === "cancel"}
        title="Batalkan Claim?"
        message="Untuk Claim yang sudah memiliki Warranty Work, Warranty Core menunggu konfirmasi pembatalan dari Workshop sebelum reservation dilepas."
        confirmText="Batalkan Claim"
        variant="danger"
        isLoading={loading}
        onConfirm={() => runClaimAction("cancel")}
        onCancel={() => setConfirmAction(null)}
      />
    </section>
  );
}
