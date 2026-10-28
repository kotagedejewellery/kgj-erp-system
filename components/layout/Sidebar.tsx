// components/layout/Sidebar.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, startTransition } from "react";
import {
  SUPERADMIN_ROUTES,
  SUPERVISOR_ROUTES,
  MANAGEMENT_ROUTES,
} from "@/lib/routes";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  FileText,
  Edit3,
  Package,
  CalendarDays,
  Activity,
  DollarSign,
  CheckCircle,
  ClipboardList,
  UserPlus,
  ChevronDown,
  ChevronRight,
  QrCode,
  Info,
  X,
  Menu,
  ChevronLeft,
  ScanEye,
} from "lucide-react";

import type { MenuItem, CollapseState } from "@/types/layout";

const menuItems: Record<string, MenuItem[]> = {
  superadmin: [
    // Kelola seluruh akun dan cabang
    {
      name: "Overview",
      icon: "dashboard",
      href: SUPERADMIN_ROUTES.DASHBOARD,
    },

    // Kelola seluruh akun
    {
      name: "Kelola Akun",
      icon: "users",
      href: SUPERADMIN_ROUTES.KELOLA_AKUN,
    },

    // Kelola qr codes
    {
      name: "Kelola QR Codes",
      icon: "qrcode",
      href: SUPERADMIN_ROUTES.KELOLA_QR_CODES,
    },

    // Monitoring Manajemen
    {
      name: "Management",
      icon: "checklist",
      submenu: [
        {
          name: "Dashboard",
          icon: "dashboard",
          href: SUPERADMIN_ROUTES.MANAGEMENT_DASHBOARD,
        },
        {
          name: "Monitoring",
          icon: "monitor",
          href: SUPERADMIN_ROUTES.MONITORING_MANAJEMEN,
        },
        {
          name: "History",
          icon: "order",
          href: SUPERADMIN_ROUTES.MANAGEMENT_HISTORY,
        },
      ],
    },


    // Menu besar OPRPRD
    {
      name: "OPR-PRD",
      icon: "oprprd",
      submenu: [
        {
          name: "Monitoring OPR-PRD",
          icon: "monitor",
          href: SUPERADMIN_ROUTES.OPRPRD_MONITORING,
        },
        {
          name: "Analisis Kinerja",
          icon: "analisis",
          href: SUPERADMIN_ROUTES.OPRPRD_ANALISIS,
        },
        {
          name: "Laporan",
          icon: "report",
          href: SUPERADMIN_ROUTES.OPRPRD_LAPORAN,
        },
        {
          name: "Riwayat Order",
          icon: "order",
          href: SUPERADMIN_ROUTES.OPRPRD_HISTORY,
        },
      ],
    },
  ],
  supervisor: [
    { name: "Dashboard", icon: "dashboard", href: SUPERVISOR_ROUTES.DASHBOARD },
    { name: "Persetujuan", icon: "approval", href: SUPERVISOR_ROUTES.APPROVAL },
    {
      name: "Kelola Akun Tim",
      icon: "users",
      href: SUPERVISOR_ROUTES.ACCOUNTS,
    },
    { name: "Personnel", icon: "personnel", href: SUPERVISOR_ROUTES.PERSONNEL },
    { name: "QR Code", icon: "qr", href: SUPERVISOR_ROUTES.QR_CODES },
    { name: "Riwayat Order", icon: "order", href: SUPERVISOR_ROUTES.HISTORY },
    {
      name: "Riwayat Persetujuan",
      icon: "approval",
      href: SUPERVISOR_ROUTES.APPROVAL_HISTORY,
    },
  ],
  management: [
    { name: "Dashboard", icon: "dashboard", href: MANAGEMENT_ROUTES.DASHBOARD },
    { name: "Tugas", icon: "checklist", href: MANAGEMENT_ROUTES.TASKS },
    { name: "Riwayat", icon: "order", href: MANAGEMENT_ROUTES.HISTORY },
  ],
};

