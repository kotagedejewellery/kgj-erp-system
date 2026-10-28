"use client";

import { useState } from "react";
import { AlertTriangle, Shield, ShieldOff } from "lucide-react";
import {
  ModalShell,
  roleLabel,
  type Account,
} from "./shared";

interface DeactivateModalProps {
  account: Account;
  onClose: () => void;
  onDeactivated: (id: string, changes: Partial<Account>) => void;
}

export function DeactivateModal({
  account,
  onClose,
  onDeactivated,
}: DeactivateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActivating = account.status === "inactive";
  const actionLabel = isActivating ? "Aktifkan" : "Nonaktifkan";

  const confirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/supervisor/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: isActivating ? "active" : "inactive",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui status");
      onDeactivated(account.id, {
        status: isActivating ? "active" : "inactive",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title={`${actionLabel} Akun`}
      subtitle={account.full_name}
      icon={
        isActivating ? (
          <Shield className="h-5 w-5 text-emerald-600" />
        ) : (
          <ShieldOff className="h-5 w-5 text-yellow-600" />
        )
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div
          className={`rounded-xl p-4 text-center ${
            isActivating ? "bg-emerald-50" : "bg-yellow-50"
          }`}
        >
          <div
            className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
              isActivating ? "bg-emerald-100" : "bg-yellow-100"
            }`}
          >
            {isActivating ? (
              <Shield className="h-7 w-7 text-emerald-600" />
            ) : (
              <ShieldOff className="h-7 w-7 text-yellow-600" />
            )}
          </div>
          <p
            className={`text-sm font-semibold ${
              isActivating ? "text-emerald-800" : "text-yellow-800"
            }`}
          >
            {account.full_name}
          </p>
          <p className="text-xs text-white/50">@{account.username}</p>
          {account.role && (
            <p className="mt-0.5 text-xs text-white/40">
              {roleLabel(account.role.name)}
            </p>
          )}
        </div>

        <p className="text-sm text-white/70">
          {isActivating
            ? "Akun akan diaktifkan kembali dan dapat login ke sistem seperti biasa."
            : "Akun akan dinonaktifkan. Pengguna tidak dapat login sampai akun diaktifkan kembali."}
        </p>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gold/15 px-4 py-2.5 text-sm font-medium text-cream hover:bg-carbon transition-colors"
          >
            Batal
          </button>
          <button
            onClick={confirm}
            disabled={loading}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-colors ${
              isActivating
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-yellow-600 hover:bg-yellow-700"
            }`}
          >
            {loading ? "Memproses..." : `Ya, ${actionLabel}`}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
