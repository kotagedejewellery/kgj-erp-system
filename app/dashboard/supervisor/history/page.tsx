// app/dashboard/supervisor/history/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/MobileSidebar";
import Header from "@/components/layout/MobileHeader";
import OrderHistoryList from "@/components/orders/OrderHistoryList";

export default function SupervisorHistoryPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (!res.ok) {
        router.push("/workshop/login");
        return;
      }
      const json = await res.json();
      setUserEmail(json.data.username || json.data.full_name || "");
    })();
  }, [router]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#26211c]">
      <Sidebar
        role="supervisor"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userEmail={userEmail}
          role="supervisor"
          logoutPath="/workshop/login"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-lg sm:text-xl font-bold text-ivory">
              Riwayat Order
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-white/50">
              Order yang pernah Anda tangani
            </p>
          </div>
          <OrderHistoryList scope="mine" />
        </main>
      </div>
    </div>
  );
}
