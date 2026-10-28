// app/dashboard/superadmin/oprprd/history/page.tsx

"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import OrderHistoryList from "@/components/orders/OrderHistoryList";
import { getClientUser, type ClientUser } from "@/lib/auth/session";

export default function SuperadminHistoryPage() {
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);

  useEffect(() => {
    setClientUser(getClientUser());
  }, []);

  return (
    <div className="flex h-screen bg-[#26211c]">
      <Sidebar role="superadmin" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userEmail={clientUser?.email ?? ""} role="superadmin" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-cream mb-1.5">
              Riwayat Order
            </h2>
            <p className="text-white/50 text-sm">
              Semua order berjalan dan selesai
            </p>
          </div>
          <OrderHistoryList />
        </main>
      </div>
    </div>
  );
}
