"use client";

import { ArrowLeft } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { type AlertState } from "./shared";

interface ManagementFormState {
  username: string;
  full_name: string;
  email: string;
  password: string;
  role: string;
}

const MANAGEMENT_ROLE_LABELS: Record<string, string> = {
  leader_hc: "Leader HC",
  leader_operational: "Leader Operasional",
  leader_production: "Leader Produksi",
  leader_marketing: "Leader Marketing",
  leader_sales: "Leader Sales",
  leader_fat: "Leader FAT",
  leader_rnd: "Leader RND",
  leader_safar: "Leader Safar",
  leader_ga: "Leader GA",
  leader_sekdir: "Leader Sekdir",
  leader_rji: "Leader RJI",
};

interface ManagementUserFormProps {
  isEditMode: boolean;
  isSaving: boolean;
  form: ManagementFormState;
  setForm: (f: ManagementFormState) => void;
  onSave: () => void;
  onClose: () => void;
  onBack: () => void;
  showAlert: (type: NonNullable<AlertState>["type"], message: string) => void;
}

export function ManagementUserForm({
  isEditMode,
  isSaving,
  form,
  setForm,
  onSave,
  onClose,
  onBack,
}: ManagementUserFormProps) {
  const roleOptions = Object.entries(MANAGEMENT_ROLE_LABELS);

  return (
    <div className="space-y-4">
      {!isEditMode && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Ganti tipe akun
        </button>
      )}
      <div className="bg-violet-500/10 border border-violet-200 rounded-lg p-3 text-xs text-violet-300">
        Akun Management dapat login melalui halaman login dengan kartu Management dan memiliki akses ke dashboard tugas.
      </div>
      <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
        placeholder="min. 3 karakter" disabled={isSaving} />
      <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
        placeholder="contoh: leader@perusahaan.com" disabled={isSaving} />
      <Input label="Nama Lengkap" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        placeholder="Masukkan nama lengkap" disabled={isSaving} />
      <Input label={isEditMode ? "Password Baru (kosongkan jika tidak diubah)" : "Password"} type="password"
        value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
        placeholder="Minimal 6 karakter" disabled={isSaving} />
      <div>
        <label className="block text-sm font-medium text-cream mb-1">Leader Role</label>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="w-full px-3 py-2 border border-gold/25 rounded-lg focus:ring-2 focus:ring-gold/30 bg-carbon text-cream"
          disabled={isSaving}>
          <option value="">Pilih tipe leader...</option>
          {roleOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={isSaving}>Batal</Button>
        <Button variant="primary" onClick={onSave} isLoading={isSaving}>
          {isEditMode ? "Simpan Perubahan" : "Buat Akun"}
        </Button>
      </div>
    </div>
  );
}
