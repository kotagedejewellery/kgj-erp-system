"use client";

import { useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
import { EditAccountSchema } from "@/lib/schemas/account";
import {
  ModalShell,
  Field,
  StatusBadge,
  formatRelative,
  formatDateTime,
  roleLabel,
  roleGroupLabel,
  type Account,
  type Role,
} from "./shared";

interface EditModalProps {
  account: Account;
  roles: Role[];
  onClose: () => void;
  onUpdated: (id: string, changes: Partial<Account>) => void;
}

export function EditModal({ account, roles, onClose, onUpdated }: EditModalProps) {
  const [fullName, setFullName] = useState(account.full_name);
  const [roleId, setRoleId] = useState(account.role_id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedRoles = roles.reduce<Record<string, Role[]>>((acc, role) => {
    const group = role.role_group || "other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(role);
    return acc;
  }, {});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = EditAccountSchema.safeParse({
      full_name: fullName,
      role_id: roleId,
    });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Validasi gagal");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (fullName.trim() !== account.full_name)
        body.full_name = fullName.trim();
      if (roleId !== (account.role_id ?? "")) body.role_id = roleId;

      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }

      const res = await fetch(`/api/supervisor/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui");

      const newRole = roles.find((r) => r.id === roleId) ?? null;
      onUpdated(account.id, {
        full_name: fullName.trim(),
        role_id: roleId || null,
        role: newRole,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="Edit Akun"
      subtitle={account.full_name}
      icon={<Pencil className="h-5 w-5 text-amber-300" />}
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
          required
        />

        <Field
          label="Username"
          value={account.username}
          onChange={() => {}}
          disabled
          hint="Username tidak dapat diubah setelah akun dibuat."
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-cream">
            Role
          </label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
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

        {/* Quick info */}
        <div className="rounded-lg bg-carbon p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Status</span>
            <StatusBadge status={account.status} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Login Terakhir</span>
            <span className="text-white/70">
              {formatRelative(account.last_login)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Dibuat</span>
            <span className="text-white/70">
              {formatDateTime(account.created_at)}
            </span>
          </div>
        </div>

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
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
