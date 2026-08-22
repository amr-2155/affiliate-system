"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Menu, Zap, Search, ArrowUpRight } from "lucide-react"
import { useAppStore } from "@/lib/store"
import AdminBreadcrumb from "@/components/AdminBreadcrumb"
import AdminGlobalSearch from "@/components/AdminGlobalSearch"
import AdminQuickActions from "@/components/AdminQuickActions"
import AdminNotifications from "@/components/AdminNotifications"
import AdminUserMenu from "@/components/AdminUserMenu"
import ThemeToggle from "@/components/ThemeToggle"

export default function AdminHeader() {
  const toggleSidebar = useAppStore((s) => s.toggleAdminSidebar)
  const [logoUrl, setLogoUrl] = useState("")
  const [mobileSearch, setMobileSearch] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d["logo-url"]) setLogoUrl(d["logo-url"])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let el: Element | null = null
    const onScroll = () => {
      const top = el ? el.scrollTop : window.scrollY
      setScrolled(top > 8)
    }
    const findScroller = () => {
      el = document.querySelector("main")
      if (el) el.addEventListener("scroll", onScroll, { passive: true })
    }
    findScroller()
    onScroll()
    const t = setTimeout(findScroller, 300)
    return () => {
      clearTimeout(t)
      el?.removeEventListener("scroll", onScroll)
    }
  }, [])

  return (
    <header
      className={`sticky top-0 z-30 transition-shadow duration-300 border-b ${
        scrolled ? "glass-strong shadow-md shadow-slate-200/50 border-slate-200/70" : "glass border-slate-200/50"
      }`}
    >
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-16">
        {/* Mobile menu toggle */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
          aria-label="القائمة"
        >
          <Menu size={20} />
        </button>

        {/* Brand */}
        <Link href="/admin" className="flex items-center gap-2.5 shrink-0 group">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain bg-white p-1 border border-slate-200 shadow-sm group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-gradient-warm shadow-sm group-hover:scale-105 transition-transform">
              <Zap size={18} className="text-white" />
            </div>
          )}
          <div className="hidden md:block">
            <h1 className="text-sm font-extrabold text-slate-800 leading-tight tracking-tight">لوحة التحكم</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">الإدارة العامة</p>
          </div>
        </Link>

        {/* Breadcrumb */}
        <div className="hidden lg:block min-w-0">
          <AdminBreadcrumb />
        </div>

        {/* Search - desktop */}
        <div className="hidden md:flex flex-1 justify-center px-2">
          <div className="w-full max-w-md">
            <AdminGlobalSearch />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 mr-auto shrink-0">
          {/* Mobile search toggle */}
          <button
            onClick={() => setMobileSearch(!mobileSearch)}
            className={`md:hidden p-2.5 rounded-xl transition-all active:scale-95 ${mobileSearch ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}
            aria-label="بحث"
          >
            <Search size={19} />
          </button>

          <AdminQuickActions />

          {/* Switch to affiliate panel */}
          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-bold text-slate-600 border border-slate-200 bg-white hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 hover:shadow-sm active:scale-[0.98] transition-all"
          >
            <ArrowUpRight size={14} className="text-slate-400" />
            <span className="hidden xl:inline">لوحة المسوق</span>
          </Link>

          <AdminNotifications />
          <ThemeToggle />
          <AdminUserMenu />
        </div>
      </div>

      {/* Mobile search bar */}
      {mobileSearch && (
        <div className="md:hidden px-3 pb-3 animate-fade-in">
          <AdminGlobalSearch autoFocus onNavigate={() => setMobileSearch(false)} />
        </div>
      )}
    </header>
  )
}
