"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus, ShoppingCart, Copy, Share2, Check, ExternalLink } from "lucide-react"
import { useDropdown } from "@/hooks/useClickOutside"
import { useToast } from "@/components/Toast"

const ACTIONS = [
  { href: "/products", label: "إنشاء طلب جديد", desc: "تصفح المنتجات وأضف طلبك", icon: ShoppingCart, tint: "#2563eb" },
  { href: "/", label: "زيارة المتجر", desc: "عرض المتجر للعملاء", icon: ExternalLink, tint: "#7c3aed" },
]

export default function HeaderQuickActions() {
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>()
  const { toast } = useToast()
  const [referralCode, setReferralCode] = useState("")
  const [copied, setCopied] = useState<"link" | "store" | null>(null)

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.referralCode) setReferralCode(d.referralCode)
      })
      .catch(() => {})
  }, [])

  const referralLink = `/register?ref=${referralCode}`
  const storeLink = "/"

  const copy = async (text: string, type: "link" | "store") => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${text}`)
      setCopied(type)
      setTimeout(() => setCopied(null), 1500)
      toast(type === "link" ? "تم نسخ رابط الإحالة" : "تم نسخ رابط المتجر", "success")
    } catch {
      toast("تعذر النسخ", "error")
    }
  }

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-gradient text-white text-[13px] font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
        aria-label="إجراءات سريعة"
      >
        <Plus size={16} className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
        <span className="hidden lg:inline">إجراء سريع</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 animate-slide-in">
          <p className="px-4 pt-3.5 pb-1.5 text-[10px] font-bold text-slate-400 tracking-wider uppercase">إجراءات سريعة</p>
          <div className="p-1.5">
            {ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${a.tint}12` }}>
                  <a.icon size={16} style={{ color: a.tint }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-700">{a.label}</p>
                  <p className="text-[11px] text-slate-400 truncate">{a.desc}</p>
                </div>
              </Link>
            ))}

            <div className="my-2 border-t border-slate-100" />

            <button
              onClick={() => referralCode && copy(referralLink, "link")}
              disabled={!referralCode}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50">
                {copied === "link" ? <Check size={16} className="text-indigo-600" /> : <Copy size={16} className="text-indigo-600" />}
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[13px] font-bold text-slate-700">نسخ رابط الإحالة</p>
                <p className="text-[11px] text-slate-400 truncate" dir="ltr">{referralCode ? `/register?ref=${referralCode}` : "جاري التحميل..."}</p>
              </div>
            </button>

            <button
              onClick={() => copy(storeLink, "store")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-50">
                {copied === "store" ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} className="text-emerald-600" />}
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[13px] font-bold text-slate-700">مشاركة المتجر</p>
                <p className="text-[11px] text-slate-400 truncate">نسخ رابط المتجر لمشاركته</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
