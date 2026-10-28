"use client";

import React, { useEffect, useCallback, useState } from "react";
import { X, User, Mail, Hash, Lock, Eye, EyeOff } from "lucide-react";

interface ProfileData {
  id: string;
  full_name: string;
  username: string | null;
  email: string | null;
}

interface SettingsModalProps {
  profile: ProfileData;
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsModal({ profile, onClose, onSaved }: SettingsModalProps) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [username, setUsername] = useState(profile.username ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape" && !isSaving) onClose(); },
    [onClose, isSaving],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSave = async () => {
    setError("");

    if (newPassword && newPassword !== confirmPassword) {
      setError("Password baru dan konfirmasi tidak cocok");
      return;
    }

    setIsSaving(true);
    try {
      const body: Record<string, string> = {};
      if (fullName !== profile.full_name) body.full_name = fullName;
      if (username !== (profile.username ?? "")) body.username = username || "";
      if (email !== profile.email) body.email = email;
      if (newPassword) body.new_password = newPassword;

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setIsSaving(false);
    }
  };

  const P = { purple: "#a78bfa", green: "#34d399", gray: "#a8a29e", grayBorder: "#c9a22733", ink: "#F5EFE3", red: "#f87171" };

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors scheme-dark appearance-none";
  const inputStyle = { borderColor: P.grayBorder, color: P.ink, background: "#2A2522" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: "#2A2522", border: `1px solid ${P.grayBorder}` }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ background: "#7c3aed22", borderBottom: `1px solid ${P.grayBorder}` }}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: P.purple }}>Pengaturan Profil</p>
            <p className="text-lg font-bold" style={{ color: P.ink }}>Edit Data</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="rounded-xl p-2 transition-all active:scale-[0.92] hover:bg-[#2a2522] disabled:opacity-50" style={{ color: P.gray }} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2" style={{ background: "#f8717122", color: P.red }}>
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.08em] flex items-center gap-1.5" style={{ color: P.gray }}><User className="h-3 w-3" />Full Name</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} style={inputStyle} disabled={isSaving} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.08em] flex items-center gap-1.5" style={{ color: P.gray }}><Hash className="h-3 w-3" />Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} style={inputStyle} disabled={isSaving} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.08em] flex items-center gap-1.5" style={{ color: P.gray }}><Mail className="h-3 w-3" />Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} style={inputStyle} disabled={isSaving} />
          </div>

          <div className="border-t pt-4" style={{ borderColor: P.grayBorder }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: P.gray }}>Ubah Password (opsional)</p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.08em] flex items-center gap-1.5" style={{ color: P.gray }}><Lock className="h-3 w-3" />Password Baru</label>
                <div className="relative">
                  <input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass + " pr-9"} style={inputStyle} disabled={isSaving} placeholder="Min. 6 karakter" />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: P.gray }} disabled={isSaving}>
                    {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.08em] flex items-center gap-1.5" style={{ color: P.gray }}><Lock className="h-3 w-3" />Konfirmasi Password Baru</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} style={inputStyle} disabled={isSaving} placeholder="Ketik ulang password baru" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 shrink-0" style={{ borderTop: `1px solid ${P.grayBorder}`, background: "#1C1917" }}>
          <button onClick={onClose} disabled={isSaving} className="rounded-xl px-4 py-2 text-xs font-medium transition-all active:scale-[0.96]" style={{ border: `1px solid ${P.grayBorder}`, color: "#E8E2D4", background: "#2A2522" }}>
            Batal
          </button>
          <button onClick={handleSave} disabled={isSaving} className="rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all active:scale-[0.96] disabled:opacity-50" style={{ background: P.purple }}>
            {isSaving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
