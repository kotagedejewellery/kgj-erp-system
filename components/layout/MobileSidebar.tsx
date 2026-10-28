// components/layout/MobileSidebar.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
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
  UserPlus,
  ChevronDown,
  ChevronRight,
  QrCode,
  Info,
  X,
  ChevronLeft,
  ScanEye,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import {
  AFTER_SALES_ROUTES,
  SUPERADMIN_ROUTES,
  SUPERVISOR_ROUTES,
} from "@/lib/routes";
import { getClientUser } from "@/lib/auth/session";
import { getSupervisorMenuItems } from "@/lib/auth/supervisor-navigation";

import type { MenuItem, CollapseState } from "@/types/layout";

// Props untuk komponen Sidebar
interface SidebarProps {
  role: string;
  isOpen: boolean;
  onClose: () => void;
}

const menuItems: Record<string, MenuItem[]> = {
  superadmin: [
    {
      name: "Overview",
      icon: "dashboard",
      href: SUPERADMIN_ROUTES.DASHBOARD,
    },
    {
      name: "Kelola Akun",
      icon: "users",
      href: SUPERADMIN_ROUTES.KELOLA_AKUN,
    },
    {
      name: "Kelola QR Codes",
      icon: "qrcode",
      href: SUPERADMIN_ROUTES.KELOLA_QR_CODES,
    },
    {
      name: "OPR-PRD",
      icon: "oprprd",
      submenu: [
        {
          name: "Monitoring Operasional",
          icon: "monitor",
          href: SUPERADMIN_ROUTES.OPRPRD_MONITORING_OPERASI,
        },
        {
          name: "Monitoring Produksi",
          icon: "production",
          href: SUPERADMIN_ROUTES.OPRPRD_MONITORING_PRODUKSI,
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
    {
      name: "Dashboard",
      icon: "dashboard",
      href: SUPERVISOR_ROUTES.DASHBOARD,
    },
    { name: "Persetujuan", icon: "approval", href: SUPERVISOR_ROUTES.APPROVAL },
    { name: "Kelola Akun", icon: "users", href: SUPERVISOR_ROUTES.ACCOUNTS },
    { name: "Personnel", icon: "personnel", href: SUPERVISOR_ROUTES.PERSONNEL },
    { name: "QR Code", icon: "qr", href: SUPERVISOR_ROUTES.QR_CODES },
    { name: "Riwayat Order", icon: "order", href: SUPERVISOR_ROUTES.HISTORY },
    {
      name: "Riwayat Persetujuan",
      icon: "approval",
      href: SUPERVISOR_ROUTES.APPROVAL_HISTORY,
    },
  ],
  after_sales: [
    { name: "Aktivasi Garansi", icon: "warranty", href: AFTER_SALES_ROUTES.AKTIVASI },
    { name: "Garansi", icon: "warranty", href: AFTER_SALES_ROUTES.GARANSI },
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
  personnel: <UserPlus className="w-5 h-5" />,
  chevronDown: <ChevronDown className="w-4 h-4" />,
  chevronRight: <ChevronRight className="w-4 h-4" />,
  qr: <QrCode className="w-5 h-5" />,
  checklist: <ClipboardList className="w-5 h-5" />,
  order: <FileText className="w-5 h-5" />,
  warranty: <ShieldCheck className="w-5 h-5" />,
};

export default function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const [actualRole, setActualRole] = useState<string | null>(null);
  const [isIntakeValidator, setIsIntakeValidator] = useState(false);
  const [isSupervisorMenuReady, setIsSupervisorMenuReady] = useState(role !== "supervisor");
  const [collapsedMenus, setCollapsedMenus] = useState<CollapseState>({
    BMS: false,
    OPRPRD: true,
  });

  useEffect(() => {
    if (role !== "supervisor") return;
    const cachedUser = getClientUser();
    if (cachedUser?.role === "supervisor" && cachedUser.roleDetail) {
      setActualRole(cachedUser.roleDetail.name);
      setIsIntakeValidator(cachedUser.roleDetail.permissions.can_validate_intake === true);
      setIsSupervisorMenuReady(true);
    }

    fetch("/api/me")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((j) => {
        if (!j?.data?.role) return;
        setActualRole(j.data?.role?.name ?? null);
        setIsIntakeValidator(j.data?.role?.permissions?.can_validate_intake === true);
        setIsSupervisorMenuReady(true);
      })
      .catch(() => {});
  }, [role]);

  const baseItems = menuItems[role as keyof typeof menuItems] || [];
  const items = role === "supervisor"
    ? getSupervisorMenuItems(baseItems, actualRole, isIntakeValidator)
    : baseItems;

  // Always hold the latest onClose without re-triggering effects
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Kunci scroll body saat drawer mobile terbuka
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Tutup drawer mobile saat pathname berubah
  useEffect(() => {
    onCloseRef.current();
  }, [pathname]);

  // Tutup drawer mobile saat resize ke desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        onCloseRef.current();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleMenuCollapse = (menuName: string) => {
    setCollapsedMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  };

  const isSubmenuActive = (submenu: MenuItem[]): boolean => {
    return submenu.some((item) => item.href && pathname === item.href);
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const isExpanded = !collapsedMenus[item.name];
    const submenuActive = hasSubmenu ? isSubmenuActive(item.submenu!) : false;

    if (hasSubmenu) {
      return (
        <div key={index}>
          <button
            onClick={() => toggleMenuCollapse(item.name)}
            className={`
              w-full flex items-center gap-3 px-3 py-3 mb-1 rounded-lg
              transition-all duration-200 group min-h-[44px]
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

          {!isCollapsed && isExpanded && (
            <div className="ml-4 pl-4 border-l-2 border-[#c9a227]/10 space-y-1 mb-1">
              {item.submenu!.map((subItem, subIndex) => {
                const isSubActive = subItem.href && pathname === subItem.href;
                return (
                  <Link
                    key={subIndex}
                    href={subItem.href || "#"}
                    onClick={onClose}
                    className={`
                      flex items-center gap-3 px-3 py-3 rounded-lg min-h-[44px]
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

    const isActive = pathname === item.href;
    return (
      <Link
        key={index}
        href={item.href || "#"}
        onClick={onClose}
        className={`
          flex items-center gap-3 px-3 py-3 mb-1 rounded-lg min-h-[44px]
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

  const sidebarContent = (
    <>
      {/* Header dengan tombol close (hanya mobile) */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#c9a227]/10 md:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex-shrink-0 rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="KGJ"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-sm font-bold text-[#f0f4ff]">
            KGJ Dashboard
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 -mr-2 rounded-lg hover:bg-[#2a2522]/[0.04] transition-colors"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5 text-[#e8e2d4]" />
        </button>
      </div>

      {/* Logo Section - Hidden di mobile, visible di desktop */}
      <div
        className={`hidden md:flex h-24 items-center border-b border-[#c9a227]/10 ${
          isCollapsed ? "px-4 justify-center" : "px-6"
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden">
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
      <nav className="flex-1 mt-4 md:mt-6 px-3 overflow-y-auto">
        {role === "supervisor" && !isSupervisorMenuReady ? (
          <div className="space-y-2 animate-pulse" aria-label="Memuat menu supervisor">
            {["one", "two", "three", "four"].map((key) => (
              <div key={key} className="h-10 rounded-lg bg-white/5" />
            ))}
          </div>
        ) : (
          items.map((item, index) => renderMenuItem(item, index))
        )}
      </nav>

      {/* Bottom Section */}
      <div
        className={`p-4 border-t border-[#c9a227]/5 ${
          isCollapsed ? "text-center" : ""
        }`}
      >
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
    </>
  );

  return (
    <>
      {/* Overlay untuk mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Drawer di mobile, Static di desktop */}
      <aside
        className={`
        fixed top-0 left-0 z-50 h-full bg-[#1C1917] flex flex-col
        transform transition-transform duration-300 ease-in-out
        md:sticky md:top-0 md:translate-x-0 md:flex-shrink-0
        ${isCollapsed ? "md:w-20" : "md:w-64"}
        w-72
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        border-r border-[#c9a227]/10 shadow-xl md:shadow-none
      `}
      >
        {/* Collapse Toggle — pure CSS positioning */}
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

        {sidebarContent}
      </aside>
    </>
  );
}
