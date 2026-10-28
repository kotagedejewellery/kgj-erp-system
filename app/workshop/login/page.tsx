"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import { ArrowLeft, Loader2, Check, Delete, User, Lock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { getDashboardPath } from "@/lib/routes";
import { setClientUser, type UserRoleDetail } from "@/lib/auth/session";
import Loading from "@/components/ui/Loading";

type Step = "loading" | "workers" | "pin" | "setup" | "manual";

interface WorkerInfo {
  id: string;
  full_name: string;
  username: string;
  has_pin?: boolean;
}

const PIN_LENGTH = 6;

function PinDots({ filled }: { filled: number }) {
  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {Array.from({ length: PIN_LENGTH }).map((_, i) => (
        <div
          key={i}
          className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl border text-lg font-bold transition-all ${
            i < filled
              ? "border-[#c9a227] bg-[#c9a227] text-[#15130f]"
              : "border-white/[0.08] bg-white/[0.04] text-transparent"
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
        <div key={rowIdx} className="mb-2 sm:mb-3 flex justify-center gap-2 sm:gap-3">
          {row.map((digit, colIdx) => {
            if (rowIdx === 3 && colIdx === 0) {
              return (
                <button
                  key="clear"
                  type="button"
                  onClick={onClear}
                  disabled={disabled}
                  className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[12px] sm:text-[13px] font-medium text-white/30 transition-all hover:border-white/[0.15] hover:bg-white/[0.08] active:scale-[0.95] disabled:opacity-20"
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
                  className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl bg-[#c9a227] text-[#15130f] transition-all hover:bg-[#d4ae3a] active:scale-[0.95] disabled:opacity-30"
                >
                  {disabled ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  )}
                </button>
              ) : (
                <div key="sp" className="h-14 w-14 sm:h-16 sm:w-16" />
              );
            }
            if (digit === "") return <div key={`e-${colIdx}`} className="h-14 w-14 sm:h-16 sm:w-16" />;
            return (
              <button
                key={digit}
                type="button"
                onClick={() => onDigit(digit)}
                disabled={disabled}
                className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[20px] sm:text-[22px] font-semibold text-[#e8e2d4] transition-all hover:border-white/[0.15] hover:bg-white/[0.08] active:scale-[0.95] disabled:opacity-30"
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

function WorkshopLoginContent() {
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get("redirect") || "/workshop/input";
  const orderId = searchParams.get("order_id");
  const stage = searchParams.get("stage");
  const qrToken = searchParams.get("qr_token");

  const [step, setStep] = useState<Step>(qrToken ? "workers" : "manual");
  const [selectedWorker, setSelectedWorker] = useState<WorkerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: workers = [] } = useQuery<WorkerInfo[]>({
    queryKey: ["workshop-workers", qrToken],
    queryFn: async () => {
      const res = await fetcher<{ success: boolean; data: { workers: WorkerInfo[] } }>(
        `/api/workshop/workers?qr_token=${encodeURIComponent(qrToken!)}`,
      );
      return res.data?.workers ?? [];
    },
    enabled: !!qrToken,
  });
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // Setup state
  const [setupPin, setSetupPin] = useState("");
  const [setupPhase, setSetupPhase] = useState<"enter" | "confirm">("enter");
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const setupNewPinRef = useRef("");

  const containerRef = useRef<HTMLDivElement>(null);

  const loadingText =
    step === "manual" ? "Memverifikasi..." :
    step === "setup" ? "Menyimpan PIN..." :
    "Memverifikasi PIN...";

  // ── Manual login state ──────────────────────────────────────────


  // ── Helpers to redirect after login ─────────────────────────────

  const doRedirect = useCallback(
    (roleName: string, roleGroup: string) => {
      const SUPERVISOR_ROLE_NAMES = ["operational_supervisor", "production_supervisor"];
      if (SUPERVISOR_ROLE_NAMES.includes(roleName) || roleGroup === "management") {
        const path = getDashboardPath(roleName) || "/dashboard/supervisor/monitoring";
        window.location.href = path;
        return;
      }

      const params = new URLSearchParams();
      if (orderId) params.set("order_id", orderId);
      if (stage) params.set("stage", stage);
      if (qrToken) params.set("qr_token", qrToken);
      const targetUrl = `${redirectTo}?${params.toString()}`;
      window.location.href = targetUrl;
    },
    [redirectTo, orderId, stage, qrToken],
  );

  const saveSupervisorSession = useCallback((email: string, user: WorkshopLoginUser | undefined) => {
    if (!email || !user || user.roleDetail?.role_group !== "management") return;
    setClientUser({
      id: user.id,
      email,
      fullName: user.fullName,
      username: user.username,
      role: "supervisor",
      roleDetail: user.roleDetail,
    });
  }, []);

  // ── Client-side Supabase client ─────────────────────────────────

  const browserSupabase = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  const getBrowserClient = useCallback(() => {
    if (!browserSupabase.current) {
      browserSupabase.current = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      );
    }
    return browserSupabase.current;
  }, []);

  const signInAndRedirect = useCallback(
    async (email: string, password: string, user: WorkshopLoginUser) => {
      const sb = getBrowserClient();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      saveSupervisorSession(email, user);
      doRedirect(user.role, user.roleDetail?.role_group ?? "");
    },
    [getBrowserClient, doRedirect, saveSupervisorSession],
  );

  // ── Manual login handler ────────────────────────────────────────

  const handleManualLogin = useCallback(
    async (username: string, password: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/auth/qr-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Login gagal");

        saveSupervisorSession(data.user?.email ?? "", data.user);
        doRedirect(data.user?.role ?? "", data.user?.roleDetail?.role_group ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan, coba lagi");
      } finally {
        setIsLoading(false);
      }
    },
    [doRedirect, saveSupervisorSession],
  );

  // ── PIN login handler ───────────────────────────────────────────

  const handlePinLogin = useCallback(
    async (pin: string) => {
      if (!selectedWorker || !qrToken) return;
      setIsLoading(true);
      setError(null);
      setRemainingAttempts(null);

      try {
        const res = await fetch("/api/auth/pin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selectedWorker.id,
            pin,
            qr_token: qrToken,
          }),
        });

        const data = await res.json();

        if (data.needs_pin_setup) {
          setStep("setup");
          setSetupPhase("enter");
          setSetupPin("");
          setSetupError(null);
          return;
        }

        if (!res.ok) {
          if (data.remaining_attempts !== undefined) {
            setRemainingAttempts(data.remaining_attempts);
          }
          throw new Error(data.error || "Login gagal");
        }

        await signInAndRedirect(
          data.email,
          data.workshopPassword,
          data.user,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan, coba lagi");
      } finally {
        setIsLoading(false);
      }
    },
    [selectedWorker, qrToken, signInAndRedirect],
  );

  // ── PIN setup handler ───────────────────────────────────────────

  const submitPinSetup = useCallback(
    async (newPin: string) => {
      if (!selectedWorker || !qrToken) return;
      setSetupSubmitting(true);
      setSetupError(null);

      try {
        const res = await fetch("/api/auth/pin-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selectedWorker.id,
            pin: newPin,
            qr_token: qrToken,
            setup_pin: newPin,
          }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Gagal menyimpan PIN");

        await signInAndRedirect(
          data.email,
          data.workshopPassword,
          data.user,
        );
      } catch (err) {
        setSetupError(err instanceof Error ? err.message : "Terjadi kesalahan, coba lagi");
      } finally {
        setSetupSubmitting(false);
      }
    },
    [selectedWorker, qrToken, signInAndRedirect],
  );

  // ── Step transitions ───────────────────────────────────────────

  const handleSelectWorker = useCallback((worker: WorkerInfo) => {
    setSelectedWorker(worker);
    if (worker.has_pin === false) {
      setStep("setup");
      setSetupPhase("enter");
      setSetupPin("");
      setSetupError(null);
    } else {
      setStep("pin");
    }
    setError(null);
    setRemainingAttempts(null);
  }, []);

  const handleBackToWorkers = useCallback(() => {
    setStep("workers");
    setSelectedWorker(null);
    setError(null);
    setRemainingAttempts(null);
  }, []);

  const handleBackFromSetup = useCallback(() => {
    setStep("workers");
    setSelectedWorker(null);
    setSetupPin("");
    setSetupError(null);
    setSetupPhase("enter");
  }, []);

  const handleSwitchToManual = useCallback(() => {
    setStep("manual");
    setError(null);
    setRemainingAttempts(null);
  }, []);

  const handleBackFromManual = useCallback(() => {
    setStep(qrToken ? "workers" : "manual");
    setError(null);
  }, [qrToken]);

  // ── Setup PIN input handling ────────────────────────────────────

  const handleSetupDigit = useCallback((d: string) => {
    setSetupPin((prev) => (prev.length < PIN_LENGTH ? prev + d : prev));
  }, []);

  const handleSetupClear = useCallback(() => {
    setSetupPin("");
  }, []);

  const handleSetupDelete = useCallback(() => {
    setSetupPin((prev) => prev.slice(0, -1));
  }, []);

  const setupSubmittingRef = useRef(false);

  useEffect(() => {
    if (setupSubmitting || setupSubmittingRef.current || setupPin.length !== PIN_LENGTH) return;

    if (setupPhase === "enter") {
      setupNewPinRef.current = setupPin;
      setSetupPin("");
      setSetupPhase("confirm");
      return;
    }

    if (setupPhase === "confirm") {
      if (setupPin !== setupNewPinRef.current) {
        setSetupError("PIN tidak cocok. Silakan coba lagi.");
        setSetupPin("");
        setSetupPhase("enter");
        return;
      }
      setupSubmittingRef.current = true;
      const pin = setupPin;
      setSetupPin("");
      submitPinSetup(pin).finally(() => {
        setupSubmittingRef.current = false;
      });
    }
  }, [setupPin, setupPhase, setupSubmitting, submitPinSetup]);

  const handleSetupKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") handleSetupDigit(e.key);
      else if (e.key === "Backspace" || e.key === "Delete") handleSetupDelete();
      else if (e.key === "Escape") handleSetupClear();
    },
    [handleSetupDigit, handleSetupDelete, handleSetupClear],
  );

  // ──── Render ────────────────────────────────────────────────────

  const stageLabel = stage ? stage.replace(/_/g, " ") : null;

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#1C1917] text-[#FAFAF9] font-[var(--font-dm-sans)]">
        {/* Background - visible geometric pattern + orbs */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          {/* Crosshatch geometric texture */}
          <div className="absolute inset-0 opacity-40" style={{
            background: `
              linear-gradient(45deg, rgba(201, 162, 39, 0.12) 25%, transparent 25%, transparent 75%, rgba(201, 162, 39, 0.12) 75%),
              linear-gradient(-45deg, rgba(201, 162, 39, 0.12) 25%, transparent 25%, transparent 75%, rgba(201, 162, 39, 0.12) 75%)`
              , backgroundSize: '40px 40px', backgroundPosition: '0 0, 20px 20px'
          }} />
          <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full opacity-40 blur-[120px]" style={{ background: "radial-gradient(circle, rgba(201,162,39,.12) 0%, transparent 70%)" }} />
          <div className="absolute bottom-[-160px] left-1/4 h-[480px] w-[480px] rounded-full opacity-30 blur-[100px]" style={{ background: "radial-gradient(circle, rgba(74,31,31,.08) 0%, transparent 70%)" }} />
        </div>

        {/* Back link - floating chip top-left */}
        <Link
          href="/"
          className="absolute top-5 left-5 inline-flex items-center gap-1.5 text-xs text-white/35 bg-white/[0.04] border border-white/[0.07] rounded-full px-3.5 py-1.5 transition-all hover:text-[#e8e2d4] hover:bg-white/[0.07] hover:border-white/[0.12] z-20 no-underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>

        {/* Main content column */}
        <div className="relative z-10 flex flex-col items-center w-full max-w-[580px] px-6 sm:px-12 pt-1 sm:pt-4 pb-4 gap-y-1 sm:gap-y-3">
          {/* Logo */}
          <Image src="/logo.png" alt="KGJ" width={100} height={100} className="w-36 h-36 sm:w-44 sm:h-44 object-contain shrink-0" priority />

          {/* Brand title */}
          <h1 className="font-[var(--font-dm-serif)] text-base sm:text-lg md:text-2xl text-[#c9a227] tracking-[0.1em] mb-2">
            Kotagede Jewellery
          </h1>

          <div className="hidden sm:block w-48 sm:w-56 h-4 opacity-50 mb-2 sm:mb-3">
            <svg viewBox="0 0 200 12" className="w-full h-full text-[#c9a227]" fill="none">
              <line x1="0" y1="6" x2="72" y2="6" stroke="currentColor" strokeWidth="0.5" />
              <path d="M72 6 Q80 0 88 6" stroke="currentColor" strokeWidth="0.5" />
              <path d="M72 6 Q80 12 88 6" stroke="currentColor" strokeWidth="0.5" />
              <polygon points="100,1.5 107,6 100,10.5 93,6" fill="currentColor" opacity="0.5" />
              <path d="M112 6 Q120 0 128 6" stroke="currentColor" strokeWidth="0.5" />
              <path d="M112 6 Q120 12 128 6" stroke="currentColor" strokeWidth="0.5" />
              <line x1="128" y1="6" x2="200" y2="6" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </div>

           {/* Stage info */}
           {stageLabel && (
              <div className="rounded-xl border border-[#c9a227]/[0.15] bg-[#c9a227]/[0.06] px-3 py-1.5 text-center">
               <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c9a227]/70">Akses Stage</p>
               <p className="mt-0.5 text-sm font-medium text-[#e8e2d4] capitalize">{stageLabel}</p>
             </div>
           )}

           {/* Frosted glass card - gold border + true glassmorphism with inner border */}
            <div className="w-full rounded-[20px] border border-[#c9a227]/30 px-4 sm:px-6 md:px-10 py-2.5 sm:py-5 md:py-8 bg-[#1C1917]/40 backdrop-blur-[20px] relative shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_32px_rgba(0,0,0,0.35)]">
            {/* Inner 1px border for glass refraction */}
            <div className="absolute inset-[1px] rounded-[19px] border border-white/[0.03] pointer-events-none" />
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full border border-[#c9a227]/40 bg-[#1C1917] px-3 sm:px-4 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.15em] text-[#c9a227] whitespace-nowrap">
                Workshop Access
              </span>
            </div>
            {/* Worker select */}
            {step === "workers" && (
              <div>
                <div className="mb-3 sm:mb-6 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-white/30">Pilih Pekerja</p>
                  <p className="mt-1 text-sm text-white/40">Siapa yang akan bekerja di workstation ini?</p>
                </div>

                {workers.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-8 text-center">
                    <p className="text-[15px] font-medium text-white/40">Tidak ada pekerja tersedia</p>
                    <p className="mt-1 text-[13px] text-white/25">Tidak ditemukan pekerja dengan role yang sesuai.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {workers.map((worker) => (
                      <button
                        key={worker.id}
                        type="button"
                        onClick={() => handleSelectWorker(worker)}
                        disabled={isLoading}
                        className="group flex flex-col items-center gap-1.5 sm:gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 sm:px-3 py-3 sm:py-5 transition-all hover:border-[#c9a227]/[0.3] hover:bg-[#c9a227]/[0.05] active:scale-[0.97] disabled:opacity-30"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-lg font-semibold text-white/40 transition-colors group-hover:bg-[#c9a227] group-hover:text-[#15130f]">
                          {worker.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-center text-[13px] font-medium text-white/50 transition-colors group-hover:text-white/80 truncate w-full">
                          {worker.full_name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

      <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={handleSwitchToManual}
                    className="text-[13px] text-white/25 underline underline-offset-2 transition-colors hover:text-white/50"
                  >
                    Login dengan username & password →
                  </button>
                </div>
              </div>
            )}

            {/* PIN entry */}
            {step === "pin" && selectedWorker && (
              <PinPadInline
                workerName={selectedWorker.full_name}
                error={error}
                remainingAttempts={remainingAttempts}
                isLoading={isLoading}
                onSubmit={handlePinLogin}
                onBack={handleBackToWorkers}
              />
            )}

            {/* PIN setup */}
            {step === "setup" && selectedWorker && (
              <div ref={containerRef} tabIndex={0} onKeyDown={handleSetupKeyDown} className="outline-none">
                <div className="mb-4 sm:mb-6 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-white/30">
                    {setupPhase === "enter" ? "Buat PIN Baru (6 digit)" : "Konfirmasi PIN"}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#f0f4ff]">{selectedWorker.full_name}</p>
                  <p className="mt-1 text-[12px] text-white/25">PIN digunakan untuk login via QR Code</p>
                </div>

                <PinDots filled={setupPin.length} />

                <div className="mt-4 mb-2 text-center text-[12px] text-white/25">
                  {setupPin.length}/{PIN_LENGTH} digit
                </div>

                {setupError && (
                  <div className="mb-6 rounded-lg bg-red-500/[0.08] border border-red-500/[0.15] px-4 py-2.5 text-center text-[13px] text-red-300">
                    {setupError}
                  </div>
                )}

                <Numpad
                  onDigit={handleSetupDigit}
                  onClear={handleSetupClear}
                  onSubmit={() => {}}
                  disabled={setupSubmitting}
                  showSubmit={false}
                />

                <div className="mt-4 sm:mt-6 text-center">
                  <button
                    type="button"
                    onClick={handleSetupDelete}
                    disabled={setupPin.length === 0 || setupSubmitting}
                    className="mb-2 sm:mb-3 flex h-10 sm:h-12 w-[148px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-[13px] sm:text-[14px] font-medium text-white/40 transition-all hover:border-white/[0.15] hover:bg-white/[0.08] active:scale-[0.95] disabled:opacity-20 mx-auto"
                  >
                    <Delete className="h-4 w-4" strokeWidth={1.5} />
                    Hapus
                  </button>
                  <br />
                  <button
                    type="button"
                    onClick={handleBackFromSetup}
                    disabled={setupSubmitting}
                    className="text-[13px] text-white/25 underline underline-offset-2 transition-colors hover:text-white/50 disabled:opacity-20"
                  >
                    ← Kembali ke daftar pekerja
                  </button>
                </div>
              </div>
            )}

            {/* Manual login */}
            {step === "manual" && (
              <div>
                <ManualLoginForm
                  isLoading={isLoading}
                  error={error}
                  onSubmit={handleManualLogin}
                  onBack={qrToken ? handleBackFromManual : undefined}
                />
              </div>
            )}
          </div>

          {(isLoading || setupSubmitting) && (
            <div className="fixed inset-0 bg-[#1C1917]/[0.85] backdrop-blur-[4px] flex items-center justify-center z-50">
              <Loading variant="dots" size="lg" text={loadingText} />
            </div>
          )}

          {/* Footer */}
          <p className="mt-0.5 sm:mt-3 text-center text-[11px] text-white leading-relaxed">
            Hanya staf workshop terdaftar. Hubungi admin jika kendala.
          </p>
        </div>
      </div>
  );
}

// ── Inline PIN pad component ───────────────────────────────────────

function PinPadInline({
  workerName, error, remainingAttempts, isLoading, onSubmit, onBack,
}: {
  workerName: string;
  error: string | null;
  remainingAttempts: number | null;
  isLoading: boolean;
  onSubmit: (pin: string) => void;
  onBack: () => void;
}) {
  const [pin, setPin] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { containerRef.current?.focus(); }, []);

  const handleDigit = useCallback((digit: string) => {
    if (pin.length < PIN_LENGTH && !isLoading) setPin((prev) => [...prev, digit]);
  }, [pin.length, isLoading]);

  const handleDelete = useCallback(() => {
    if (!isLoading) setPin((prev) => prev.slice(0, -1));
  }, [isLoading]);

  const handleClear = useCallback(() => {
    if (!isLoading) setPin([]);
  }, [isLoading]);

  const handleSubmit = useCallback(() => {
    if (pin.length === PIN_LENGTH && !isLoading) onSubmit(pin.join(""));
  }, [pin, isLoading, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key >= "0" && e.key <= "9") handleDigit(e.key);
    else if (e.key === "Backspace" || e.key === "Delete") handleDelete();
    else if (e.key === "Enter" && pin.length === PIN_LENGTH) handleSubmit();
    else if (e.key === "Escape") handleClear();
  }, [handleDigit, handleDelete, handleSubmit, handleClear, pin.length]);

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown} className="outline-none">
      <div className="mb-3 text-center">
        <p className="text-[11px] uppercase tracking-wider text-white/30">Masukkan PIN</p>
        <p className="mt-1 text-xl font-semibold text-[#f0f4ff]">{workerName}</p>
      </div>

      <div className="mb-4 flex justify-center gap-2 sm:gap-3">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg font-bold transition-all ${
              i < pin.length
                ? "border-[#c9a227] bg-[#c9a227] text-[#15130f]"
                : "border-white/[0.08] bg-white/[0.04] text-transparent"
            }`}
          >
            {i < pin.length ? "●" : "○"}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/[0.08] border border-red-500/[0.15] px-4 py-2.5 text-center text-[13px] text-red-300">
          {error}
        </div>
      )}

      {remainingAttempts !== null && remainingAttempts > 0 && (
        <p className="mb-3 text-center text-[12px] text-[#c9a227]/70">
          Sisa percobaan: {remainingAttempts}
        </p>
      )}

      <Numpad
        onDigit={handleDigit}
        onClear={handleClear}
        onSubmit={handleSubmit}
        disabled={isLoading}
        showSubmit={true}
      />

      <div className="mt-1.5 sm:mt-3 flex justify-center">
        <button
          type="button"
          onClick={handleDelete}
          disabled={pin.length === 0 || isLoading}
          className="flex h-10 sm:h-12 w-[148px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-[13px] sm:text-[14px] font-medium text-white/40 transition-all hover:border-white/[0.15] hover:bg-white/[0.08] active:scale-[0.95] disabled:opacity-20"
        >
          <Delete className="h-4 w-4" />
          Hapus
        </button>
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="text-[13px] text-white/25 underline underline-offset-2 transition-colors hover:text-white/50 disabled:opacity-20"
        >
          ← Kembali ke daftar pekerja
        </button>
      </div>
    </div>
  );
}

// ── Inline manual login form ───────────────────────────────────────

function ManualLoginForm({
  isLoading, error, onSubmit, onBack,
}: {
  isLoading: boolean;
  error: string | null;
  onSubmit: (username: string, password: string) => void;
  onBack?: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { usernameRef.current?.focus(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) onSubmit(username.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/30">Nama Pengguna</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20">
            <User className="h-4 w-4" />
          </span>
          <input
            ref={usernameRef}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username atau email"
            disabled={isLoading}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2 sm:py-2.5 pl-10 pr-4 text-[14px] sm:text-[15px] text-[#e8e2d4] placeholder:text-white/[0.12] focus:border-[#c9a227] focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/[0.08] transition-all disabled:opacity-30"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/30">Kata Sandi</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20">
            <Lock className="h-4 w-4" />
          </span>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2 sm:py-2.5 pl-10 pr-12 text-[14px] sm:text-[15px] text-[#e8e2d4] placeholder:text-white/[0.12] focus:border-[#c9a227] focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/[0.08] transition-all disabled:opacity-30"
            autoComplete="current-password"
            required
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/20 hover:text-white/40 transition-colors" tabIndex={-1}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/[0.08] border border-red-500/[0.15] px-4 py-2.5 flex items-start gap-2 text-[13px] text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !username.trim() || !password.trim()}
        className="mt-2 w-full rounded-xl bg-[#c9a227] py-2 sm:py-2.5 text-[13px] sm:text-[14px] font-medium text-[#15130f] transition-all hover:bg-[#d4ae3a] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memverifikasi...
          </span>
        ) : (
          "Masuk ke Workshop"
        )}
      </button>

      {onBack && (
        <div className="text-center">
          <button type="button" onClick={onBack} className="text-[13px] text-white/25 underline underline-offset-2 transition-colors hover:text-white/50">
            ← Kembali ke PIN
          </button>
        </div>
      )}
    </form>
  );
}

// ── Page export ─────────────────────────────────────────────────────

export default function WorkshopLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#15130f]">
          <div className="h-10 w-10 rounded-full border-2 border-[#c9a227]/[0.2] border-t-[#c9a227] animate-spin" />
        </div>
      }
    >
      <WorkshopLoginContent />
    </Suspense>
  );
}

interface WorkshopLoginUser {
  id: string;
  fullName: string;
  username: string | null;
  role: string;
  roleDetail: UserRoleDetail | null;
}
