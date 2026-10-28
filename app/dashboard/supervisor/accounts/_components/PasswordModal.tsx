"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Key } from "lucide-react";
import { ResetPasswordSchema } from "@/lib/schemas/account";
import {
  ModalShell,
  Field,
  type Account,
} from "./shared";

interface PasswordModalProps {
  account: Account;
  onClose: () => void;
}

export function PasswordModal({ account, onClose }: PasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordError =
    confirm && password !== confirm ? "Password tidak cocok" : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Password tidak cocok");
      return;
    }
    const validation = ResetPasswordSchema.safeParse({ password, confirm });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Validasi gagal");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/supervisor/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah password");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="Reset Password"
      subtitle={account.full_name}
      icon={<Key className="h-5 w-5 text-sky-300" />}
      onClose={onClose}
    >
      {success ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-50 p-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-emerald-800">
              Password berhasil diubah
            </p>
            <p className="mt-1 text-xs text-emerald-600">
              Informasikan password baru kepada{" "}
              <span className="font-semibold">{account.full_name}</span>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            Tutup
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <Field
            label="Password Baru"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="min. 6 karakter"
            required
            minLength={6}
          />
          <Field
            label="Konfirmasi Password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Ulangi password"
            required
            error={passwordError}
          />
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gold/15 px-4 py-2.5 text-sm font-medium text-cream hover:bg-carbon transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !password || !confirm || !!passwordError}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Mengubah..." : "Ubah Password"}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
