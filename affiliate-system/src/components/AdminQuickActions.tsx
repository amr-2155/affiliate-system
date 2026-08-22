"use client"
import Link from "next/link"
import { Plus, Package, Bell, Users, Wallet, ShoppingCart } from "lucide-react"
import { useDropdown } from "@/hooks/useClickOutside"
import { usePermissions } from "@/lib/rbac"

const ACTIONS = [
  { href: "/admin/products", label: "إضافة منتج", desc: "منتج جديد للعرض", icon: Package, tint: "#4f46e5", perm: "products.create" },
  { href: "/admin/orders", label: "إدارة الطلبات", desc: "متابعة ومعالجة الطلبات", icon: ShoppingCart, tint: "#2563eb", perm: "orders.view" },
  { href: "/admin/affiliates", label: "إضافة مسوق", desc: "إنشاء حساب مسوق جديد", icon: Users, tint: "#059669", perm: "affiliates.create" },
  { href: "/admin/notifications", label: "إرسال إشعار", desc: "رسالة لكل المسوقين", icon: Bell, tint: "#7c3aed", perm: "notifications.send" },
  { href: "/admin/withdrawals", label: "طلبات السحب", desc: "مراجعة طلبات السحب", icon: Wallet, tint: "#d97706", perm: "withdrawals.view" },
]

export default function AdminQuickActions() {
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>()
  const { can } = usePermissions()
  const visible = ACTIONS.filter((a) => can(a.perm))

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-gradient text-white text-[13px] font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
        aria-label="إجراءات سريعة"
      >
        <Plus size={16} className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
        <span className="hidden lg:inline">إجراء سريع</span>
      </button>

      {open && visible.length > 0 && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 animate-slide-in">
          <p className="px-4 pt-3.5 pb-1.5 text-[10px] font-bold text-slate-400 tracking-wider uppercase">إجراءات سريعة</p>
          <div className="p-1.5">
            {visible.map((a) => (
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
          </div>
        </div>
      )}
    </div>
  )
}
