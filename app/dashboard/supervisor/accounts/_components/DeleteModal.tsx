"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, UserX } from "lucide-react";
import {
  ModalShell,
  roleLabel,
  type Account,
} from "./shared";

interface DeleteModalProps {
  account: Account;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export function DeleteModal({ account, onClose, onDeleted }: DeleteModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText === account.username;

  const confirm = async () => {
    if (!canConfirm) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/supervisor/accounts/${account.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus akun");
      onDeleted(account.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="Hapus Akun"
      subtitle="Tindakan permanen"
      icon={<Trash2 className="h-5 w-5 text-rose-300" />}
      onClose={onClose}
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-red-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-xl bg-rose-500/10 p-4 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10">
            <UserX className="h-7 w-7 text-rose-300" />
          </div>
          <p className="text-sm font-semibold text-red-800">
            {account.full_name}
          </p>
          <p className="text-xs text-rose-300">@{account.username}</p>
          {account.role && (
            <p className="mt-0.5 text-xs text-red-500">
              {roleLabel(account.role.name)}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-red-100 bg-rose-500/10/50 p-3">
          <p className="text-xs text-rose-300">
            <span className="font-semibold">Peringatan:</span> Akun ini akan
            dihapus secara permanen. Semua data terkait akan tetap ada di
            sistem, tetapi akun tidak dapat digunakan lagi. Tindakan ini{" "}
            <span className="font-semibold">tidak dapat dibatalkan</span>.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-cream">
            Ketik{" "}
            <span className="font-mono font-semibold text-rose-300">
              {account.username}
            </span>{" "}
            untuk mengonfirmasi
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={account.username}
            className="w-full rounded-lg border border-gold/15 bg-carbon px-3 py-2.5 text-sm text-cream placeholder:text-white/30 focus:border-red-400 focus:bg-cocoa focus:outline-none focus:ring-2 focus:ring-red-200 transition"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gold/15 px-4 py-2.5 text-sm font-medium text-cream hover:bg-carbon transition-colors"
          >
            Batal
          </button>
          <button
            onClick={confirm}
            disabled={loading || !canConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Menghapus..." : "Ya, Hapus Permanen"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
