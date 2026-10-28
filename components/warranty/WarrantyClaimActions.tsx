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

type ConfirmAction = "submit" | "complete" | null;

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
  const [error, setError] = useState("");
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
    try {
      await mutator("/api/warranty/claims", {
        body: { action: "submit", claim_reference: claim.reference, expected_version: claim.claim_version },
      });
      setConfirmAction(null);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Claim tidak dapat diajukan");
      setConfirmAction(null);
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
                disabled={item.quota_available < 1}
                onClick={() => setBenefitCode(item.benefit_code)}
                className="rounded-md border border-[#c9a227]/45 px-3 py-2 text-xs font-medium text-[#e8e2d4] transition-colors hover:bg-[#c9a227]/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
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
    </section>
  );
}
