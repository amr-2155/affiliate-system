"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Heart,
  Bell,
  User,
  Wallet,
  Lightbulb,
  Truck,
  LogOut,
  X,
  Shield,
  Zap,
  FolderOpen,
  Store,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { signOut } from "next-auth/react"

const menuItems = [
  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/products", label: "المنتجات", icon: Package },
  { href: "/cart", label: "العربة", icon: ShoppingCart },
  { href: "/orders", label: "الطلبات", icon: ShoppingCart },
  { href: "/favorites", label: "المفضلة", icon: Heart },
  { href: "/strategies", label: "استراتيجياتي", icon: FolderOpen },
  { href: "/notifications", label: "الإشعارات", icon: Bell },
  { href: "/withdrawals", label: "طلبات السحب", icon: Wallet },
  { href: "/referrals", label: "موردوك", icon: Store },
  { href: "/suggestions", label: "اقتراح منتج", icon: Lightbulb },
  { href: "/shipping", label: "أسعار الشحن", icon: Truck },
  { href: "/profile", label: "الملف الشخصي", icon: User },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, toggleSidebar } = useAppStore()
  const cart = useAppStore((s) => s.cart)
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const [logoUrl, setLogoUrl] = useState("")

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d["logo-url"]) setLogoUrl(d["logo-url"])
    }).catch(() => {})
  }, [])

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-72 z-50 transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
          lg:translate-x-0 lg:static lg:z-auto`}
        style={{ background: "var(--sidebar-bg)" }}
      >
        <div className="flex flex-col h-full">
          {/* Brand */}
          <div className="px-5 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-contain bg-white p-1" />
                ) : (
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-gradient">
                    <Zap size={20} className="text-white" />
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight">AFFILIATE</h1>
                  <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Marketing System</p>
                </div>
              </div>
              <button onClick={toggleSidebar} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-2">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 tracking-widest uppercase">القائمة</p>
            {menuItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => sidebarOpen && toggleSidebar()}
                  className={`nav-item mb-0.5 ${isActive ? "active" : ""}`}
                >
                <item.icon size={19} className="relative z-10 shrink-0" />
                <span className="relative z-10 flex-1">{item.label}</span>
                {item.href === "/cart" && cartCount > 0 && (
                  <span className="relative z-10 min-w-[20px] h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                    {cartCount}
                  </span>
                )}
                </Link>
              )
            })}
          </nav>

          {/* Admin Link */}
          {isAdmin && (
            <div className="px-3 py-2">
              <div className="mx-1 mb-2 border-t border-white/10" />
              <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 tracking-widest uppercase">الإدارة</p>
              <Link
                href="/admin"
                onClick={() => sidebarOpen && toggleSidebar()}
                className="nav-item"
                style={{ color: "#fbbf24" }}
              >
                <Shield size={19} className="relative z-10 shrink-0" />
                <span className="relative z-10 font-semibold">لوحة تحكم المدير</span>
              </Link>
            </div>
          )}

          {/* User & Logout */}
          <div className="px-3 pb-4 mt-auto">
            <div className="mx-1 mb-3 border-t border-white/10" />
            <div className="flex items-center gap-3 px-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white bg-brand-gradient">
                {session?.user?.name?.charAt(0) || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{session?.user?.name || "مستخدم"}</p>
                <p className="text-[11px] text-slate-400 truncate">{session?.user?.email || ""}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="nav-item w-full text-red-400 hover:text-red-300"
            >
              <LogOut size={19} className="relative z-10 shrink-0" />
              <span className="relative z-10">تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
