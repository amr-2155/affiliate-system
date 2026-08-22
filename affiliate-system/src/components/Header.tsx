"use client"
import { Menu, Search, ShoppingCart, Zap, SlidersHorizontal } from "lucide-react"
import { useAppStore } from "@/lib/store"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import HeaderUserMenu from "@/components/HeaderUserMenu"
import HeaderNotifications from "@/components/HeaderNotifications"
import HeaderQuickActions from "@/components/HeaderQuickActions"
import HeaderHelpMenu from "@/components/HeaderHelpMenu"
import ThemeToggle from "@/components/ThemeToggle"

export default function Header() {
  const { toggleSidebar } = useAppStore()
  const cart = useAppStore((s) => s.cart)
  const [searchQuery, setSearchQuery] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [mobileSearch, setMobileSearch] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [cartPop, setCartPop] = useState(false)
  const router = useRouter()
  const count = cart.reduce((sum, i) => sum + i.quantity, 0)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => {
      if (d["logo-url"]) setLogoUrl(d["logo-url"])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (count > 0) {
      setCartPop(true)
      const t = setTimeout(() => setCartPop(false), 600)
      return () => clearTimeout(t)
    }
  }, [count])

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setMobileSearch(true)
        setTimeout(() => searchRef.current?.focus(), 50)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery("")
      setMobileSearch(false)
    }
  }

  const searchBar = (
    <form onSubmit={handleSearch} className="relative w-full">
      <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        ref={searchRef}
        type="search"
        placeholder="ابحث عن منتجات أو ابدأ طلب جديد..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pr-10 pl-10 py-2.5 rounded-xl text-sm border border-slate-200 bg-white/80 hover:border-slate-300 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 focus:shadow-sm transition-all"
      />
      <Link
        href="/products"
        onClick={() => setMobileSearch(false)}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        title="تصفية المنتجات"
      >
        <SlidersHorizontal size={15} />
      </Link>
    </form>
  )

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

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain bg-white p-1 border border-slate-200 shadow-sm group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-gradient shadow-sm group-hover:scale-105 transition-transform">
              <Zap size={18} className="text-white" />
            </div>
          )}
          <div className="hidden md:block">
            <h1 className="text-sm font-extrabold text-slate-800 leading-tight tracking-tight">لوحة المسوق</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">نظام التسويق بالعمولة</p>
          </div>
        </Link>

        {/* Search - desktop */}
        <div className="hidden md:flex flex-1 justify-center px-2">
          <div className="w-full max-w-md">{searchBar}</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 mr-auto shrink-0">
          {/* Mobile search toggle */}
          <button
            onClick={() => {
              setMobileSearch(!mobileSearch)
              if (!mobileSearch) setTimeout(() => searchRef.current?.focus(), 50)
            }}
            className={`md:hidden p-2.5 rounded-xl transition-all active:scale-95 ${mobileSearch ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}
            aria-label="بحث"
          >
            <Search size={19} />
          </button>

          <HeaderQuickActions />

          {/* Cart */}
          <Link
            href="/cart"
            className="relative p-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            aria-label="السلة"
          >
            <ShoppingCart size={19} className={cartPop ? "animate-bell-ring" : ""} />
            {count > 0 && (
              <span key={count} className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm animate-badge-pop">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>

          <HeaderNotifications />
          <ThemeToggle />
          <HeaderHelpMenu />
          <HeaderUserMenu />
        </div>
      </div>

      {/* Mobile search bar */}
      {mobileSearch && (
        <div className="md:hidden px-3 pb-3 animate-fade-in">
          {searchBar}
        </div>
      )}
    </header>
  )
}
