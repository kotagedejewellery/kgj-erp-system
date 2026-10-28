"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Loader2, Check, AlertTriangle, Key } from "lucide-react";
import BrandHeader from "@/components/qr/BrandHeader";

type Step = "loading" | "info" | "current" | "enter" | "confirm" | "success" | "error";
type Mode = "set" | "change";

interface UserProfile {
  id: string;
  full_name: string;
  username: string;
  pin_hash: string | null;
  role: { name: string; role_group: string };
}

const PIN_LENGTH = 6;

function PinDots({ filled }: { filled: number }) {
  return (
    <div className="flex justify-center gap-3">
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <div
          key={i}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-lg font-bold transition-all ${
            i < filled
              ? "border-stone-800 bg-stone-800 text-white"
              : "border-stone-200 bg-white text-transparent"
          }`}
        >
          {i < filled ? "●" : "○"}
        </div>
      ))}
    </div>
  );
}

function Numpad({
  onDigit, onClear, onSubmit, disabled, showSubmit,
}: {
  onDigit: (d: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  disabled: boolean;
  showSubmit: boolean;
}) {
  return (
    <div className="mx-auto max-w-[260px]">
      {[
        ["1", "2", "3"],
        ["4", "5", "6"],
        ["7", "8", "9"],
        ["", "0", ""],
      ].map((row, rowIdx) => (
        <div key={rowIdx} className="mb-3 flex justify-center gap-3">
          {row.map((digit, colIdx) => {
            if (rowIdx === 3 && colIdx === 0) {
              return (
                <button
                  key="clear"
                  type="button"
                  onClick={onClear}
                  disabled={disabled}
                  className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-stone-200 bg-white text-[13px] font-medium text-stone-400 transition-all hover:border-stone-300 hover:bg-stone-50 active:scale-[0.95] disabled:opacity-30"
                >
                  Hapus
                </button>
              );
            }
            if (rowIdx === 3 && colIdx === 2) {
              return showSubmit ? (
                <button
                  key="submit"
                  type="button"
                  onClick={onSubmit}
                  disabled={disabled}
                  className="flex h-16 w-16 items-center justify-center rounded-xl bg-stone-800 text-white shadow-sm transition-all hover:bg-stone-900 active:scale-[0.95] disabled:opacity-30"
                >
                  {disabled ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    )}
                </button>
              ) : (
                <div key="sp" className="h-16 w-16" />
              );
            }
            if (digit === "") return <div key={`e-${colIdx}`} className="h-16 w-16" />;
            return (
              <button
                key={digit}
                type="button"
                onClick={() => onDigit(digit)}
                disabled={disabled}
                className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-stone-200 bg-white text-[22px] font-semibold text-stone-700 transition-all hover:border-stone-300 hover:bg-stone-50 active:scale-[0.95] disabled:opacity-50"
              >
                {digit}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function PinSettingsPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [mode, setMode] = useState<Mode>("set");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [stepLabel, setStepLabel] = useState("");
  const [pin, setPin] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // ── Load user profile ───────────────────────────────────────────────

  const { data: user, error } = useQuery<UserProfile>({
    queryKey: ["me-workshop-pin"],
    queryFn: async () => {
      const res = await fetcher<{ data: UserProfile }>("/api/me");
      return res.data;
    },
  });

  useEffect(() => {
    if (error) {
      setErrMsg(error instanceof Error ? error.message : "Gagal memuat data");
      setStep("error");
      return;
    }
    if (!user) return;
    const rg = user.role?.role_group;
    if (rg !== "production" && rg !== "operational") {
      setErrMsg("Fitur ini hanya untuk pekerja workshop");
      setStep("error");
      return;
    }
    setMode(user.pin_hash ? "change" : "set");
    setStep("info");
  }, [user, error]);

  // ── PIN input helpers ───────────────────────────────────────────────

  const handleDigit = useCallback((d: string) => {
    setPin((prev) => (prev.length < PIN_LENGTH ? prev + d : prev));
  }, []);

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPin("");
  }, []);

  const resetInput = useCallback(() => {
    setPin("");
    setErrMsg(null);
  }, []);

  // ── Flow actions ────────────────────────────────────────────────────

  const startSet = () => {
    setStep("enter");
    setStepLabel("Masukkan PIN Baru (6 digit)");
    resetInput();
  };

  const startChange = () => {
    setStep("current");
    setStepLabel("Masukkan PIN Saat Ini");
    resetInput();
  };

  const goBack = () => {
    if (step === "enter" || step === "current") {
      setStep("info");
      resetInput();
    } else if (step === "confirm") {
      setStep("enter");
      setStepLabel("Masukkan PIN Baru (6 digit)");
      resetInput();
    }
  };

  const oldPinRef = useRef("");
  const newPinRef = useRef("");
  const autoAdvanceRef = useRef<() => void>(() => {});

  // ── Auto-advance on fill ────────────────────────────────────────────

  const autoAdvance = useCallback(async () => {
    if (submitting || pin.length !== PIN_LENGTH) return;

    if (step === "current" && mode === "change") {
      setSubmitting(true);
      try {
        const res = await fetch("/api/auth/workshop-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", currentPin: pin }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "PIN saat ini salah");
        oldPinRef.current = pin;
        resetInput();
        setStep("enter");
        setStepLabel("Masukkan PIN Baru (6 digit)");
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "PIN saat ini salah");
        setPin("");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === "enter" && mode === "set") {
      // Got new PIN, move to confirm
      newPinRef.current = pin;
      resetInput();
      setStep("confirm");
      setStepLabel("Konfirmasi PIN Baru");
      return;
    }

    if (step === "enter" && mode === "change") {
      // Got new PIN, move to confirm
      newPinRef.current = pin;
      resetInput();
      setStep("confirm");
      setStepLabel("Konfirmasi PIN Baru");
      return;
    }

    if (step === "confirm" && mode === "set") {
      if (pin !== newPinRef.current) {
        setErrMsg("PIN tidak cocok. Silakan coba lagi.");
        resetInput();
        setStep("enter");
        setStepLabel("Masukkan PIN Baru (6 digit)");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/auth/workshop-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set", newPin: pin }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Gagal mengatur PIN");
        setStep("success");
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "Gagal mengatur PIN");
        resetInput();
        setStep("enter");
        setStepLabel("Masukkan PIN Baru (6 digit)");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (step === "confirm" && mode === "change") {
      if (pin !== newPinRef.current) {
        setErrMsg("PIN tidak cocok. Silakan coba lagi.");
        resetInput();
        setStep("enter");
        setStepLabel("Masukkan PIN Baru (6 digit)");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/auth/workshop-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "change", currentPin: oldPinRef.current, newPin: pin }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Gagal mengubah PIN");
        setStep("success");
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : "Gagal mengubah PIN");
        resetInput();
        setStep("enter");
        setStepLabel("Masukkan PIN Baru (6 digit)");
      } finally {
        setSubmitting(false);
      }
      return;
    }
  }, [pin, step, mode, submitting, resetInput]);

  autoAdvanceRef.current = autoAdvance;

  // Auto-advance when PIN fills
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !submitting) {
      autoAdvanceRef.current();
    }
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Key handling ────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
      else if (e.key === "Backspace" || e.key === "Delete") handleDelete();
      else if (e.key === "Escape") handleClear();
    },
    [handleDigit, handleDelete, handleClear],
  );

  // ── Render helpers ──────────────────────────────────────────────────

  const renderPinPad = (label: string, showSubmit: boolean) => (
    <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown} className="outline-none">
      <p className="mb-6 text-center text-[11px] uppercase tracking-wider text-stone-400">
        {label}
      </p>

      <PinDots filled={pin.length} />

      <div className="mt-4 mb-2 text-center text-[12px] text-stone-400">
        {pin.length}/{PIN_LENGTH} digit
      </div>

      {errMsg && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-2.5 text-center text-[13px] text-red-600 border border-red-100">
          {errMsg}
        </div>
      )}

      <Numpad
        onDigit={handleDigit}
        onClear={handleClear}
        onSubmit={autoAdvance}
        disabled={submitting}
        showSubmit={showSubmit}
      />

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={goBack}
          disabled={submitting}
          className="text-[13px] text-stone-400 underline underline-offset-2 transition-colors hover:text-stone-600 disabled:opacity-40"
        >
          ← Kembali
        </button>
      </div>
    </div>
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Loading ─────────────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <div className="w-full max-w-[380px]">
        <BrandHeader subtitle="PIN Settings" />
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="h-10 w-10 rounded-full border-2 border-stone-200 border-t-amber-500 animate-spin" />
          <p className="text-[13px] text-stone-400">Memuat...</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────

  if (step === "error") {
    return (
      <div className="w-full max-w-[380px] text-center">
        <BrandHeader subtitle="PIN Settings" />
        <div className="rounded-2xl border border-red-100 bg-white/90 p-7 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-7 w-7 text-red-400" strokeWidth={1.5} />
            </div>
          <p className="text-[14px] text-stone-600 mb-5">{errMsg}</p>
          <button
            onClick={() => router.push("/workshop/input")}
            className="text-[14px] font-medium text-amber-600 hover:text-amber-700"
          >
            Kembali ke Input
          </button>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="w-full max-w-[380px] text-center">
        <BrandHeader subtitle="PIN Settings" />
        <div className="rounded-2xl border border-emerald-100 bg-white/90 p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <Check className="h-8 w-8 text-emerald-500" strokeWidth={2.5} />
            </div>
          <p className="text-[16px] font-semibold text-stone-800 mb-2">Berhasil!</p>
          <p className="text-[13px] text-stone-500 mb-6">
            {mode === "set"
              ? "PIN berhasil diatur."
              : "PIN berhasil diperbarui."}
          </p>
          <button
            onClick={() => router.push("/workshop/input")}
            className="rounded-xl bg-stone-800 px-6 py-2.5 text-[14px] font-medium text-white shadow-sm hover:bg-stone-900 active:scale-[0.98] transition-all"
          >
            Kembali ke Input
          </button>
        </div>
      </div>
    );
  }

  // ── Info (initial state) ────────────────────────────────────────────

  if (step === "info") {
    return (
      <div className="w-full max-w-[380px]">
        <BrandHeader subtitle="PIN Settings" />
        <div className="rounded-2xl border border-stone-200/80 bg-white/90 backdrop-blur-sm shadow-sm p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-50">
              <Key className="h-8 w-8 text-stone-500" strokeWidth={1.5} />
            </div>
          <p className="text-[15px] font-semibold text-stone-800">{user?.full_name}</p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-stone-100 text-stone-600">
            {user?.pin_hash ? (
              <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> PIN Aktif</>
            ) : (
              <><span className="h-1.5 w-1.5 rounded-full bg-stone-400" /> PIN Belum Diatur</>
            )}
          </div>
          <div className="mt-6 space-y-3">
            {user?.pin_hash ? (
              <button
                onClick={startChange}
                className="w-full rounded-xl bg-stone-800 py-3 text-[14px] font-medium text-white shadow-sm hover:bg-stone-900 active:scale-[0.98] transition-all"
              >
                Ubah PIN
              </button>
            ) : (
              <button
                onClick={startSet}
                className="w-full rounded-xl bg-stone-800 py-3 text-[14px] font-medium text-white shadow-sm hover:bg-stone-900 active:scale-[0.98] transition-all"
              >
                Atur PIN
              </button>
            )}
            <button
              onClick={() => router.push("/workshop/input")}
              className="w-full rounded-xl border border-stone-200 bg-white py-3 text-[14px] font-medium text-stone-600 hover:bg-stone-50 active:scale-[0.98] transition-all"
            >
              Kembali ke Input
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Current PIN (change flow only) ─────────────────────────────────

  if (step === "current") {
    return (
      <div className="w-full max-w-[380px]">
        <BrandHeader subtitle="PIN Settings" />
        <div className="rounded-2xl border border-stone-200/80 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          {renderPinPad("Masukkan PIN Saat Ini", false)}
        </div>
      </div>
    );
  }

  // ── Enter new PIN ──────────────────────────────────────────────────

  if (step === "enter") {
    return (
      <div className="w-full max-w-[380px]">
        <BrandHeader subtitle="PIN Settings" />
        <div className="rounded-2xl border border-stone-200/80 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          {renderPinPad(stepLabel, false)}
        </div>
      </div>
    );
  }

  // ── Confirm PIN ────────────────────────────────────────────────────

  if (step === "confirm") {
    return (
      <div className="w-full max-w-[380px]">
        <BrandHeader subtitle="PIN Settings" />
        <div className="rounded-2xl border border-stone-200/80 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          {renderPinPad(stepLabel, false)}
        </div>
      </div>
    );
  }

  return null;
}
