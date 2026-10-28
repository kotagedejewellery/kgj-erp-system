// app/page.tsx

"use client";

import { useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getDashboardPath } from "@/lib/routes";
import { LogIn } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userRole = localStorage.getItem("userRole");
    const userEmail = localStorage.getItem("userEmail");

    if (userRole && userEmail) {
      const path = getDashboardPath(userRole);
      // Only redirect to actual dashboards — workshop roles map to /workshop/login
      // which is not relevant from the BMS landing page.
      if (path && path.startsWith("/dashboard")) {
        router.replace(path);
        return;
      }
    }
    startTransition(() => {
      setIsLoading(false);
    });
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1623]">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#1a2d4a] border-t-[#4f8ef7] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[rgba(200,210,240,0.45)] font-light tracking-wide">
            Memuat dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap');

        * { box-sizing: border-box; }

        body {
          margin: 0;
          background: #0f1623;
          overflow: hidden;
        }

        .page-root {
          font-family: 'DM Sans', sans-serif;
          background: #0f1623;
          color: #f0f4ff;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .grid-lines {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background:
            linear-gradient(45deg, rgba(201, 162, 39, 0.06) 25%, transparent 25%, transparent 75%, rgba(201, 162, 39, 0.06) 75%),
            linear-gradient(-45deg, rgba(201, 162, 39, 0.06) 25%, transparent 25%, transparent 75%, rgba(201, 162, 39, 0.06) 75%);
          background-size: 80px 80px;
          background-position: 0 0, 40px 40px;
        }

        .orb {
          position: absolute; border-radius: 50%;
          pointer-events: none;
        }
        .orb-1 { width: 420px; height: 420px; background: radial-gradient(circle, rgba(201, 162, 39, 0.1) 0%, transparent 70%); top: -120px; right: -60px; }
        .orb-2 { width: 320px; height: 320px; background: radial-gradient(circle, rgba(74, 31, 31, 0.08) 0%, transparent 70%); bottom: -80px; left: 25%; }
        .orb-3 { width: 240px; height: 240px; background: radial-gradient(circle, rgba(201, 162, 39, 0.06) 0%, transparent 70%); top: 50%; left: 8%; }

        /* LEFT PANEL — centered */
        .left-panel {
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          padding: 48px 52px; position: relative; z-index: 2; text-align: center;
          max-width: 640px; margin: 0 auto; flex: 1;
        }

        .brand-chip {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(79,142,247,0.1); border: 0.5px solid rgba(79,142,247,0.25);
          border-radius: 100px; padding: 5px 14px 5px 8px;
          margin-bottom: 28px;
          animation: fadeUp 0.5s ease both;
        }
        .brand-chip-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #4f8ef7;
          box-shadow: 0 0 8px rgba(79,142,247,0.8);
          animation: pulse 2s ease-in-out infinite;
        }
        .brand-chip span { font-size: 12px; font-weight: 500; color: #4f8ef7; letter-spacing: 0.04em; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .headline {
          font-family: 'DM Serif Display', serif;
          font-size: clamp(32px, 3.5vw, 46px);
          line-height: 1.1; letter-spacing: -0.02em;
          color: #f0f4ff; margin-bottom: 16px;
          animation: fadeUp 0.5s 0.1s ease both;
        }
        .headline em { font-style: italic; color: #f0c96b; }

        .sub {
          font-size: 15px; font-weight: 300;
          color: rgba(200,210,240,0.55); line-height: 1.65;
          max-width: 440px; margin-bottom: 36px;
          animation: fadeUp 0.5s 0.2s ease both;
        }

        .cta-group {
          display: flex; align-items: center; justify-content: center; gap: 14px;
          animation: fadeUp 0.5s 0.3s ease both;
        }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          background: #4f8ef7; color: white;
          padding: 12px 24px; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
          border: none; cursor: pointer; transition: all 0.2s ease;
          text-decoration: none; letter-spacing: 0.01em;
        }
        .btn-primary:hover {
          background: #5a9af8; transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(79,142,247,0.3);
        }
        .btn-primary:active { transform: scale(0.98); }

        .btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          color: rgba(200,210,240,0.55);
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 400;
          background: none; border: 0.5px solid rgba(255,255,255,0.07);
          border-radius: 10px; padding: 12px 20px;
          cursor: pointer; transition: all 0.2s ease; text-decoration: none;
        }
        .btn-ghost:hover {
          color: #f0f4ff; border-color: rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.035);
        }

        .stats-row {
          display: flex; justify-content: center; gap: 28px; margin-top: 44px;
          animation: fadeUp 0.5s 0.4s ease both;
        }
        .stat-num {
          font-family: 'DM Serif Display', serif; font-size: 26px;
          color: #f0f4ff; letter-spacing: -0.02em;
        }
        .stat-label { font-size: 12px; color: rgba(200,210,240,0.38); font-weight: 400; margin-top: 2px; letter-spacing: 0.02em; }
        .stat-div { width: 0.5px; background: rgba(255,255,255,0.07); align-self: stretch; }

        /* BOTTOM BAR */
        .bottom-bar {
          position: relative; z-index: 4; width: 100%;
          border-top: 0.5px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: center;
          padding: 12px 52px;
          background: rgba(15,22,35,0.6); backdrop-filter: blur(10px);
        }
        .bottom-info { font-size: 12px; color: rgba(200,210,240,0.3); }
        .status-wrap { display: flex; align-items: center; gap: 8px; }
        .status-dots { display: flex; align-items: center; gap: 5px; }
        .sdot { width: 6px; height: 6px; border-radius: 50%; }
        .sdot-1 { background: #4ade80; box-shadow: 0 0 6px rgba(74,222,128,0.6); animation: pulse 2s ease-in-out infinite; }
        .sdot-2 { background: rgba(74,222,128,0.4); }
        .sdot-3 { background: rgba(74,222,128,0.15); }
        .status-label { font-size: 12px; color: rgba(74,222,128,0.7); }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 768px) {
          .left-panel { padding: 32px 20px; }
          .cta-group { flex-direction: column; width: 100%; }
          .cta-group .btn-primary,
          .cta-group .btn-ghost { width: 100%; justify-content: center; }
          .stats-row { flex-wrap: wrap; gap: 16px 20px; }
          .stat-div { display: none; }
          .bottom-bar { flex-direction: column; gap: 6px; padding: 10px 20px; }
          .bottom-info { text-align: center; font-size: 11px; }
        }

        @media (max-width: 480px) {
          .left-panel { padding: 24px 16px; }
          .stats-row { gap: 12px 14px; }
          .stat-num { font-size: 22px; }
          .headline { font-size: 28px; }
          .sub { font-size: 13px; }
        }
      `}</style>

      <div className="page-root">
        {/* Background effects */}
        <div className="grid-lines" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        {/* ───── LEFT PANEL ───── */}
        <div className="left-panel">
          <div className="brand-chip">
            <div className="brand-chip-dot" />
            <span>Sistem Aktif</span>
          </div>

          <h1 className="headline">
            Operational
            <br />
            <em>Intelligence</em>
            <br />
            Dashboard
          </h1>

          <p className="sub">
            Platform terpadu untuk tim Operasional, Produksi, dan Leadership —
            data real-time, satu tampilan, keputusan lebih cepat.
          </p>

          <div className="cta-group">
            <Link href="/login" className="btn-primary">
              <LogIn className="w-4 h-4" />
              Masuk ke Dashboard
            </Link>
          </div>

          <div className="stats-row">
            <div>
              <div className="stat-num">6</div>
              <div className="stat-label">Cabang</div>
            </div>
            <div className="stat-div" />
            <div>
              <div className="stat-num">5</div>
              <div className="stat-label">Role Utama</div>
            </div>
            <div className="stat-div" />
            <div>
              <div className="stat-num">12+</div>
              <div className="stat-label">Sub Role</div>
            </div>
          </div>
        </div>

        {/* ───── BOTTOM BAR ───── */}
        <div className="bottom-bar">
          <div className="bottom-info px-4">
            Real-time notification · Live Update Data
          </div>
          <div className="status-wrap">
            <div className="status-dots">
              <div className="sdot sdot-1" />
              <div className="sdot sdot-2" />
              <div className="sdot sdot-3" />
            </div>
            <span className="status-label">Active</span>
          </div>
        </div>
      </div>
    </>
  );
}
