"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Users,
  UsersRound,
  Wallet,
  Coins,
  Trophy,
  Tag,
  Store,
  ChevronLeft,
  Menu,
  X,
  Zap,
  ArrowRight,
  Settings,
  Bell,
  UserCog,
  ShieldCheck,
  Plug,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { usePermissions } from "@/lib/rbac"

const menuItems = [
  { href: "/admin", label: "لوحة التحكم", icon: LayoutDashboard, perm: "dashboard.view" },
  { href: "/admin/products", label: "المنتجات", icon: Package, perm: "products.view" },
  { href: "/admin/stock-refill", label: "طلبات تجديد المخزون", icon: Boxes, perm: "products.view" },
  { href: "/admin/orders", label: "الطلبات", icon: ShoppingCart, perm: "orders.view" },
  { href: "/admin/affiliates", label: "المسوقين", icon: Users, perm: "affiliates.view" },
  { href: "/admin/customers", label: "العملاء", icon: UsersRound, perm: "customers.view" },
  { href: "/admin/withdrawals", label: "طلبات السحب", icon: Wallet, perm: "withdrawals.view" },
  { href: "/admin/financials", label: "المعاملات المالية", icon: Coins, perm: "withdrawals.view" },
  { href: "/admin/incentives", label: "الحوافز والمكافآت", icon: Trophy, perm: "incentives.view" },
  { href: "/admin/supplier-referrals", label: "الموردون المرشحون", icon: Store, perm: "suppliers.view" },
  { href: "/admin/categories", label: "التصنيفات", icon: Tag, perm: "categories.view" },
  { href: "/admin/managers", label: "المديرين", icon: UserCog, perm: "managers.view" },
  { href: "/admin/confirmation-team", label: "فريق التأكيدات", icon: ShieldCheck, perm: "confirmation.view" },
  { href: "/admin/notifications", label: "الرسائل والإشعارات", icon: Bell, perm: "notifications.view" },
  { href: "/admin/integrations", label: "التكاملات", icon: Plug, perm: "integrations.view" },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings, perm: "settings.view" },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const mobileOpen = useAppStore((s) => s.adminSidebarOpen)
  const setMobileOpen = useAppStore((s) => s.setAdminSidebarOpen)
  const { can } = usePermissions()
  const [logoUrl, setLogoUrl] = useState("")

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d["logo-url"]) setLogoUrl(d["logo-url"])
    }).catch(() => {})
  }, [])

  const sidebar = (
    <div
      className={`flex flex-col h-full transition-all duration-300 ${collapsed ? "w-[72px]" : "w-72"}`}
      style={{ background: "var(--sidebar-bg)" }}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-6">
        {!collapsed && (
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-contain bg-white p-1" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-gradient-warm">
                <Zap size={20} className="text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">ADMIN</h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Control Panel</p>
            </div>
          </div>
        )}
        {collapsed && (
          logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-contain bg-white p-1 mx-auto" />
          ) : (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto bg-brand-gradient-warm">
              <Zap size={20} className="text-white" />
            </div>
          )
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:block p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors absolute top-5 left-3">
          {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
        </button>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        {!collapsed && <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 tracking-widest uppercase">الإدارة</p>}
        {menuItems.map((item) => {
          if (!can(item.perm)) return null
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`nav-item mb-0.5 ${isActive ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
            >
              <item.icon size={19} className="relative z-10 shrink-0" />
              {!collapsed && <span className="relative z-10">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Back to Affiliate */}
      <div className="px-3 pb-4">
        <div className="mx-1 mb-3 border-t border-white/10" />
        <Link
          href="/dashboard"
          className={`nav-item ${collapsed ? "justify-center px-0" : ""}`}
          title={collapsed ? "لوحة المسوق" : undefined}
        >
          <ArrowRight size={19} className="relative z-10 shrink-0" />
          {!collapsed && <span className="relative z-10">لوحة المسوق</span>}
        </Link>
      </div>
    </div>
  )

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed lg:static top-0 right-0 h-full z-50 transition-transform duration-300 ease-out lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}>
        {sidebar}
      </aside>
    </>
  )
}
