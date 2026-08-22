"use client"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, ArrowUpLeft, Loader2 } from "lucide-react"
import { useDropdown } from "@/hooks/useClickOutside"
import { NotificationItem, notificationMeta, resolveNotificationHref, timeAgo } from "@/components/NotificationUI"

export default function AdminNotifications() {
  const { open, setOpen, ref } = useDropdown<HTMLDivElement>()
  const router = useRouter()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch("/api/notifications?limit=6")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.notifications)) setItems(d.notifications)
        if (d.unreadCount !== undefined) setUnread(d.unreadCount)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const markAll = async () => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    }).catch(() => {})
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  const openItem = (n: NotificationItem) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread(Math.max(0, unread - 1))
      fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {})
    }
    const href = resolveNotificationHref(n)
    if (href) {
      setOpen(false)
      router.push(href)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
        aria-label="الإشعارات"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span key={unread} className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] bg-gradient-to-r from-red-500 to-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm animate-badge-pop">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 animate-slide-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">الإشعارات</h3>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                <CheckCheck size={13} />
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/3" />
                      <div className="h-2 bg-slate-100 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-400">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <p className="text-sm">لا توجد إشعارات حالياً</p>
              </div>
            ) : (
              items.map((n) => {
                const meta = notificationMeta(n.type)
                const href = resolveNotificationHref(n)
                return (
                  <div
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`group flex items-start gap-3 px-4 py-3 border-b border-slate-50 transition-colors duration-150 cursor-pointer relative ${
                      n.read ? "opacity-75 hover:bg-slate-50" : "hover:bg-amber-50/60"
                    }`}
                    title={n.title}
                  >
                    {!n.read && <span className="absolute inset-y-2 right-0 w-[3px] rounded-l-full" style={{ background: meta.accent }} />}
                    <div className={`mt-0.5 w-7 h-7 rounded-lg bg-gradient-to-br ${meta.iconBg} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                      <meta.icon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[13px] truncate ${n.read ? "font-semibold text-slate-700" : "font-bold text-slate-900"}`}>{n.title}</p>
                        <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                    {href && (
                      <ArrowUpLeft size={13} className="shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors mt-0.5" />
                    )}
                  </div>
                )
              })
            )}
          </div>

          <Link
            href="/admin/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 px-4 py-3 text-[12px] font-bold text-blue-600 hover:bg-blue-50/60 transition-colors"
          >
            <ArrowUpLeft size={14} />
            إدارة الإشعارات وإرسالها
          </Link>
        </div>
      )}
    </div>
  )
}
