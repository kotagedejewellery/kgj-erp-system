// app/login/page.tsx

"use client";

import { useState, useEffect, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Loading from "@/components/ui/Loading";
import { getDashboardPath, queryParamToAppRole } from "@/lib/routes";
import { setClientUser, type LoginRole } from "@/lib/auth/session";
import {
  Shield,
  ArrowLeft,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  BriefcaseBusiness,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
// ROLE CONFIGS & ICONS
// ════════════════════════════════════════════════════════════════════════════

interface RoleConfig {
  value: LoginRole;
  label: string;
  colors: { border: string; bg: string; text: string };
  icon: React.ReactNode;
}

const ROLE_CONFIGS: RoleConfig[] = [
  {
    value: "superadmin",
    label: "Super Admin",
    colors: {
      border: "#f0c96b",
      bg: "rgba(240,201,107,0.1)",
      text: "#b8860b",
    },
    icon: <BriefcaseBusiness className="w-full h-full" />,
  },
  {
    value: "management",
    label: "Management",
    colors: {
      border: "#c084fc",
      bg: "rgba(192,132,252,0.1)",
      text: "#9333ea",
    },
    icon: <Shield className="w-full h-full" />,
  },
  {
    value: "after_sales",
    label: "After Sales",
    colors: {
      border: "#2dd4bf",
      bg: "rgba(45,212,191,0.1)",
      text: "#14b8a6",
    },
    icon: <BriefcaseBusiness className="w-full h-full" />,
  },
];

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<LoginRole>("superadmin");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForgotDialog, setShowForgotDialog] = useState(false);

  const visibleRoles = ROLE_CONFIGS;

  useEffect(() => {
    const roleFromParam = queryParamToAppRole(searchParams.get("role"));
    if (roleFromParam) {
      startTransition(() => {
        setRole(roleFromParam);
      });
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!email || !password) {
      setError("Email dan password harus diisi!");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login gagal!");
        setIsLoading(false);
        return;
      }

      setClientUser({
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName,
        role: data.user.role,
        username: data.user.username ?? null,
        roleDetail: data.user.roleDetail ?? null,
      });

      const targetPath = getDashboardPath(data.user.role);

      if (!targetPath) {
        setError(`Role tidak dikenali: ${data.user.role}`);
        setIsLoading(false);
        return;
      }

      router.push(targetPath);
      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError("Terjadi kesalahan pada server!");
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .bgDust {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background:
            linear-gradient(45deg, rgba(201, 162, 39, 0.06) 25%, transparent 25%, transparent 75%, rgba(201, 162, 39, 0.06) 75%),
            linear-gradient(-45deg, rgba(201, 162, 39, 0.06) 25%, transparent 25%, transparent 75%, rgba(201, 162, 39, 0.06) 75%);
          background-size: 80px 80px;
          background-position: 0 0, 40px 40px;
        }
        .orbGold {
          position: fixed; width: 520px; height: 520px; border-radius: 50%; pointer-events: none; z-index: 0;
          background: radial-gradient(circle, rgba(201, 162, 39, 0.1) 0%, transparent 70%);
          top: -160px; right: -100px;
        }
        .orbAccent {
          position: fixed; width: 400px; height: 400px; border-radius: 50%; pointer-events: none; z-index: 0;
          background: radial-gradient(circle, rgba(74, 31, 31, 0.06) 0%, transparent 70%);
          bottom: -120px; left: 20%;
        }
        .orbWarm {
          position: fixed; width: 300px; height: 300px; border-radius: 50%; pointer-events: none; z-index: 0;
          background: radial-gradient(circle, rgba(201, 162, 39, 0.05) 0%, transparent 70%);
          top: 40%; left: -60px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

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

        {/* Back link — floating chip top-left */}
        <Link
          href="/"
          className="absolute top-5 left-5 inline-flex items-center gap-1.5 text-xs text-white/35 bg-white/[0.04] border border-white/[0.07] rounded-full px-3.5 py-1.5 transition-all hover:text-[#e8e2d4] hover:bg-white/[0.07] hover:border-white/[0.12] z-20 no-underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>

        {/* Main content column - larger spacing to fill page */}
        <div className="relative z-10 flex flex-col items-center w-full max-w-[580px] px-6 sm:px-12 py-2 sm:py-4 gap-y-1.5 sm:gap-y-3">
          {/* Logo */}
          <Image
            src="/logo.png"
            alt="KGJ"
            width={100}
            height={100}
            className="w-36 h-36 sm:w-44 sm:h-44 object-contain shrink-0"
            priority
          />

          {/* Brand title */}
          <h1 className="font-[var(--font-dm-serif)] text-base sm:text-lg md:text-2xl text-[#c9a227] tracking-[0.1em]">
            Kotagede Jewellery
          </h1>

          {/* Gold filigree ornament */}
          <div className="w-48 sm:w-56 h-4 opacity-50 mb-1 sm:mb-3">
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

          {/* Frosted glass card - gold border + true glassmorphism with inner border */}
           <div className="w-full rounded-[20px] border border-[#c9a227]/30 px-5 sm:px-6 md:px-8 py-3 sm:py-5 md:py-6 bg-[#1C1917]/70 backdrop-blur-[20px] relative shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_32px_rgba(0,0,0,0.35)]">
            {/* Inner 1px border for glass refraction */}
            <div className="absolute inset-[1px] rounded-[19px] border border-white/[0.03] pointer-events-none" />
            <h2 className="font-[var(--font-dm-serif)] text-lg sm:text-2xl text-[#f0f4ff] text-center mb-2 tracking-[-0.01em] [text-wrap:balance]">
              Selamat Datang
            </h2>
            <p className="text-[13px] sm:text-base text-white/40 text-center mb-2 sm:mb-2">
              Login untuk mengakses dashboard
            </p>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-red-500/[0.08] border border-red-500/[0.15] px-3.5 py-3 mb-2 text-[13px] text-red-300 leading-relaxed">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <p className="text-xs font-semibold text-white/35 text-center tracking-[0.06em] uppercase mb-2.5">
                Pilih Role
              </p>
              {/* Role selection - responsive grid with per-role colors */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                {visibleRoles.map((config) => {
                  const isActive = role === config.value;
                  return (
                    <button
                      key={config.value}
                      type="button"
                      onClick={() => setRole(config.value)}
                      disabled={isLoading}
                      aria-pressed={isActive}
                      className={`flex min-h-[84px] flex-col items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border-2 text-[13px] font-medium transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed w-full ${
                        isActive
                          ? "text-white"
                          : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                      }`}
                      style={
                        isActive
                          ? {
                              borderColor: config.colors.border,
                              backgroundColor: config.colors.bg,
                              color: config.colors.text,
                              boxShadow: `0 0 16px ${config.colors.border}40`,
                            }
                          : undefined
                      }
                    >
                      <div className="w-5 h-5 flex-shrink-0">{config.icon}</div>
                      <span className="text-center leading-tight">
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mb-2">
                <label className="block text-[13px] font-medium text-white/50 tracking-[0.01em] mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[10px] border border-white/[0.08] bg-white/[0.06] py-2.5 sm:py-3 pl-[42px] pr-3.5 text-[13px] sm:text-sm text-[#e8e2d4] placeholder:text-white/[0.12] focus:border-[#c9a227] focus:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/[0.08] transition-all disabled:opacity-40"
                    placeholder="nama@email.com"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="mb-2">
                <label className="block text-[13px] font-medium text-white/50 tracking-[0.01em] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none">
                    <Lock className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[10px] border border-white/[0.08] bg-white/[0.06] py-2.5 sm:py-3 pl-[42px] pr-10 text-[13px] sm:text-sm text-[#e8e2d4] placeholder:text-white/[0.12] focus:border-[#c9a227] focus:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-[#c9a227]/[0.08] transition-all disabled:opacity-40"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/20 hover:text-white/40 transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => setShowForgotDialog(true)}
                    className="text-[12px] text-[#c9a227] hover:text-[#b8921e] font-medium underline-offset-2 hover:underline transition-colors bg-transparent border-none cursor-pointer"
                  >
                    Lupa password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-[#CA8A04] py-3.5 text-[15px] font-semibold text-[#1a1a1a] transition-all duration-200 hover:bg-[#d4ae3a] hover:shadow-[0_0_24px_rgba(202,138,4,0.3)] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 mt-3"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#15130f]/[0.2] border-t-[#15130f] rounded-full animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    Masuk ke Dashboard
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {isLoading && (
          <div className="fixed inset-0 bg-[#15130f]/[0.85] backdrop-blur-[4px] flex items-center justify-center z-50">
            <Loading
              variant="dots"
              size="lg"
              text="Memverifikasi akun..."
            />
          </div>
        )}

        {/* Forgot Password Dialog */}
        {showForgotDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowForgotDialog(false)}>
            <div className="relative rounded-[16px] border border-[#c9a227]/30 bg-[#1C1917] px-8 py-6 max-w-[380px] w-full mx-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
              {/* Inner border for refraction */}
              <div className="absolute inset-[1px] rounded-[15px] border border-white/[0.03] pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#c9a227]/10 flex items-center justify-center mb-2">
                  <Lock className="w-6 h-6 text-[#c9a227]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Fitur Belum Tersedia</h3>
                <p className="text-sm text-white/60 mb-2 leading-relaxed">
                  Mohon maaf, fitur lupa password sedang dalam pengembangan. Silahkan hubungi administrator untuk reset password.
                </p>
                <button
                  onClick={() => setShowForgotDialog(false)}
                  className="w-full rounded-xl bg-[#c9a227] py-3 text-[15px] font-semibold text-[#1a1a1a] transition-all hover:bg-[#d4ae3a] active:scale-[0.98]"
                >
                  Mengerti
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