const iconMap: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="w-5 h-5" />,
  statistik: <BarChart3 className="w-5 h-5" />,
  users: <Users className="w-5 h-5" />,
  report: <FileText className="w-5 h-5" />,
  input: <Edit3 className="w-5 h-5" />,
  analisis: <BarChart3 className="w-5 h-5" />,
  bms: <Package className="w-5 h-5" />,
  oprprd: <CalendarDays className="w-5 h-5" />,
  monitor: <Activity className="w-5 h-5" />,
  scan: <ScanEye className="w-5 h-5" />,
  production: <DollarSign className="w-5 h-5" />,
  approval: <CheckCircle className="w-5 h-5" />,
  order: <ClipboardList className="w-5 h-5" />,
  personnel: <UserPlus className="w-5 h-5" />,
  chevronDown: <ChevronDown className="w-4 h-4" />,
  chevronRight: <ChevronRight className="w-4 h-4" />,
  qr: <QrCode className="w-5 h-5" />,
  checklist: <ClipboardList className="w-5 h-5" />,
};

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [actualRole, setActualRole] = useState<string | null>(null);
  const [isIntakeValidator, setIsIntakeValidator] = useState(false);
  const [collapsedMenus, setCollapsedMenus] = useState<CollapseState>({
    BMS: false,
    OPRPRD: true,
  });

  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    startTransition(() => {
      setMobileOpen(false);
    });
  }, [pathname]);

  useEffect(() => {
    if (role !== "supervisor" && role !== "management") return;
    fetch("/api/me")
      .then((r) => r.json())
      .then((j) => {
        setActualRole(j.data?.role?.name ?? null);
        setIsIntakeValidator(j.data?.role?.permissions?.can_validate_intake === true);
      })
      .catch(() => {});
  }, [role]);

  let items = menuItems[role as keyof typeof menuItems] || [];
  if (actualRole === "production_supervisor") {
    items = items.filter((i) => i.name !== "Slot Management");
  }
  if (role === "supervisor" && isIntakeValidator) {
    items = items.filter((item) => [
      "Dashboard",
      "Persetujuan",
      "Riwayat Order",
      "Riwayat Persetujuan",
    ].includes(item.name));
  }

  const toggleMenuCollapse = (menuName: string) => {
    setCollapsedMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  };

  // Fungsi untuk mengecek apakah submenu memiliki item yang aktif
  const isSubmenuActive = (submenu: MenuItem[]): boolean => {
    return submenu.some((item) => item.href && pathname === item.href);
  };

  // Render menu item (bisa regular link atau menu dengan submenu)
  const renderMenuItem = (item: MenuItem, index: number) => {
    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const isExpanded = !collapsedMenus[item.name];
    const submenuActive = hasSubmenu ? isSubmenuActive(item.submenu!) : false;

    if (hasSubmenu) {
      return (
        <div key={index}>
          {/* Header Menu Collapsible */}
          <button
            onClick={() => toggleMenuCollapse(item.name)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg
              transition-all duration-200 group
              ${
                submenuActive
                  ? "bg-gradient-to-r from-[#c9a227]/10 to-[#c9a227]/10 text-[#c9a227]"
                  : "text-[#e8e2d4] hover:bg-[#2a2522]/[0.04] hover:text-[#c9a227]"
              }
              ${isCollapsed ? "justify-center" : ""}
            `}
            title={isCollapsed ? item.name : ""}
          >
            <span
              className={`${
                submenuActive
                  ? "text-[#c9a227]"
                  : "text-white/40 group-hover:text-[#c9a227]"
              } transition-colors flex-shrink-0`}
            >
              {iconMap[item.icon as keyof typeof iconMap] || iconMap.dashboard}
            </span>
            {!isCollapsed && (
              <>
                <span className="text-sm font-medium whitespace-nowrap flex-1 text-left">
                  {item.name}
                </span>
                <span className="flex-shrink-0 text-white/30">
                  {isExpanded ? iconMap.chevronDown : iconMap.chevronRight}
                </span>
              </>
            )}
            {submenuActive && !isCollapsed && (
              <div className="ml-auto w-1.5 h-1.5 bg-[#c9a227] rounded-full"></div>
            )}
          </button>

          {/* Submenu Items */}
          {!isCollapsed && isExpanded && (
            <div className="ml-4 pl-4 border-l-2 border-[#c9a227]/10 space-y-1 mb-1">
              {item.submenu!.map((subItem, subIndex) => {
                const isSubActive = subItem.href && pathname === subItem.href;
                return (
                  <Link
                    key={subIndex}
                    href={subItem.href || "#"}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg
                      transition-all duration-200 group
                      ${
                        isSubActive
                          ? "bg-gradient-to-r from-[#c9a227]/10 to-[#c9a227]/10 text-[#c9a227] shadow-sm"
                          : "text-white/40 hover:bg-[#2a2522]/[0.04] hover:text-[#c9a227]"
                      }
                    `}
                  >
                    <span
                      className={`${
                        isSubActive
                          ? "text-[#c9a227]"
                          : "text-white/30 group-hover:text-[#c9a227]"
                      } transition-colors flex-shrink-0`}
                    >
                      {iconMap[subItem.icon as keyof typeof iconMap] ||
                        iconMap.dashboard}
                    </span>
                    <span className="text-sm font-medium whitespace-nowrap">
                      {subItem.name}
                    </span>
                    {isSubActive && (
                      <div className="ml-auto w-1.5 h-1.5 bg-[#c9a227] rounded-full"></div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Regular menu item (tanpa submenu)
    const isActive = pathname === item.href;
    return (
      <Link
        key={index}
        href={item.href || "#"}
        className={`
          flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg
          transition-all duration-200 group
          ${
            isActive
              ? "bg-gradient-to-r from-[#c9a227]/10 to-[#c9a227]/10 text-[#c9a227] shadow-sm"
              : "text-[#e8e2d4] hover:bg-[#2a2522]/[0.04] hover:text-[#c9a227]"
          }
          ${isCollapsed ? "justify-center" : ""}
        `}
        title={isCollapsed ? item.name : ""}
      >
        <span
          className={`${
            isActive
              ? "text-[#c9a227]"
              : "text-white/40 group-hover:text-[#c9a227]"
          } transition-colors flex-shrink-0`}
        >
          {iconMap[item.icon as keyof typeof iconMap] || iconMap.dashboard}
        </span>
        {!isCollapsed && (
          <span className="text-sm font-medium whitespace-nowrap">
            {item.name}
          </span>
        )}
        {isActive && !isCollapsed && (
          <div className="ml-auto w-1.5 h-1.5 bg-[#c9a227] rounded-full"></div>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden h-10 w-10 bg-[#1C1917] border border-[#c9a227]/10 rounded-xl flex items-center justify-center shadow-md"
        aria-label="Buka menu"
      >
        <Menu className="w-5 h-5 text-[#e8e2d4]" />
      </button>

      <aside
        ref={sidebarRef}
        className={`
          fixed top-0 left-0 z-50 h-full bg-[#1C1917] flex flex-col
          transform transition-transform duration-300 ease-in-out
          md:sticky md:top-0 md:translate-x-0 md:flex-shrink-0
          ${isCollapsed ? "md:w-20" : "md:w-64"}
          w-72
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          border-r border-[#c9a227]/10 shadow-xl md:shadow-none
        `}
      >
        {/* Collapse Toggle — pure CSS positioning, no JS measurement */}
        <button
          onClick={() => {
            const next = !isCollapsed;
            setIsCollapsed(next);
            localStorage.setItem("sidebar-collapsed", String(next));
          }}
          className="hidden md:flex absolute z-50 w-8 h-8 bg-[#1C1917] border border-gold rounded-full items-center justify-center shadow-md hover:shadow-lg transition-all duration-200"
          style={{ right: "0", transform: "translateX(50%)", top: "58px" }}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={`w-5 h-5 text-gold-bright transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
          />
        </button>

        {/* Mobile close */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-[#c9a227]/10 md:hidden">
          <span className="text-sm font-bold text-[#f0f4ff]">Menu</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 -mr-2 rounded-lg hover:bg-[#2a2522]/[0.04]"
          >
            <X className="w-5 h-5 text-[#e8e2d4]" />
          </button>
        </div>

        {/* Logo Section */}
        <div
          className={`h-24 flex items-center border-b border-[#c9a227]/10 ${
            isCollapsed ? "px-4 justify-center" : "px-6"
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className={`${isCollapsed ? "w-12 h-12" : "w-12 h-12"} flex-shrink-0 rounded-xl overflow-hidden`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="KGJ"
                className="w-full h-full object-contain"
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <h2 className="text-base font-bold bg-gradient-to-r from-[#e8e2d4] to-[#c9a227] bg-clip-text text-transparent whitespace-nowrap">
                  KGJ Dashboard
                </h2>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto mt-6 px-3">
          {items.map((item, index) => renderMenuItem(item, index))}
        </nav>

        {/* Bottom Section */}
        <div className={`p-4 ${isCollapsed ? "text-center" : ""}`}>
          <div
            className={`flex items-center ${
              isCollapsed ? "justify-center" : "gap-3"
            }`}
          >
            <div className="w-8 h-8 bg-[#2a2522]/[0.04] rounded-full flex items-center justify-center flex-shrink-0">
              <Info className="w-4 h-4 text-white/40" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/40">Need help?</p>
                <p className="text-xs font-medium text-[#e8e2d4]">
                  Support Center
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
