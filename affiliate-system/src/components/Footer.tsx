"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Facebook, Users, MessageCircle, Zap, LifeBuoy, Truck, RefreshCcw, HelpCircle, FileText, ShieldCheck, ArrowLeft } from "lucide-react"
import {
  HELP_LINKS,
  SUPPORT_WHATSAPP,
  SUPPORT_WHATSAPP_URL,
  SUPPORT_WHATSAPP_KEY,
  FACEBOOK_PAGE_URL_KEY,
  FACEBOOK_GROUP_URL_KEY,
  buildWhatsAppUrl,
} from "@/lib/helpCenter"

const ACCOUNT_LINKS = [
  { href: "/login", label: "تسجيل الدخول" },
  { href: "/register", label: "إنشاء حساب مسوق" },
  { href: "/dashboard", label: "لوحة المسوق" },
]

const HELP_ICONS: Record<string, any> = {
  delivery: Truck,
  returns: RefreshCcw,
  faq: HelpCircle,
  terms: FileText,
  privacy: ShieldCheck,
  contact: LifeBuoy,
}

export default function Footer() {
  const [logoUrl, setLogoUrl] = useState("")
  const [siteName, setSiteName] = useState("نظام التسويق")
  const [siteNameAr, setSiteNameAr] = useState("")
  const [whatsapp, setWhatsapp] = useState(SUPPORT_WHATSAPP)
  const [whatsappUrl, setWhatsappUrl] = useState(SUPPORT_WHATSAPP_URL)
  const [facebookPage, setFacebookPage] = useState("")
  const [facebookGroup, setFacebookGroup] = useState("")

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
        if (d[FACEBOOK_PAGE_URL_KEY]) setFacebookPage(d[FACEBOOK_PAGE_URL_KEY])
        if (d[FACEBOOK_GROUP_URL_KEY]) setFacebookGroup(d[FACEBOOK_GROUP_URL_KEY])
      })
      .catch(() => {})
  }, [])

  const brandName = siteNameAr || siteName

  return (
    <footer className="mt-10 border-t border-slate-200/60" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-slate-200 shadow-sm" />
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-gradient shadow-sm">
                  <Zap size={18} className="text-white" />
                </div>
              )}
              <div>
                <p className="text-sm font-extrabold text-slate-800 leading-tight">{brandName}</p>
                <p className="text-[10px] text-slate-400 font-medium">نظام التسويق بالعمولة</p>
              </div>
            </div>
            <p className="text-[13px] leading-6 text-slate-500 mb-5">
              منصة متكاملة للتسويق بالعمولة: تصفح المنتجات، أنشئ طلباتك، وتابع أرباحك وإحصائياتك من لوحة واحدة.
            </p>
            <div className="flex items-center gap-2">
              {facebookPage && (
                <a href={facebookPage} target="_blank" rel="noopener noreferrer" title="صفحتنا على فيسبوك"
                  className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors">
                  <Facebook size={16} />
                </a>
              )}
              {facebookGroup && (
                <a href={facebookGroup} target="_blank" rel="noopener noreferrer" title="جروب فيسبوك"
                  className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-colors">
                  <Users size={16} />
                </a>
              )}
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" title="واتساب الدعم"
                className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-colors">
                <MessageCircle size={16} />
              </a>
            </div>
          </div>

          {/* Help links */}
          <div>
            <h3 className="text-[13px] font-extrabold text-slate-800 mb-4">مركز المساعدة</h3>
            <ul className="space-y-2.5">
              {HELP_LINKS.map((link) => {
                const Icon = HELP_ICONS[link.key] || HelpCircle
                return (
                  <li key={link.href}>
                    <Link href={link.href} className="group flex items-center gap-2 text-[13px] text-slate-500 hover:text-blue-600 transition-colors">
                      <Icon size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                      {link.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Account links */}
          <div>
            <h3 className="text-[13px] font-extrabold text-slate-800 mb-4">الحساب</h3>
            <ul className="space-y-2.5">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="group flex items-center gap-2 text-[13px] text-slate-500 hover:text-blue-600 transition-colors">
                    <ArrowLeft size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-[13px] font-extrabold text-slate-800 mb-4">تواصل معنا</h3>
            <p className="text-[13px] text-slate-500 leading-6 mb-3">
              فريق الدعم متاح خلال ساعات العمل الرسمية عبر واتساب.
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-[13px] font-bold hover:bg-emerald-600 hover:text-white transition-colors w-fit"
            >
              <MessageCircle size={16} />
              <span dir="ltr">{whatsapp}</span>
            </a>
            {facebookPage && (
              <a href={facebookPage} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 mt-2.5 text-[12px] text-slate-400 hover:text-blue-600 transition-colors">
                <Facebook size={13} /> تابعنا على فيسبوك
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/60" style={{ background: "rgba(241,245,249,0.6)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} {brandName} — جميع الحقوق محفوظة.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/help/terms" className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors">الشروط والأحكام</Link>
            <Link href="/help/privacy" className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors">سياسة الخصوصية</Link>
            <Link href="/help/contact" className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors">تواصل معنا</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
