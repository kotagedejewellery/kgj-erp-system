"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, Loader2, Plus, Send, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { ApiError, fetcher, mutator } from "@/lib/api";

type WarrantyUnit = {
  id: string;
  candidate_sequence: number;
  unit_code: string;
  gender: "pria" | "wanita" | "lainnya";
  starting_weight_gram: number;
  plan_version_reference: string;
  commands: Record<string, { status: string; last_error: string | null }>;
  contract: { contract_reference: string; activated_at: string; expires_at: string } | null;
};

type WarrantyPreparation = {
  is_ready: boolean;
  ready_at: string | null;
  plan_options: { value: string; label: string }[];
  units: WarrantyUnit[];
  activation: { status: string; created_at: string; delivered_at: string | null } | null;
};

type WarrantyPreparationResponse = { data: WarrantyPreparation };
type Confirmation = { action: "remove"; unit: WarrantyUnit } | { action: "ready" } | { action: "activate"; unit: WarrantyUnit } | null;

export default function WarrantyPreparation({ orderId, currentStage }: { orderId: string; currentStage: string }) {
  const queryClient = useQueryClient();
  const [gender, setGender] = useState<WarrantyUnit["gender"]>("pria");
  const [unitCode, setUnitCode] = useState("");
  const [weight, setWeight] = useState("");
  const [planVersion, setPlanVersion] = useState("");
  const [actionError, setActionError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const key = ["warranty-preparation", orderId];

  const query = useQuery<WarrantyPreparationResponse>({
    queryKey: key,
    queryFn: () => fetcher<WarrantyPreparationResponse>(`/api/warranty/preparation?order_id=${orderId}`),
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const addUnit = useMutation({
    mutationFn: () => mutator("/api/warranty/preparation", {
      body: {
        order_id: orderId,
        gender,
        unit_code: unitCode,
        starting_weight_gram: weight,
        plan_version_reference: planVersion,
      },
    }),
    onSuccess: () => {
      setUnitCode("");
      setWeight("");
      setActionError("");
      refresh();
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Gagal menambah unit"),
  });
  const removeUnit = useMutation({
    mutationFn: (unitId: string) => mutator("/api/warranty/preparation", {
      method: "DELETE",
      body: { order_id: orderId, unit_id: unitId },
    }),
    onSuccess: () => {
      setActionError("");
      refresh();
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Gagal menghapus unit"),
  });
  const markReady = useMutation({
    mutationFn: () => mutator("/api/warranty/preparation", {
      method: "PATCH",
      body: { order_id: orderId, action: "mark_ready" },
    }),
    onSuccess: () => {
      setActionError("");
      refresh();
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Gagal menandai persiapan"),
  });
  const candidateAction = useMutation({
    mutationFn: ({ unitId, action }: { unitId: string; action: "validate" | "activate" }) => mutator("/api/warranty/activation", {
      body: { order_id: orderId, unit_id: unitId, action },
    }),
    onSuccess: () => {
      setActionError("");
      refresh();
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Aktivasi garansi gagal"),
  });

  if (query.error instanceof ApiError && query.error.status === 403) return null;
  if (query.isLoading) return null;
  if (query.error || !query.data) {
    return (
      <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">
        Garansi belum dapat dimuat. Coba lagi dari detail order.
      </div>
    );
  }

  const preparation = query.data.data;
  const canEdit = !preparation.is_ready;
  const activationLabel = preparation.activation?.status === "delivered"
    ? "Aktivasi sudah dikirim ke Warranty Core."
    : preparation.activation?.status === "dead_letter"
      ? "Aktivasi gagal dikirim. Hubungi administrator Warranty."
    : preparation.activation
      ? "Aktivasi masuk antrean pengiriman ke Warranty Core."
      : currentStage === "selesai"
        ? "Tandai persiapan siap untuk membuat antrean aktivasi."
        : "Aktivasi akan diantrikan setelah order selesai.";

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addUnit.mutate();
  }

  function confirmAction() {
    if (!confirmation) return;
    if (confirmation.action === "remove") removeUnit.mutate(confirmation.unit.id);
    if (confirmation.action === "ready") markReady.mutate();
    if (confirmation.action === "activate") candidateAction.mutate({ unitId: confirmation.unit.id, action: "activate" });
    setConfirmation(null);
  }

  return (
    <section className="space-y-3 rounded-lg border border-[#c9a227]/25 bg-[#1C1917] p-3">
      <div>
        <h4 className="text-sm font-semibold text-[#f0f4ff]">Warranty Preparation</h4>
        <p className="mt-1 text-xs leading-relaxed text-white/40">{activationLabel}</p>
      </div>

      {preparation.units.length > 0 && (
        <div className="space-y-2">
          {preparation.units.map((unit) => (
            <div key={unit.id} className="flex items-start justify-between gap-3 rounded-md bg-[#2a2522] px-3 py-2 text-xs">
              <div>
                <p className="font-medium text-[#e8e2d4]">{unit.unit_code}</p>
                <p className="mt-0.5 text-white/40">
                  {unit.gender} · {Number(unit.starting_weight_gram).toLocaleString("id-ID")} g · {unit.plan_version_reference}
                </p>
                {preparation.is_ready && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    {unit.contract ? (
                      <span className="text-emerald-300">Contract aktif: {unit.contract.contract_reference}</span>
                    ) : preparation.activation?.status !== "delivered" ? (
                      <span className="text-white/40">Menunggu Candidate diterima Warranty Core.</span>
                    ) : unit.commands.validate?.status !== "completed" ? (
                      <button
                        type="button"
                        onClick={() => candidateAction.mutate({ unitId: unit.id, action: "validate" })}
                        disabled={candidateAction.isPending}
                        className="inline-flex items-center gap-1 rounded border border-[#c9a227]/50 px-2 py-1 font-medium text-[#e8e2d4] transition-colors hover:bg-[#c9a227]/10 disabled:opacity-50"
                      >
                        {candidateAction.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Validasi unit
                      </button>
                    ) : unit.commands.activate?.status !== "completed" ? (
                      <button
                        type="button"
                        onClick={() => setConfirmation({ action: "activate", unit })}
                        disabled={candidateAction.isPending}
                        className="inline-flex items-center gap-1 rounded bg-[#c9a227] px-2 py-1 font-semibold text-[#1C1917] transition-colors hover:bg-[#dfbb40] disabled:opacity-50"
                      >
                        {candidateAction.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Aktifkan garansi
                      </button>
                    ) : (
                      <span className="text-white/40">Menunggu Contract dari Warranty Core.</span>
                    )}
                    {unit.commands.validate?.status === "failed" && (
                      <span className="inline-flex items-center gap-1 text-rose-200"><CircleAlert className="h-3 w-3" /> {unit.commands.validate.last_error}</span>
                    )}
                    {unit.commands.activate?.status === "failed" && (
                      <span className="inline-flex items-center gap-1 text-rose-200"><CircleAlert className="h-3 w-3" /> {unit.commands.activate.last_error}</span>
                    )}
                  </div>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setConfirmation({ action: "remove", unit })}
                  disabled={removeUnit.isPending}
                  className="rounded p-1 text-white/40 transition-colors hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
                  aria-label={`Hapus ${unit.unit_code}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="space-y-2 border-t border-white/10 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-white/40">
              Unit
              <input
                value={unitCode}
                onChange={(event) => setUnitCode(event.target.value)}
                placeholder="Otomatis jika kosong"
                className="mt-1 w-full rounded-md border border-white/10 bg-[#2a2522] px-2 py-1.5 text-xs text-[#e8e2d4] outline-none placeholder:text-white/25 focus:border-[#c9a227]/60"
              />
            </label>
            <label className="text-xs text-white/40">
              Gender
              <select
                value={gender}
                onChange={(event) => setGender(event.target.value as WarrantyUnit["gender"])}
                className="mt-1 w-full rounded-md border border-white/10 bg-[#2a2522] px-2 py-1.5 text-xs text-[#e8e2d4] outline-none focus:border-[#c9a227]/60"
              >
                <option value="pria">Pria</option>
                <option value="wanita">Wanita</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-white/40">
              Berat awal (gram)
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-[#2a2522] px-2 py-1.5 text-xs text-[#e8e2d4] outline-none focus:border-[#c9a227]/60"
              />
            </label>
            <label className="text-xs text-white/40">
              Plan garansi
              <select
                required
                value={planVersion}
                onChange={(event) => setPlanVersion(event.target.value)}
                disabled={preparation.plan_options.length === 0}
                className="mt-1 w-full rounded-md border border-white/10 bg-[#2a2522] px-2 py-1.5 text-xs text-[#e8e2d4] outline-none focus:border-[#c9a227]/60 disabled:opacity-50"
              >
                <option value="">Pilih plan</option>
                {preparation.plan_options.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}
              </select>
            </label>
          </div>
          {preparation.plan_options.length === 0 && <p className="text-xs text-rose-200">Brand order belum eligible untuk garansi v1.</p>}
          <button
            type="submit"
            disabled={addUnit.isPending || !planVersion}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#c9a227] px-3 py-1.5 text-xs font-semibold text-[#1C1917] transition-colors hover:bg-[#dfbb40] disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah unit
          </button>
        </form>
      )}

      {actionError && <p className="text-xs text-rose-200">{actionError}</p>}

      {canEdit && preparation.units.length > 0 && (
        <button
          type="button"
          onClick={() => setConfirmation({ action: "ready" })}
          disabled={markReady.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#c9a227]/50 px-3 py-1.5 text-xs font-semibold text-[#e8e2d4] transition-colors hover:bg-[#c9a227]/10 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Tandai persiapan siap
        </button>
      )}
      {preparation.is_ready && (
        <p className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
          <Check className="h-3.5 w-3.5" /> Persiapan terkunci untuk aktivasi garansi.
        </p>
      )}
      <ConfirmDialog
        isOpen={confirmation?.action === "remove"}
        title="Hapus unit garansi?"
        message={`Unit ${confirmation?.action === "remove" ? confirmation.unit.unit_code : ""} akan dihapus dari Preparation.`}
        confirmText="Hapus unit"
        variant="danger"
        isLoading={removeUnit.isPending}
        onConfirm={confirmAction}
        onCancel={() => setConfirmation(null)}
      />
      <ConfirmDialog
        isOpen={confirmation?.action === "ready"}
        title="Kunci Preparation?"
        message="Data unit, berat awal, dan paket tidak dapat diubah setelah Preparation ditandai siap."
        confirmText="Tandai siap"
        variant="warning"
        isLoading={markReady.isPending}
        onConfirm={confirmAction}
        onCancel={() => setConfirmation(null)}
      />
      <ConfirmDialog
        isOpen={confirmation?.action === "activate"}
        title="Aktifkan Contract garansi?"
        message="Warranty Core akan membekukan paket dan benefit untuk unit ini."
        confirmText="Aktifkan"
        variant="warning"
        isLoading={candidateAction.isPending}
        onConfirm={confirmAction}
        onCancel={() => setConfirmation(null)}
      />
    </section>
  );
}
