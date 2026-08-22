"use client"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { ChevronDown, User, ShoppingCart, Wallet, Settings, LogOut, ShieldCheck, BadgeCheck } from "lucide-react"
import { useDropdown } from "@/hooks/useClickOutside"

export default function HeaderUserMenu() {
  const { data: session } = useSession()
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>()
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const name = session?.user?.name || "مسوق"
  const email = session?.user?.email || ""
  const image = session?.user?.image
  const initial = (name?.charAt(0) || "م").toUpperCase()

  const items = [
    { href: "/profile", label: "الملف الشخصي", icon: User, tint: "#4f46e5" },
    { href: "/orders", label: "طلباتي", icon: ShoppingCart, tint: "#2563eb" },
    { href: "/withdrawals", label: "الأرباح والسحب", icon: Wallet, tint: "#059669" },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 active:scale-[0.98] transition-all"
        aria-label="قائمة المستخدم"
      >
        {image ? (
          <img src={image} alt={name} className="w-9 h-9 rounded-xl object-cover border-2 border-white shadow-sm" />
        ) : (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white bg-brand-gradient shadow-sm">
            {initial}
          </div>
        )}
        <div className="hidden lg:block text-right">
          <p className="text-sm font-bold text-slate-800 leading-tight max-w-[130px] truncate">{name}</p>
          <p className="text-[10px] text-slate-400 font-medium">{isAdmin ? "مدير النظام" : "مسوق"}</p>
        </div>
        <ChevronDown size={14} className={`hidden lg:block text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 animate-slide-in">
          <div className="px-4 py-4 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
            <div className="flex items-center gap-3">
              {image ? (
                <img src={image} alt={name} className="w-11 h-11 rounded-xl object-cover border-2 border-white shadow-sm" />
              ) : (
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold text-white bg-brand-gradient shadow-sm">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
                <p className="text-[11px] text-slate-400 truncate">{email || "user@affiliate.com"}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 mt-3 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold">
              {isAdmin ? <ShieldCheck size={11} /> : <BadgeCheck size={11} />}
              {isAdmin ? "حساب مدير" : "مسوق نشط"}
            </span>
          </div>

          <div className="p-1.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${item.tint}12` }}>
                  <item.icon size={15} style={{ color: item.tint }} />
                </div>
                {item.label}
              </Link>
            ))}
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                <Settings size={15} />
              </div>
              إعدادات الحساب
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
