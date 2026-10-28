"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, UserPlus } from "lucide-react";
import { CreateAccountSchema } from "@/lib/schemas/account";
import {
  ModalShell,
  Field,
  roleLabel,
  roleGroupLabel,
  type Account,
  type Role,
} from "./shared";

interface CreateModalProps {
  roles: Role[];
  onClose: () => void;
  onCreated: (a: Account) => void;
}

export function CreateModal({ roles, onClose, onCreated }: CreateModalProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<Account | null>(null);

  const groupedRoles = roles.reduce<Record<string, Role[]>>((acc, role) => {
    const group = role.role_group || "other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(role);
    return acc;
  }, {});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = CreateAccountSchema.safeParse({
      full_name: fullName,
      username,
      password,
      role_id: roleId,
      email: email || "",
    });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Validasi gagal");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/supervisor/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          username,
          password,
          role_id: roleId,
          email: email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat akun");
      setCreatedAccount(data.account);
      setSuccess(true);
      onCreated(data.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  if (success && createdAccount) {
    return (
      <ModalShell
        title="Akun Berhasil Dibuat"
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-300" />}
        onClose={onClose}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-500/10 p-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <UserPlus className="h-7 w-7 text-emerald-300" />
            </div>
            <p className="font-semibold text-emerald-800">
              {createdAccount.full_name}
            </p>
            <p className="text-sm text-emerald-300">
              @{createdAccount.username}
            </p>
            {createdAccount.role && (
              <p className="mt-1 text-xs text-emerald-500">
                {roleLabel(createdAccount.role.name)}
              </p>
            )}
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3">
            <p className="text-xs font-medium text-amber-800">
              Informasikan username dan password kepada anggota tim yang
              bersangkutan.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-amber-500/100 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            Selesai
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="Tambah Akun Tim"
      subtitle="Buat akun baru untuk anggota tim"
      icon={<UserPlus className="h-5 w-5 text-amber-300" />}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-red-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <Field
          label="Nama Lengkap"
          value={fullName}
          onChange={setFullName}
          placeholder="Contoh: Budi Santoso"
          required
        />
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="min. 3 karakter"
          required
          minLength={3}
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="min. 6 karakter"
          required
          minLength={6}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-cream">
            Role <span className="text-red-500">*</span>
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            required
            className="w-full rounded-lg border border-gold/15 bg-carbon px-3 py-2.5 text-sm text-cream focus:border-amber-400 focus:bg-cocoa focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition"
          >
            <option value="">Pilih role...</option>
            {Object.entries(groupedRoles).map(([group, groupRoles]) => (
              <optgroup key={group} label={roleGroupLabel(group)}>
                {groupRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {roleLabel(r.name)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="email@example.com"
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
            disabled={loading}
            className="flex-1 rounded-lg bg-amber-500/100 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60 transition-colors"
          >
            {loading ? "Menyimpan..." : "Buat Akun"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
