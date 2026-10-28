"use client";

import React, { useEffect, useCallback } from "react";
import { X, User, Mail, Shield, Hash, Circle } from "lucide-react";

interface ProfileData {
  id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  status: string;
  role: {
    id: string;
    name: string;
    role_group: string;
    description: string | null;
  };
}

export default function ProfileModal({
  profile,
  onClose,
}: {
  profile: ProfileData | null;
  onClose: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!profile) return null;

  const formatRole = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const P = { purple: "#a78bfa", green: "#34d399", gray: "#a8a29e", grayBorder: "#c9a22733", ink: "#F5EFE3" };

  const rows: { icon: React.ReactNode; label: string; value: string; color?: string }[] = [
    { icon: <User className="h-4 w-4" />, label: "Full Name", value: profile.full_name || "—" },
    { icon: <Hash className="h-4 w-4" />, label: "Username", value: profile.username || "—" },
    { icon: <Mail className="h-4 w-4" />, label: "Email", value: profile.email || "—" },
    { icon: <Shield className="h-4 w-4" />, label: "Role", value: formatRole(profile.role.name), color: P.purple },
    { icon: <Shield className="h-4 w-4" />, label: "Role Group", value: formatRole(profile.role.role_group) },
    {
      icon: <Circle className="h-4 w-4" />,
      label: "Status",
      value: profile.status === "active" ? "Aktif" : "Nonaktif",
      color: profile.status === "active" ? P.green : "#dc2626",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: "#2A2522", border: `1px solid ${P.grayBorder}` }}>
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ background: "#7c3aed22", borderBottom: `1px solid ${P.grayBorder}` }}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: P.purple }}>Profil Saya</p>
            <p className="text-lg font-bold" style={{ color: P.ink }}>{profile.full_name}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 transition-all active:scale-[0.92] hover:bg-[#2a2522]" style={{ color: P.gray }} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {rows.map(({ icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="shrink-0" style={{ color: P.gray }}>{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: P.gray }}>{label}</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: color || P.ink }}>{value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end px-6 py-3 shrink-0" style={{ borderTop: `1px solid ${P.grayBorder}`, background: "#1C1917" }}>
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-xs font-medium transition-all active:scale-[0.96]" style={{ border: `1px solid ${P.grayBorder}`, color: "#E8E2D4", background: "#2A2522" }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
