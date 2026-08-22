"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UsersRound,
  Wallet,
  Coins,
  Tag,
  Bell,
  Settings,
  ChevronLeft,
  Home,
  UserCog,
  ShieldCheck,
} from "lucide-react"

const CRUMBS: { href: string; label: string; icon: any }[] = [
  { href: "/admin", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/admin/products", label: "المنتجات", icon: Package },
  { href: "/admin/orders", label: "الطلبات", icon: ShoppingCart },
  { href: "/admin/affiliates", label: "المسوقين", icon: Users },
  { href: "/admin/customers", label: "العملاء", icon: UsersRound },
  { href: "/admin/withdrawals", label: "طلبات السحب", icon: Wallet },
  { href: "/admin/financials", label: "المعاملات المالية", icon: Coins },
  { href: "/admin/categories", label: "التصنيفات", icon: Tag },
  { href: "/admin/managers", label: "المديرين", icon: UserCog },
  { href: "/admin/confirmation-team", label: "فريق التأكيدات", icon: ShieldCheck },
  { href: "/admin/notifications", label: "الرسائل والإشعارات", icon: Bell },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
]

const DETAILS: { prefix: string; label: string }[] = [
  { prefix: "/admin/products", label: "تعديل المنتج" },
  { prefix: "/admin/orders", label: "تفاصيل الطلب" },
]

export default function AdminBreadcrumb() {
  const pathname = usePathname()

  const trail = useMemo(() => {
    if (!pathname?.startsWith("/admin")) return []
    const current = CRUMBS.filter((c) => pathname === c.href || pathname.startsWith(c.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]
    if (!current) return []

    const isDetail = pathname !== current.href
    const detail = DETAILS.find((d) => pathname.startsWith(d.prefix + "/"))

    const items = [
      ...(current.href !== "/admin" ? [{ label: "الرئيسية", href: "/admin", icon: Home }] : []),
      { label: current.label, href: current.href, icon: current.icon },
    ]
    if (isDetail && detail) {
      items.push({ label: detail.label, href: pathname, icon: current.icon })
    }
    return items
  }, [pathname])

  if (trail.length <= 1) return null

  return (
    <nav className="flex items-center gap-1 min-w-0" aria-label="مسار التنقل">
      {trail.map((item, i) => {
        const isLast = i === trail.length - 1
        return (
          <div key={item.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronLeft size={13} className="text-slate-300 shrink-0" />}
            {isLast ? (
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800 truncate">
                <item.icon size={14} className="text-blue-600 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
            ) : (
              <Link href={item.href} className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap">
                <item.icon size={13} />
                {item.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
