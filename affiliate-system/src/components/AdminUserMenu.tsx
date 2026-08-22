"use client"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { ChevronDown, User, Settings, ArrowRight, LogOut, ShieldCheck } from "lucide-react"
import { useDropdown } from "@/hooks/useClickOutside"

export default function AdminUserMenu() {
  const { data: session } = useSession()
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>()
  const name = session?.user?.name || "مدير النظام"
  const email = session?.user?.email || ""
  const initial = (name?.charAt(0) || "م").toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-all active:scale-[0.98]"
        aria-label="قائمة المستخدم"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white bg-brand-gradient-warm shadow-sm">
          {initial}
        </div>
        <div className="hidden md:block text-right">
          <p className="text-sm font-bold text-slate-800 leading-tight max-w-[120px] truncate">{name}</p>
          <p className="text-[10px] text-slate-400 font-medium">مدير النظام</p>
        </div>
        <ChevronDown size={14} className={`hidden md:block text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 animate-slide-in">
          <div className="px-4 py-4 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-white bg-brand-gradient-warm shadow-sm">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
                <p className="text-[11px] text-slate-400 truncate">{email || "admin@affiliate.com"}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 mt-3 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold">
              <ShieldCheck size={11} />
              صلاحيات كاملة
            </span>
          </div>

          <div className="p-1.5">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                <User size={15} />
              </div>
              الملف الشخصي
            </Link>
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                <Settings size={15} />
              </div>
              إعدادات النظام
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <ArrowRight size={15} />
              </div>
              لوحة المسوق
            </Link>
          </div>

          <div className="border-t border-slate-100 p-1.5">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-red-600 hover:bg-red-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
                <LogOut size={15} />
              </div>
              تسجيل الخروج
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
