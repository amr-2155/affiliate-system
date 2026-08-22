"use client"
import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { Zap, MessageCircle, ShieldCheck } from "lucide-react"
import ThemeToggle from "@/components/ThemeToggle"
import {
  SUPPORT_WHATSAPP,
  SUPPORT_WHATSAPP_URL,
  SUPPORT_WHATSAPP_KEY,
  buildWhatsAppUrl,
} from "@/lib/helpCenter"

const LEGAL_LINKS = [
  { href: "/help/privacy", label: "سياسة الخصوصية" },
  { href: "/help/terms", label: "الشروط والأحكام" },
  { href: "/help/contact", label: "تواصل معنا" },
]

export default function AuthShell({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoUrl] = useState("")
  const [siteNameAr, setSiteNameAr] = useState("")
  const [siteName, setSiteName] = useState("")
  const [whatsapp, setWhatsapp] = useState(SUPPORT_WHATSAPP)
  const [whatsappUrl, setWhatsappUrl] = useState(SUPPORT_WHATSAPP_URL)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d["logo-url"]) setLogoUrl(d["logo-url"])
        if (d["site-name-ar"]) setSiteNameAr(d["site-name-ar"])
        if (d["site-name"]) setSiteName(d["site-name"])
        if (d[SUPPORT_WHATSAPP_KEY]) {
          setWhatsapp(d[SUPPORT_WHATSAPP_KEY])
          setWhatsappUrl(buildWhatsAppUrl(d[SUPPORT_WHATSAPP_KEY]))
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  const brandName = siteNameAr || siteName || "zatnaaffiliate"

  return (
    <div className="min-h-screen relative overflow-hidden auth-form-bg">
      <div className="pointer-events-none absolute -top-28 -left-28 w-[420px] h-[420px] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 70%)" }} />
      <div className="pointer-events-none absolute top-1/3 -right-24 w-[360px] h-[360px] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
      <div className="pointer-events-none absolute -bottom-36 -left-24 w-[380px] h-[380px] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(56,189,248,0.10) 0%, transparent 70%)" }} />

      <div className="absolute top-4 left-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-5 sm:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center text-center mb-8 animate-fadeIn">
            {!loaded ? (
              <div className="w-14 h-14 rounded-2xl bg-slate-200/70 animate-shimmer mb-3" />
            ) : logoUrl ? (
              <img
                src={logoUrl}
                alt={brandName}
                className="w-14 h-14 rounded-2xl object-contain bg-white p-2 border border-slate-200 shadow-md mb-3"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-brand-gradient shadow-md mb-3">
                <Zap size={24} className="text-white" />
              </div>
            )}
            <h1 className="text-[26px] sm:text-[28px] font-extrabold text-slate-900 tracking-tight">
              {brandName}
            </h1>
            <p className="text-[13px] text-slate-500 mt-1.5">منصة التسويق بالعمولة</p>
          </div>

          {children}

          <div className="mt-5 animate-fadeIn" style={{ animationDelay: "120ms" }}>
            <div className="glass rounded-2xl border border-white/50 dark:border-white/10 px-5 py-4 flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <ShieldCheck size={17} />
              </span>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                معلوماتك محمية — نلتزم بمعايير الخصوصية والأمان لحماية بياناتك.
              </p>
            </div>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full h-12 flex items-center justify-center gap-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[14px] hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all active:scale-[0.99]"
            >
              <MessageCircle size={18} />
              الدعم عبر واتساب
              <span className="text-[12px] font-semibold opacity-70" dir="ltr">
                {whatsapp}
              </span>
            </a>
          </div>
        </div>

        <div className="relative z-10 px-5 pt-8 mt-6 w-full max-w-md border-t border-slate-200/70 dark:border-white/5">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            {LEGAL_LINKS.map((l, i) => (
              <span key={l.href} className="flex items-center gap-3">
                {i > 0 && <span className="text-slate-300 dark:text-slate-600 select-none">•</span>}
                <Link
                  href={l.href}
                  className="text-[12px] text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {l.label}
                </Link>
              </span>
            ))}
          </div>
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-600 mt-3">
            © {new Date().getFullYear()} {brandName} — جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </div>
  )
}
