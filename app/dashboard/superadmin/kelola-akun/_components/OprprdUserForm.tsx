"use client";

import { ArrowLeft } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ROLE_GROUP_LABELS, type AlertState, type RoleOPRPRD } from "./shared";

interface OprprdFormState {
  username: string;
  full_name: string;
  email: string;
  phone: string;
  password: string;
  role_id: string;
}

interface OprprdUserFormProps {
  isEditMode: boolean;
  isSaving: boolean;
  form: OprprdFormState;
  setForm: (f: OprprdFormState) => void;
  roles: RoleOPRPRD[];
  onSave: () => void;
  onClose: () => void;
  onBack: () => void;
  showAlert: (type: NonNullable<AlertState>["type"], message: string) => void;
}

export function OprprdUserForm({
  isEditMode,
  isSaving,
  form,
  setForm,
  roles,
  onSave,
  onClose,
  onBack,
}: OprprdUserFormProps) {
  return (
    <div className="space-y-4">
      {!isEditMode && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Ganti tipe akun
        </button>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          placeholder="min. 3 karakter"
          disabled={isSaving}
        />
        <Input
          label="Nama Lengkap"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          placeholder="Masukkan nama lengkap"
          disabled={isSaving}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Email (Opsional)"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="email@company.com"
          disabled={isSaving}
        />
        <Input
          label="Telepon (Opsional)"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="08123456789"
          disabled={isSaving}
        />
      </div>
      <Input
        label={
          isEditMode
            ? "Password Baru (kosongkan jika tidak diubah)"
            : "Password"
        }
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        placeholder="Minimal 6 karakter"
        disabled={isSaving}
      />
      <div>
        <label className="block text-sm font-medium text-cream mb-1">
          Role
        </label>
        <select
          value={form.role_id}
          onChange={(e) => setForm({ ...form, role_id: e.target.value })}
          className="w-full px-3 py-2 border border-gold/25 rounded-lg focus:ring-2 focus:ring-gold/30 bg-carbon text-cream"
          disabled={isSaving}
        >
          <option value="">Pilih Role</option>
          {(["operational", "production"] as const).map((group) => {
            const groupRoles = roles.filter((r) => r.role_group === group);
            if (groupRoles.length === 0) return null;
            return (
              <optgroup
                key={group}
                label={ROLE_GROUP_LABELS[group]?.label ?? group}
              >
                {groupRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {form.role_id && (
          <p className="mt-1.5 text-xs text-white/50 italic">
            {roles.find((r) => r.id === form.role_id)?.description ?? "Tidak ada deskripsi."}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={isSaving}>
          Batal
        </Button>
        <Button variant="primary" onClick={onSave} isLoading={isSaving}>
          {isEditMode ? "Simpan Perubahan" : "Buat Akun"}
        </Button>
      </div>
    </div>
  );
}
