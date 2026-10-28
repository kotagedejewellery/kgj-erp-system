"use client";

import { ArrowLeft } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { type AlertState } from "./shared";

interface SupervisorFormState {
  username: string;
  full_name: string;
  email: string;
  password: string;
  role: "operational_supervisor" | "production_supervisor" | "customer_service_supervisor";
}

interface SupervisorUserFormProps {
  isEditMode: boolean;
  isSaving: boolean;
  form: SupervisorFormState;
  setForm: (f: SupervisorFormState) => void;
  onSave: () => void;
  onClose: () => void;
  onBack: () => void;
  showAlert: (type: NonNullable<AlertState>["type"], message: string) => void;
}

export function SupervisorUserForm({
  isEditMode,
  isSaving,
  form,
  setForm,
  onSave,
  onClose,
  onBack,
}: SupervisorUserFormProps) {
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
      <div className="bg-rose-500/10 border border-rose-400/20 rounded-lg p-3 text-xs text-rose-300">
        Hanya boleh satu akun aktif per tipe supervisor. Jika sudah ada, pembuatan akan ditolak.
      </div>
      <Input
        label="Username"
        value={form.username}
        onChange={(e) => setForm({ ...form, username: e.target.value })}
        placeholder="min. 3 karakter"
        disabled={isSaving}
      />
      <Input
        label="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        placeholder="contoh: supervisor@perusahaan.com"
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
        label={isEditMode ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        placeholder="Minimal 6 karakter"
        disabled={isSaving}
      />
      <div>
        <label className="block text-sm font-medium text-cream mb-1">
          Tipe Supervisor
        </label>
        <select
          value={form.role}
          onChange={(e) =>
            setForm({
              ...form,
              role: e.target.value as SupervisorFormState["role"],
            })
          }
          className="w-full px-3 py-2 border border-gold/25 rounded-lg focus:ring-2 focus:ring-gold/30 bg-carbon text-cream"
          disabled={isSaving}
        >
          <option value="operational_supervisor">Supervisor Operasional</option>
          <option value="production_supervisor">Supervisor Produksi</option>
          <option value="customer_service_supervisor">Supervisor Customer Service</option>
        </select>
        <p className="mt-1.5 text-xs text-white/50 italic">
          {form.role === "operational_supervisor"
            ? "Approval: Penerimaan Order, Persiapan Bahan, QC Awal, QC Akhir"
            : form.role === "production_supervisor"
              ? "Approval: Produksi (Finishing)"
              : "Validasi intake order sebelum Approval Penerimaan Order"}
        </p>
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
