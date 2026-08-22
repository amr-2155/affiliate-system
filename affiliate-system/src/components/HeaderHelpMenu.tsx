"use client"
import Link from "next/link"
import { LifeBuoy, Truck, RefreshCcw, HelpCircle, FileText, ShieldCheck, MessageCircle } from "lucide-react"
import { useDropdown } from "@/hooks/useClickOutside"
import { HELP_LINKS } from "@/lib/helpCenter"

const ICONS: Record<string, any> = {
  delivery: Truck,
  returns: RefreshCcw,
  faq: HelpCircle,
  terms: FileText,
  privacy: ShieldCheck,
  contact: MessageCircle,
}

export default function HeaderHelpMenu() {
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`p-2.5 rounded-xl transition-all active:scale-95 ${open ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"}`}
        aria-label="مركز المساعدة"
        title="مركز المساعدة"
      >
        <LifeBuoy size={19} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 animate-slide-in">
          <div className="px-4 pt-3.5 pb-2 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">مركز المساعدة</p>
            <p className="text-[11px] text-slate-400 mt-0.5">أجوبة سريعة على كل استفساراتك</p>
          </div>
          <div className="p-1.5">
            {HELP_LINKS.map((item) => {
              const Icon = ICONS[item.key] || LifeBuoy
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-700">{item.label}</p>
                    <p className="text-[11px] text-slate-400 truncate">{item.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
          <div className="border-t border-slate-100 p-1.5">
            <Link
              href="/help"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-gradient flex items-center justify-center shrink-0">
                <LifeBuoy size={15} className="text-white" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-700">الصفحة الرئيسية للمساعدة</p>
                <p className="text-[11px] text-slate-400">استعرض كل المواضيع</p>
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
