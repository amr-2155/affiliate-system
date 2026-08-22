"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, CheckCheck, Trash2, Loader2, ChevronDown, AlertTriangle, ArrowUpLeft, Search, X, BellRing, Bell as BellIcon, ShoppingCart, Coins, Wallet, Megaphone, Package, Trophy, type LucideIcon } from "lucide-react"
import { useToast } from "@/components/Toast"
import {
  NotificationItem,
  NotificationGroup,
  NOTIFICATION_GROUPS,
  notificationMeta,
  groupQueryParams,
  resolveNotificationHref,
  timeAgo,
  timeFull,
} from "@/components/NotificationUI"

const PAGE_SIZE = 20

const GROUP_ICONS: Record<NotificationGroup, LucideIcon> = {
  ALL: BellIcon,
  UNREAD: BellRing,
  ORDER: ShoppingCart,
  EARNINGS: Coins,
  WITHDRAWAL: Wallet,
  STOCK: Package,
  REWARD: Trophy,
  SYSTEM: Megaphone,
}

export default function NotificationCenter({
  syncUnread,
}: {
  syncUnread?: (count: number) => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [group, setGroup] = useState<NotificationGroup>("ALL")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [unread, setUnread] = useState(0)
  const [total, setTotal] = useState(0)
  const [confirm, setConfirm] = useState<{ mode: "one" | "all"; id?: string } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const loadToken = useRef(0)

  const notifyUnread = useCallback(
    (count: number) => {
      setUnread(count)
      syncUnread?.(count)
    },
    [syncUnread],
  )

  const load = useCallback(
    async (targetGroup: NotificationGroup, targetPage: number, append: boolean) => {
      const token = ++loadToken.current
      if (!append) setLoading(true)
      else setLoadingMore(true)
      const qs = groupQueryParams(targetGroup)
      try {
        const res = await fetch(`/api/notifications?${qs}&page=${targetPage}&limit=${PAGE_SIZE}`).then((r) => r.json())
        if (loadToken.current !== token) return
        setItems((prev) => (append ? [...prev, ...(res.notifications || [])] : res.notifications || []))
        setTotal(res.total || 0)
        setHasMore(!!res.hasMore)
        setPage(targetPage)
        notifyUnread(res.unreadCount ?? 0)
      } catch {
        if (loadToken.current !== token) return
        if (!append) setItems([])
      }
      setLoading(false)
      setLoadingMore(false)
    },
    [notifyUnread],
  )

  useEffect(() => {
    load(group, 1, false)
    listRef.current?.scrollTo({ top: 0 })
  }, [group, load])

  const switchGroup = (g: NotificationGroup) => {
    if (g !== group) setGroup(g)
  }

  const markRead = (id: string) => {
    const target = items.find((n) => n.id === id)
    if (target && !target.read) notifyUnread(Math.max(0, unread - 1))
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {})
  }

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    }).catch(() => {})
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    notifyUnread(0)
    toast("تم تحديد جميع الإشعارات كمقروءة", "success")
  }

  const doDelete = async (mode: "one" | "all", id?: string) => {
    try {
      const qs = mode === "all" ? "?all=true" : `?id=${id}`
      const res = await fetch(`/api/notifications${qs}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
    } catch {
      toast("حدث خطأ أثناء الحذف", "error")
      setConfirm(null)
      return
    }
    if (mode === "all") {
      setItems([])
      setTotal(0)
      setHasMore(false)
      notifyUnread(0)
      toast("تم حذف جميع الإشعارات", "success")
    } else {
      const target = items.find((n) => n.id === id)
      if (target && !target.read) notifyUnread(Math.max(0, unread - 1))
      setItems((prev) => prev.filter((n) => n.id !== id))
      setTotal((t) => Math.max(0, t - 1))
      toast("تم حذف الإشعار", "success")
    }
    setConfirm(null)
  }

  const openNotification = (n: NotificationItem) => {
    if (!n.read) markRead(n.id)
    const href = resolveNotificationHref(n)
    if (href) router.push(href)
  }

  const loadMore = () => load(group, page + 1, true)

  const groupLabel = NOTIFICATION_GROUPS.find((g) => g.value === group)?.label || "الكل"
  const searching = search.trim().length > 0
  const displayItems = searching
    ? items.filter((n) => n.title.toLowerCase().includes(search.trim().toLowerCase()) || n.message.toLowerCase().includes(search.trim().toLowerCase()))
    : items
  const emptyTitle =
    searching
      ? "لا توجد نتائج مطابقة"
      : group === "UNREAD"
        ? "لا توجد إشعارات غير مقروءة"
        : group === "ALL"
          ? "لا توجد إشعارات"
          : `لا توجد إشعارات ${groupLabel}`
  const emptySubtitle =
    searching
      ? "جرّب كلمة بحث مختلفة"
      : group === "UNREAD"
        ? "أنت على اطلاع بكل شيء الآن"
        : "ستظهر هنا الإشعارات والأحداث الخاصة بك"

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-3 pt-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-50/80 rounded-xl border border-slate-100 overflow-x-auto scrollbar-none">
            {NOTIFICATION_GROUPS.map((g) => {
              const Icon = GROUP_ICONS[g.value]
              const active = group === g.value
              return (
                <button
                  key={g.value}
                  onClick={() => switchGroup(g.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-bold whitespace-nowrap transition-all ${
                    active
                      ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                  }`}
                >
                  <Icon size={13} className={active ? "text-indigo-600" : "text-slate-400"} />
                  {g.label}
                  {g.value === "UNREAD" && unread > 0 && (
                    <span className="inline-flex min-w-[16px] h-[16px] px-1 rounded-full items-center justify-center text-[9px] font-black bg-red-500 text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        <div className="relative pb-3">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الإشعارات..."
            className="w-full pr-9 pl-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-200 transition-colors">
              <X size={13} className="text-slate-400" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 py-2 border-t border-slate-50">
          <p className="text-[11px] text-slate-500">
            إجمالي <span className="font-bold text-slate-700">{searching ? displayItems.length : total}</span>
            {unread > 0 && !searching && (
              <span className="mr-1">
                — <span className="font-bold text-red-500">{unread} غير مقروء</span>
              </span>
            )}
          </p>
          <div className="flex items-center gap-1.5">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <CheckCheck size={13} />
                تحديد الكل كمقروء
              </button>
            )}
            {total > 0 && (
              <button
                onClick={() => setConfirm({ mode: "all" })}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={13} />
                حذف الكل
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div ref={listRef} className="divide-y divide-slate-50">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-4">
              <div className="w-9 h-9 rounded-xl bg-slate-100 animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-slate-100 rounded-lg animate-pulse w-1/3" />
                <div className="h-2.5 bg-slate-100 rounded-lg animate-pulse w-2/3" />
                <div className="h-2.5 bg-slate-100 rounded-lg animate-pulse w-1/4" />
              </div>
            </div>
          ))
        ) : displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-bold text-slate-700">{emptyTitle}</p>
              <p className="text-[12px] text-slate-400 mt-1">{emptySubtitle}</p>
            </div>
            {group !== "ALL" && (
              <button
                onClick={() => switchGroup("ALL")}
                className="mt-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                عرض كل الإشعارات
              </button>
            )}
          </div>
        ) : (
          displayItems.map((n) => {
            const meta = notificationMeta(n.type)
            const href = resolveNotificationHref(n)
            return (
              <div
                key={n.id}
                onClick={() => openNotification(n)}
                className={`group relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors duration-150 ${
                  n.read ? "hover:bg-slate-50/70" : "bg-slate-50/60 hover:bg-slate-50"
                }`}
                title={timeFull(n.createdAt)}
              >
                {!n.read && (
                  <span className="absolute inset-y-3 right-0 w-[3px] rounded-l-full" style={{ background: meta.accent }} />
                )}
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.iconBg} text-white flex items-center justify-center shadow-sm shrink-0 mt-0.5`}>
                  <meta.icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-[13px] truncate ${n.read ? "font-semibold text-slate-600" : "font-bold text-slate-900"}`}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(n.createdAt)}</span>
                      {!n.read && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.accent }} />}
                    </div>
                  </div>
                  <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${meta.chip}`}>{meta.label}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {!n.read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markRead(n.id) }}
                          title="تحديد كمقروء"
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <Check size={13} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirm({ mode: "one", id: n.id }) }}
                        title="حذف"
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  {href && (
                    <p className="text-[10px] text-slate-400 mt-1 inline-flex items-center gap-0.5">
                      <ArrowUpLeft size={11} />
                      اضغط للانتقال إلى الصفحة المرتبطة
                    </p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="p-3 border-t border-slate-50">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
            {loadingMore ? "جاري التحميل..." : "تحميل المزيد"}
          </button>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirm(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-900">
                  {confirm.mode === "all" ? "حذف جميع الإشعارات؟" : "حذف الإشعار؟"}
                </h3>
                <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                  {confirm.mode === "all"
                    ? "سيتم حذف كل الإشعارات نهائيًا. لا يمكن التراجع عن هذا الإجراء."
                    : "سيتم حذف هذا الإشعار نهائيًا."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => doDelete(confirm.mode, confirm.id)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[12px] font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} />
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
