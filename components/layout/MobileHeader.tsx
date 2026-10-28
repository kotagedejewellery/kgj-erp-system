// components/layout/MobileHeader.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { clearClientUser } from "@/lib/auth/session";
import type { Channel } from "pusher-js";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ProfileModal from "@/components/layout/ProfileModal";
import SettingsModal from "@/components/layout/SettingsModal";

import type { Notification } from "@/types/layout";

interface HeaderProps {
  userEmail: string;
  role: string;
  logoutPath?: string;
  onMenuClick: () => void;
}

const POLL_INTERVAL = 60_000; // refresh tiap 60 detik

export default function Header({
  userEmail,
  role,
  logoutPath,
  onMenuClick,
}: HeaderProps) {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [greeting, setGreeting] = useState("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // ─── Fetch notifications ─────────────────────────────────────────────────

  const {
    data: notifData,
    refetch,
  } = useQuery<{ data: Notification[]; unread_count: number }>({
    queryKey: ["notifications"],
    queryFn: () => fetcher("/api/notifications?limit=20"),
  });

  // Sync query data to local state (for Pusher compatibility)
  useEffect(() => {
    if (notifData) {
      setNotifications(notifData.data ?? []);
      setUnreadCount(notifData.unread_count ?? 0);
    }
  }, [notifData]);

  // ─── Fetch profile ─────────────────────────────────────────────────────────

  interface ProfileData {
    id: string;
    full_name: string;
    username: string | null;
    email: string | null;
    status: string;
    role: { id: string; name: string; role_group: string; description: string | null };
  }

  const { data: profile } = useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: () => fetcher("/api/profile"),
  });

  const formatRoleName = (name: string) =>
    name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 12
        ? "Selamat pagi"
        : h < 15
          ? "Selamat siang"
          : h < 18
            ? "Selamat sore"
            : "Selamat malam",
    );

    let channel: Channel | null = null;
    let timer: NodeJS.Timeout;

    (async () => {
      try {
        const meRes = await fetch("/api/me");
        if (!meRes.ok) return;
        const meJson = await meRes.json();
        const userId = meJson.data?.id;
        if (!userId) return;

        const { default: Pusher } = await import("pusher-js");
        const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          authEndpoint: "/api/pusher/auth",
        });

        channel = pusher.subscribe(`private-user-${userId}`);
        channel.bind("new-notification", (data: Notification) => {
          setNotifications((prev) => [data, ...prev]);
          setUnreadCount((prev) => prev + 1);
        });
      } catch {
        timer = setInterval(() => { refetch(); }, POLL_INTERVAL);
      }
    })();

    return () => {
      if (channel) channel.unsubscribe();
      if (timer) clearInterval(timer);
    };
  }, [refetch]);

  // ─── Click outside to close dropdowns ────────────────────────────────────

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setIsProfileOpen(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node)
      ) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Logout ───────────────────────────────────────────────────────────────

  const openLogoutConfirm = () => {
    setIsProfileOpen(false);
    setIsLogoutConfirmOpen(true);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout request failed:", err);
    }
    // Bersihkan semua data user di localStorage (7 key) via helper terpusat —
    // menggantikan manual removeItem yang sebelumnya incomplete.
    clearClientUser();
    router.push(logoutPath ?? ROUTES.LOGIN);
    router.refresh();
  };

  // ─── Notification actions ─────────────────────────────────────────────────

  const handleMarkAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  };

  const handleMarkAllAsRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    await fetch("/api/notifications", { method: "PATCH" });
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
      setIsNotificationOpen(false);
    }
  };

  // ─── Display helpers ──────────────────────────────────────────────────────

  const getDisplayName = () => {
    if (!userEmail) return "";
    return userEmail
      .split("@")[0]
      .replace(/[._-]/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .filter((w) => w.length > 0)
        .map((w) => w[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
    }
    if (userEmail) {
      return userEmail.split("@")[0].substring(0, 2).toUpperCase();
    }
    return "??";
  };

  const getRoleBadgeColor = () => {
    switch (role) {
      case "superadmin":
        return "from-[#e8c547] to-[#c9a227]";
      case "supervisor":
        return "from-[#e8c547] to-[#c9a227]";
      default:
        return "from-gray-600 to-gray-600";
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case "superadmin":
        return "Super Admin";
      case "supervisor":
        return "Supervisor";
      default:
        return role;
    }
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60_000);
    const hours = Math.floor(diffMs / 3_600_000);
    const days = Math.floor(diffMs / 86_400_000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    return date.toLocaleDateString("id-ID");
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    const iconMap: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
      success: {
        bg: "bg-green-100",
        color: "text-green-600",
        icon: <CheckCircle className="w-4 h-4" />,
      },
      warning: {
        bg: "bg-yellow-100",
        color: "text-yellow-600",
        icon: <AlertTriangle className="w-4 h-4" />,
      },
      error: {
        bg: "bg-red-500/[0.12]",
        color: "text-red-300",
        icon: <XCircle className="w-4 h-4" />,
      },
      info: {
        bg: "bg-blue-100",
        color: "text-[#e8e2d4]",
        icon: <Info className="w-4 h-4" />,
      },
    };
    const { bg, color, icon } = iconMap[type] ?? iconMap.info;
    return (
      <div
        className={`w-8 h-8 ${bg} rounded-full flex items-center justify-center flex-shrink-0`}
      >
        <div className={color}>{icon}</div>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <header id="dashboard-header" className="bg-[#1C1917] border-b border-[#c9a227]/10 sticky top-0 z-30 h-16 md:h-24">
        {/* Mobile & Desktop Container */}
        <div className="h-full px-4 md:px-6">
          <div className="flex justify-between items-center h-full">
            {/* Left Section */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Hamburger Menu Button - Mobile Only */}
              <button
                onClick={onMenuClick}
                className="p-2 -ml-2 rounded-lg hover:bg-[#2a2522]/[0.04] transition-colors md:hidden flex-shrink-0"
                aria-label="Buka menu navigasi"
              >
                <Menu className="w-5 h-5 text-[#e8e2d4]" />
              </button>

              {/* Role & Greeting */}
              <div className="min-w-0">
                <h1 className="text-base md:text-lg font-bold bg-gradient-to-r from-[#e8e2d4] to-[#c9a227] bg-clip-text text-transparent truncate">
                  {profile ? formatRoleName(profile.role.name) : getRoleLabel()}
                </h1>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40 hidden sm:inline">
                    {greeting}
                  </span>
                  {greeting && profile?.full_name && (
                    <>
                      <span className="text-xs text-white/20 hidden sm:inline">
                        •
                      </span>
                      <span className="text-xs font-medium text-[#e8e2d4] truncate">
                        {profile.full_name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              {/* Notification Bell */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => {
                    setIsNotificationOpen((o) => !o);
                    setIsProfileOpen(false);
                  }}
                  className="relative p-2 text-[#e8e2d4] hover:text-[#c9a227] hover:bg-[#c9a227]/10 rounded-lg transition-all duration-200"
                  aria-label="Notifikasi"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500/[0.08]0/[0.08]0 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {isNotificationOpen && (
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-96 sm:w-96 bg-[#1C1917] rounded-xl shadow-xl border border-[#c9a227]/5 overflow-hidden z-50 animate-slide-down">
                    <div className="px-4 py-3 border-b border-[#c9a227]/5 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[#f0f4ff] text-sm sm:text-base">
                          Notifikasi
                        </h3>
                        {unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-bold bg-red-500/[0.12] text-red-300 rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-[#c9a227] hover:text-[#c9a227] font-medium"
                        >
                          Tandai semua dibaca
                        </button>
                      )}
                    </div>

                    <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 sm:p-8 text-center">
                          <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-white/20 mx-auto mb-3" />
                          <p className="text-sm text-white/40">
                            Tidak ada notifikasi
                          </p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`p-3 sm:p-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-[#2a2522]/[0.04] active:bg-[#2a2522]/[0.04] ${
                              !n.is_read ? "bg-[#c9a227]/10/40" : ""
                            }`}
                          >
                            <div className="flex gap-3">
                              {getNotificationIcon(n.type)}
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                  <p
                                    className={`text-sm font-medium truncate ${
                                      !n.is_read
                                        ? "text-[#f0f4ff]"
                                        : "text-[#e8e2d4]"
                                    }`}
                                  >
                                    {n.title}
                                  </p>
                                  <span className="text-[10px] sm:text-xs text-white/30 whitespace-nowrap ml-2 shrink-0">
                                    {formatTime(n.created_at)}
                                  </span>
                                </div>
                                <p className="text-xs text-white/40 line-clamp-2">
                                  {n.message}
                                </p>
                              </div>
                              {!n.is_read && (
                                <div className="w-2 h-2 bg-[#c9a227]/100 rounded-full mt-1.5 shrink-0" />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="px-4 py-2.5 border-t border-[#c9a227]/5 text-center">
                        <button
                          onClick={() => {
                            refetch();
                          }}
                          className="text-xs text-white/30 hover:text-[#c9a227] transition-colors inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Refresh notifikasi
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Profile */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => {
                    setIsProfileOpen((o) => !o);
                    setIsNotificationOpen(false);
                  }}
                  className="flex items-center gap-2 md:gap-3 p-1.5 rounded-lg hover:bg-[#2a2522]/[0.04] transition-all duration-200"
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 md:w-9 md:h-9 bg-gradient-to-br ${getRoleBadgeColor()} rounded-full flex items-center justify-center text-white text-xs md:text-sm font-semibold shadow-md flex-shrink-0`}
                    suppressHydrationWarning
                  >
                    {getUserInitials()}
                  </div>

                  {/* Name & Role - Hidden on mobile */}
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-[#f0f4ff] leading-tight">
                      {profile?.full_name || getDisplayName()}
                    </p>
                    <p className="text-xs text-white/40">{getRoleLabel()}</p>
                  </div>

                  {/* Chevron - Hidden on mobile */}
                  <ChevronDown className="w-4 h-4 text-white/30 hidden md:block" />
                </button>

                {/* Profile Dropdown */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#1C1917] rounded-xl shadow-xl border border-[#c9a227]/5 overflow-hidden z-50 animate-slide-down">
                    {/* User Info Header */}
                    <div
                      className={`px-4 py-3 border-b border-[#c9a227]/5 bg-gradient-to-r ${getRoleBadgeColor()} bg-opacity-10`}
                    >
                      <p className="text-sm font-semibold text-[#f0f4ff] truncate">
                        {profile?.email || userEmail}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        Role: {getRoleLabel()}
                      </p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <button
                        onClick={() => { setIsProfileOpen(false); setIsProfileModalOpen(true); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-[#e8e2d4] hover:bg-[#2a2522]/[0.04] transition-colors flex items-center gap-3 min-h-[44px]">
                        <User className="w-4 h-4 text-white/30 flex-shrink-0" />
                        <span>Profil Saya</span>
                      </button>
                      <button
                        onClick={() => { setIsProfileOpen(false); setIsSettingsModalOpen(true); }}
                        className="w-full px-4 py-2.5 text-left text-sm text-[#e8e2d4] hover:bg-[#2a2522]/[0.04] transition-colors flex items-center gap-3 min-h-[44px]">
                        <Settings className="w-4 h-4 text-white/30 flex-shrink-0" />
                        <span>Pengaturan</span>
                      </button>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-[#c9a227]/5 py-2">
                      <button
                        onClick={openLogoutConfirm}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-300 hover:bg-red-500/[0.08]0/[0.08] transition-colors flex items-center gap-3 min-h-[44px]"
                      >
                        <LogOut className="w-4 h-4 flex-shrink-0" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes slide-down {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-slide-down {
            animation: slide-down 0.2s ease-out;
          }
        `}</style>
      </header>

      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        variant="danger"
        title="Logout dari akun?"
        message={`Anda akan keluar dari akun ${profile?.full_name || getDisplayName() || userEmail}. Silakan login kembali untuk mengakses dashboard.`}
        confirmText="Ya, Logout"
        cancelText="Batal"
        isLoading={isLoggingOut}
        onConfirm={handleLogout}
        onCancel={() => setIsLogoutConfirmOpen(false)}
      />
      <ProfileModal
        profile={isProfileModalOpen ? profile ?? null : null}
        onClose={() => setIsProfileModalOpen(false)}
      />
      {profile && isSettingsModalOpen && (
        <SettingsModal
          profile={{
            id: profile.id,
            full_name: profile.full_name,
            username: profile.username,
            email: profile.email,
          }}
          onClose={() => setIsSettingsModalOpen(false)}
          onSaved={() => { window.location.reload(); }}
        />
      )}
    </>
  );
}
