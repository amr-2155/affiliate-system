"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Zap, LifeBuoy, LogIn } from "lucide-react"
import { HELP_LINKS } from "@/lib/helpCenter"
import ThemeToggle from "@/components/ThemeToggle"

const NAV_KEYS = ["delivery", "returns", "faq", "contact"]

export default function HelpHeader() {
  const [logoUrl, setLogoUrl] = useState("")
  const [siteName, setSiteName] = useState("نظام التسويق")
  const [siteNameAr, setSiteNameAr] = useState("")
  const pathname = usePathname()

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d["logo-url"]) setLogoUrl(d["logo-url"])
        if (d["site-name-ar"]) setSiteNameAr(d["site-name-ar"])
        if (d["site-name"]) setSiteName(d["site-name"])
      })
      .catch(() => {})
  }, [])

  const brandName = siteNameAr || siteName
  const navItems = HELP_LINKS.filter((l) => NAV_KEYS.includes(l.key))

  return (
    <header className="sticky top-0 z-30 glass border-b border-slate-200/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <Link href="/help" className="flex items-center gap-2.5 shrink-0 group">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain bg-white p-1 border border-slate-200 shadow-sm group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-brand-gradient shadow-sm group-hover:scale-105 transition-transform">
              <Zap size={18} className="text-white" />
            </div>
          )}
          <div className="hidden md:block leading-tight">
            <h1 className="text-sm font-extrabold text-slate-800">{brandName}</h1>
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <LifeBuoy size={10} /> مركز المساعدة
            </p>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 mx-auto">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href === "/help" && pathname === "/help")
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                  active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <ThemeToggle />

        <Link
          href="/login"
          className="mr-auto lg:mr-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-gradient text-white text-[13px] font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
        >
          <LogIn size={15} />
          <span className="hidden sm:inline">تسجيل الدخول</span>
        </Link>
      </div>
    </header>
  )
}
