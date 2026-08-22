"use client"
import { useState } from "react"
import Link from "next/link"
import { Search, Truck, RefreshCcw, HelpCircle, FileText, ShieldCheck, LifeBuoy, ArrowLeft } from "lucide-react"
import { HELP_LINKS } from "@/lib/helpCenter"

const ICONS: Record<string, any> = {
  delivery: Truck,
  returns: RefreshCcw,
  faq: HelpCircle,
  terms: FileText,
  privacy: ShieldCheck,
  contact: LifeBuoy,
}

const TINTS: Record<string, string> = {
  delivery: "#2563eb",
  returns: "#7c3aed",
  faq: "#059669",
  terms: "#d97706",
  privacy: "#0284c7",
  contact: "#dc2626",
}

export default function HelpTopicGrid() {
  const [query, setQuery] = useState("")

  const filtered = HELP_LINKS.filter((link) => {
    const term = query.trim().toLowerCase()
    if (!term) return true
    return link.label.toLowerCase().includes(term) || link.desc.toLowerCase().includes(term)
  })

  return (
    <div className="space-y-8">
      <div className="relative max-w-xl mx-auto">
        <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن موضوع في مركز المساعدة..."
          className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-all"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card-premium p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-blue-500" />
          </div>
          <p className="text-sm font-bold text-slate-700">لا توجد نتائج مطابقة</p>
          <p className="text-[12px] text-slate-400 mt-1">جرّب كلمات بحث مختلفة مثل «الشحن» أو «الاستبدال»</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((link, idx) => {
            const Icon = ICONS[link.key] || HelpCircle
            const tint = TINTS[link.key] || "#1e40af"
            return (
              <Link
                key={link.href}
                href={link.href}
                className="card-premium group p-6 flex flex-col animate-fade-in"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: `${tint}12` }}>
                  <Icon size={22} style={{ color: tint }} />
                </div>
                <h3 className="text-[15px] font-extrabold text-slate-800 mb-1.5 group-hover:text-blue-700 transition-colors">{link.label}</h3>
                <p className="text-[13px] leading-6 text-slate-500 flex-1">{link.desc}</p>
                <span className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-bold text-blue-600 group-hover:gap-2.5 transition-all">
                  تصفح الموضوع
                  <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
