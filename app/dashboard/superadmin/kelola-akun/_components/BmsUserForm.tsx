"use client";

import { ArrowLeft } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { type AlertState } from "./shared";

interface BmsFormState {
  username: string;
  full_name: string;
  email: string;
  password: string;
  role: "superadmin" | "after_sales";
}

interface BmsUserFormProps {
  isEditMode: boolean;
  isSaving: boolean;
  form: BmsFormState;
  setForm: (f: BmsFormState) => void;
  onSave: () => void;
  onClose: () => void;
  onBack: () => void;
  showAlert: (type: NonNullable<AlertState>["type"], message: string) => void;
}

export function BmsUserForm({
  isEditMode,
  isSaving,
  form,
  setForm,
  onSave,
  onClose,
  onBack,
}: BmsUserFormProps) {
  return (
    <div className="space-y-4">
      {!isEditMode && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-gold hover:text-gold-bright mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Ganti tipe akun
        </button>
      )}
      <Input
        label={isEditMode ? "Username" : "Username (opsional)"}
        value={form.username}
        onChange={(e) => setForm({ ...form, username: e.target.value })}
        placeholder={isEditMode ? undefined : "min. 3 karakter"}
        disabled={isSaving}
      />
      <Input
        label="Nama Lengkap"
        value={form.full_name}
        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        placeholder="Masukkan nama lengkap"
        disabled={isSaving}
      />
      <Input
        label="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        placeholder="email@company.com"
        disabled={isSaving}
      />
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
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as BmsFormState["role"] })}
          className="w-full px-3 py-2 border border-gold/25 rounded-lg focus:ring-2 focus:ring-gold/30 bg-carbon text-cream"
          disabled={isSaving}
        >
          <option value="superadmin">Super Admin</option>
          <option value="after_sales">After Sales</option>
        </select>
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
