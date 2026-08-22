"use client"
import { Bell, ShoppingCart, Coins, Wallet, Megaphone, Package, Trophy, UserPlus, type LucideIcon } from "lucide-react"

export interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  link?: string | null
  relatedId?: string | null
  createdAt: string
}

export type NotificationGroup = "ALL" | "UNREAD" | "ORDER" | "EARNINGS" | "WITHDRAWAL" | "SYSTEM" | "STOCK" | "REWARD"

export const NOTIFICATION_GROUPS: { value: NotificationGroup; label: string }[] = [
  { value: "ALL", label: "الكل" },
  { value: "UNREAD", label: "غير المقروءة" },
  { value: "ORDER", label: "الطلبات" },
  { value: "EARNINGS", label: "الأرباح" },
  { value: "WITHDRAWAL", label: "السحب" },
  { value: "STOCK", label: "المخزون" },
  { value: "REWARD", label: "المكافآت" },
  { value: "SYSTEM", label: "النظام" },
]

interface TypeMeta {
  label: string
  icon: LucideIcon
  chip: string
  iconBg: string
  accent: string
}

export const NOTIFICATION_TYPE_META: Record<string, TypeMeta> = {
  ORDER: {
    label: "طلب",
    icon: ShoppingCart,
    chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
    iconBg: "from-emerald-500 to-teal-500",
    accent: "#10b981",
  },
  EARNINGS: {
    label: "أرباح",
    icon: Coins,
    chip: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/70",
    iconBg: "from-violet-500 to-purple-500",
    accent: "#8b5cf6",
  },
  WITHDRAWAL: {
    label: "سحب",
    icon: Wallet,
    chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
    iconBg: "from-amber-500 to-orange-500",
    accent: "#f59e0b",
  },
  SYSTEM: {
    label: "نظام",
    icon: Megaphone,
    chip: "bg-purple-50 text-purple-700 ring-1 ring-purple-200/70",
    iconBg: "from-purple-500 to-fuchsia-500",
    accent: "#a855f7",
  },
  INFO: {
    label: "معلومات",
    icon: Bell,
    chip: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/70",
    iconBg: "from-blue-500 to-indigo-500",
    accent: "#3b82f6",
  },
  STOCK: {
    label: "مخزون",
    icon: Package,
    chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
    iconBg: "from-amber-500 to-orange-600",
    accent: "#f59e0b",
  },
  REWARD: {
    label: "مكافأة",
    icon: Trophy,
    chip: "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-300/70",
    iconBg: "from-yellow-500 to-amber-600",
    accent: "#eab308",
  },
  AFFILIATE: {
    label: "مسوق جديد",
    icon: UserPlus,
    chip: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/70",
    iconBg: "from-orange-500 to-amber-500",
    accent: "#f97316",
  },
}

export function notificationMeta(type: string): TypeMeta {
  return NOTIFICATION_TYPE_META[type] || NOTIFICATION_TYPE_META.INFO
}

export function groupQueryParams(group: NotificationGroup): string {
  if (group === "ORDER") return "type=ORDER"
  if (group === "EARNINGS") return "type=EARNINGS"
  if (group === "WITHDRAWAL") return "type=WITHDRAWAL"
  if (group === "STOCK") return "type=STOCK"
  if (group === "REWARD") return "type=REWARD"
  if (group === "SYSTEM") return "type=INFO,SYSTEM"
  if (group === "UNREAD") return "read=false"
  return ""
}

export function resolveNotificationHref(n: NotificationItem): string | null {
  if (n.link) return n.link
  if (!n.relatedId) return null
  if (n.type === "ORDER") return `/orders?view=${n.relatedId}`
  if (n.type === "EARNINGS") return "/dashboard"
  if (n.type === "WITHDRAWAL") return `/withdrawals?highlight=${n.relatedId}`
  if (n.type === "STOCK") return `/products/${n.relatedId}`
  if (n.type === "REWARD") return "/dashboard"
  if (n.type === "AFFILIATE") return "/admin/affiliates"
  return null
}

export function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "الآن"
  if (mins < 60) return `منذ ${mins} د`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} س`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `منذ ${days} ي`
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(new Date(date))
}

export function timeFull(date: string | Date): string {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}
