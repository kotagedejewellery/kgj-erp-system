"use client";

import Sidebar from "@/components/layout/MobileSidebar";
import Header from "@/components/layout/MobileHeader";

interface SupervisorPageLoadingProps {
  sidebarOpen: boolean;
  onClose: () => void;
  onMenuClick: () => void;
  userEmail: string;
}

export default function SupervisorPageLoading({
  sidebarOpen,
  onClose,
  onMenuClick,
  userEmail,
}: SupervisorPageLoadingProps) {
  return (
    <div className="flex h-screen flex-col bg-[#26211c] md:flex-row">
      <Sidebar role="supervisor" isOpen={sidebarOpen} onClose={onClose} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userEmail={userEmail}
          role="supervisor"
          logoutPath="/workshop/login"
          onMenuClick={onMenuClick}
        />
        <main
          aria-busy="true"
          aria-label="Memuat halaman supervisor"
          className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4 md:p-6"
        >
          <div className="h-7 w-48 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-white/5" />
          <div className="h-32 animate-pulse rounded-xl border border-gold/10 bg-cocoa" />
        </main>
      </div>
    </div>
  );
}
