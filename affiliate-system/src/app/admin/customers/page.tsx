"use client"
import { useCallback, useEffect, useState } from "react"
import {
  UsersRound,
  ShoppingCart,
  Wallet,
  Repeat,
  Search,
  Loader2,
  X,
  FilterX,
  Calendar,
  Phone,
  MessageCircle,
  Copy,
  Download,
  Check,
  UserRound,
  MapPin,
  Mail,
  Store,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Share2,
  BadgePercent,
  Link2,
  Send,
} from "lucide-react"
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getStatusText } from "@/lib/utils"
import { useToast } from "@/components/Toast"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import Pagination from "@/components/Pagination"
import Drawer from "@/components/Drawer"
import EmptyState from "@/components/EmptyState"

const PER_PAGE = 10

const SEGMENT_OPTIONS = [
  { key: "", label: "الكل", icon: UsersRound },
  { key: "NEW", label: "عملاء جدد", icon: BadgePercent },
  { key: "DELIVERED", label: "طلبات مكتملة", icon: Check },
  { key: "PENDING", label: "قيد الانتظار", icon: Calendar },
  { key: "CANCELLED", label: "طلبات ملغاة", icon: X },
]

const SORT_OPTIONS = [
  { key: "recent", label: "الأحدث نشاطاً" },
  { key: "name", label: "الاسم" },
  { key: "orders", label: "عدد الطلبات" },
  { key: "value", label: "إجمالي المشتريات" },
]

const toWhatsApp = (phone: string) => {
  const digits = phone.replace(/[^\d]/g, "")
  const intl = digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? "2" + digits : digits
  return `https://wa.me/${intl}`
}

const cleanPhone = (phone: string) => phone.replace(/[^\d]/g, "")

function StatCard({ label, value, icon: Icon, tint, text }: { label: string; value: string; icon: any; tint: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400">{label}</p>
          <p className={`text-xl sm:text-2xl font-extrabold mt-1 truncate tabular-nums ${text}`}>{value}</p>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tint}12` }}>
          <Icon size={18} style={{ color: tint }} />
        </div>
      </div>
    </div>
  )
}

function SortHeader({ label, myKey, sortKey, sortDir, onSort }: { label: string; myKey: string; sortKey: string; sortDir: "asc" | "desc"; onSort: () => void }) {
  const active = sortKey === myKey
  return (
    <button onClick={onSort} className="inline-flex items-center gap-1 hover:text-slate-700 transition-colors" title="فرز">
      {label}
      {active ? (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
    </button>
  )
}

function MiniStat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
      <p className="text-[10px] font-semibold text-slate-400">{label}</p>
      <p className="text-[13px] font-bold tabular-nums mt-0.5" style={{ color: tint }}>{value}</p>
    </div>
  )
}

function Avatar({ name, tint }: { name: string; tint: string }) {
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[15px] font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${tint}, #3b82f6)` }}>
      {(name || "؟").charAt(0)}
    </div>
  )
}

export default function AdminCustomersPage() {
  const { toast } = useToast()
  const perms = usePermissions()
  const can = perms.can

  const [customers, setCustomers] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [segments, setSegments] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [segment, setSegment] = useState("")
  const [sortKey, setSortKey] = useState("recent")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [drawerCust, setDrawerCust] = useState<any>(null)
  const [drawerOrders, setDrawerOrders] = useState<any[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("search")
    if (s) setSearch(s)
  }, [])

  const applySort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortKey(key)
      setSortDir(key === "name" ? "asc" : "desc")
    }
  }

  const effectiveSort = (() => {
    if (sortKey === "name") return sortDir === "asc" ? "name" : "name_desc"
    if (sortKey === "orders") return sortDir === "asc" ? "orders_asc" : "orders"
    if (sortKey === "value") return sortDir === "asc" ? "value_asc" : "value"
    return "recent"
  })()

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PER_PAGE),
      sort: effectiveSort,
    })
    if (search.trim()) params.set("search", search.trim())
    if (segment) params.set("segment", segment)
    fetch(`/api/admin/customers?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setCustomers(Array.isArray(d.customers) ? d.customers : [])
        setSummary(d.summary || null)
        setSegments(d.segments || {})
        setTotal(d.total || 0)
        setTotalPages(d.pages || 1)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [page, search, segment, effectiveSort])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [search, segment, effectiveSort])

  const clearFilters = () => { setSearch(""); setSegment("") }

  const hasFilters = !!search || !!segment

  const toggleSelect = (phone: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(phone)) next.delete(phone)
      else next.add(phone)
      return next
    })
  }

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      const allOnPage = customers.every((c) => next.has(c.phone))
      customers.forEach((c) => (allOnPage ? next.delete(c.phone) : next.add(c.phone)))
      return next
    })
  }

  const copyPhones = async () => {
    const lines = customers.filter((c) => selected.has(c.phone)).map((c) => `${c.name} — ${c.phone}`)
    if (lines.length === 0) return
    try { await navigator.clipboard.writeText(lines.join("\n")); toast(`تم نسخ ${lines.length} رقم`, "success") }
    catch { toast("تعذر النسخ", "error") }
  }

  const openDrawer = (cust: any) => {
    setDrawerCust(cust)
    setDrawerOrders([])
    setDrawerLoading(true)
    fetch(`/api/admin/customers/${encodeURIComponent(cust.phone)}`)
      .then((r) => r.json())
      .then((d) => { setDrawerOrders(Array.isArray(d.orders) ? d.orders : []) })
      .catch(() => {})
      .finally(() => setDrawerLoading(false))
  }

  const exportCSV = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ limit: "500", sort: "recent" })
      if (search.trim()) params.set("search", search.trim())
      if (segment) params.set("segment", segment)
      const res = await fetch(`/api/admin/customers?${params}`)
      const d = await res.json()
      const rows = Array.isArray(d.customers) ? d.customers : []
      const header = "الاسم,الهاتف,البريد,المحافظة,المدينة,عدد الطلبات,إجمالي المشتريات,آخر طلب"
      const lines = rows.map((c: any) => [
        c.name, c.phone, c.email || "", c.governorate || "", c.city || "",
        c.orderCount, c.totalValue, c.lastOrderAt ? formatDate(c.lastOrderAt) : "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      const blob = new Blob(["\uFEFF" + header + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url; link.download = `customers-${Date.now()}.csv`; link.click()
      URL.revokeObjectURL(url)
      toast(`تم تصدير ${rows.length} عميل`, "success")
    } catch { toast("حدث خطأ في التصدير", "error") }
    setExporting(false)
  }

  const allPageSelected = customers.length > 0 && customers.every((c) => selected.has(c.phone))

  return (
    <RequirePerms perm="customers.view">
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}>
            <UsersRound size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">قاعدة بيانات العملاء</h1>
            <p className="text-[12px] text-slate-500">{total.toLocaleString("ar-EG")} عميل · مبنية تلقائياً من الطلبات الفعلية</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={copyPhones} disabled={selected.size === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-teal-50 text-teal-600 rounded-xl text-[12px] font-semibold hover:bg-teal-100 disabled:opacity-50 transition-colors border border-teal-100">
            <Copy size={14} /> نسخ الأرقام ({selected.size.toLocaleString("ar-EG")})
          </button>
          {can("customers.export") && (
            <button onClick={exportCSV} disabled={exporting || total === 0}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[12px] font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-colors border border-emerald-100">
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} تصدير CSV
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {!loading && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="إجمالي العملاء" value={summary.totalCustomers.toLocaleString("ar-EG")} icon={UsersRound} tint="#0d9488" text="text-teal-600" />
          <StatCard label="إجمالي الطلبات" value={summary.totalOrders.toLocaleString("ar-EG")} icon={ShoppingCart} tint="#2563eb" text="text-blue-600" />
          <StatCard label="إجمالي المبيعات" value={formatCurrency(summary.totalRevenue)} icon={Wallet} tint="#7c3aed" text="text-violet-600" />
          <StatCard label="عملاء متكررون" value={summary.repeatCustomers.toLocaleString("ar-EG")} icon={Repeat} tint="#d97706" text="text-amber-600" />
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو رقم الهاتف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          <select value={sortKey} onChange={(e) => applySort(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all">
            {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {sortKey !== "recent" && (
            <button onClick={() => applySort(sortKey)} className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              {sortDir === "asc" ? "تصاعدي ↑" : "تنازلي ↓"}
            </button>
          )}
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-[12px] font-semibold hover:bg-red-100 transition-colors">
              <FilterX size={14} /> مسح الفلاتر
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SEGMENT_OPTIONS.map(({ key, label, icon: Icon }) => {
            const count = segments[key] ?? 0
            return (
              <button key={key} onClick={() => setSegment(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all
                  ${segment === key
                    ? "bg-teal-600 text-white shadow-sm shadow-teal-200"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"}`}>
                <Icon size={12} />
                {label}
                <span className={`text-[10px] px-1.5 rounded-md ${segment === key ? "bg-white/20" : "bg-slate-200/70"}`}>{count.toLocaleString("ar-EG")}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Targeting toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-teal-600 text-white rounded-2xl px-4 py-3 shadow-md shadow-teal-200/50 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center"><Share2 size={15} /></div>
            <div>
              <p className="text-[13px] font-bold">شريحة مستهدفة جاهزة</p>
              <p className="text-[11px] text-teal-100">{selected.size.toLocaleString("ar-EG")} عميل محدد — تُرسل الرسائل يدوياً عبر واتساب (لا يوجد إرسال تلقائي)</p>
            </div>
          </div>
          <div className="mr-auto flex items-center gap-2 flex-wrap">
            <button onClick={copyPhones} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-teal-700 text-[12px] font-bold hover:bg-teal-50 transition-colors">
              <Copy size={13} /> نسخ (الاسم — الرقم)
            </button>
            <button onClick={() => setSelected(new Set())} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/15 text-white text-[12px] font-bold hover:bg-white/25 transition-colors">
              <X size={13} /> مسح التحديد
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3 bg-slate-100 rounded-lg" />
                  <div className="w-20 h-2 bg-slate-100 rounded-lg" />
                </div>
                <div className="w-16 h-6 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<UsersRound size={30} className="text-slate-300" />}
          title="لا يوجد عملاء"
          subtitle={hasFilters ? "جرّب تغيير معايير البحث أو مسح الفلاتر" : "لم يتم تسجيل أي طلبات بعد، تظهر قاعدة العملاء تلقائياً من الطلبات"}
        />
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[12px] text-slate-500">{total.toLocaleString("ar-EG")} عميل {hasFilters ? "بعد الفلترة" : "· مرتبة حسب الأحدث نشاطاً"}</p>
            {selected.size > 0 && (
              <p className="text-[12px] font-bold text-teal-600">{selected.size.toLocaleString("ar-EG")} محدد في الصفحة الحالية</p>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3.5 w-12">
                      <button onClick={togglePage} className="w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors" style={{ background: allPageSelected ? "#0d9488" : "white", borderColor: allPageSelected ? "#0d9488" : "#d1d5db" }} aria-label="تحديد الصفحة">
                        {allPageSelected && <Check size={11} className="text-white" />}
                      </button>
                    </th>
                    <th className="text-right px-2 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">العميل</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الهاتف</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><SortHeader label="الطلبات" myKey="orders" sortKey={sortKey} sortDir={sortDir} onSort={() => applySort("orders")} /></th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><SortHeader label="إجمالي المشتريات" myKey="value" sortKey={sortKey} sortDir={sortDir} onSort={() => applySort("value")} /></th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">آخر نشاط</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الحالة</th>
                    <th className="px-3 py-3.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {customers.map((c) => {
                    const isSel = selected.has(c.phone)
                    const statuses = Object.entries(c.statusBreakdown || {})
                    const hasDelivered = statuses.some(([s]) => s === "DELIVERED" || s === "COLLECTED")
                    const hasPending = statuses.some(([s]) => s === "PENDING")
                    const hasCancelled = statuses.some(([s]) => s === "CANCELLED" || s === "RETURNED")
                    const statusLabel = hasDelivered ? "مكتمل" : hasPending ? "قيد الانتظار" : hasCancelled ? "ملغي" : "متابعة"
                    const statusClass = hasDelivered ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60" : hasPending ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60" : hasCancelled ? "bg-red-50 text-red-700 ring-1 ring-red-200/60" : "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60"
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => openDrawer(c)}>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleSelect(c.phone)} className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition-colors ${isSel ? "bg-teal-600 border-teal-600" : "border-slate-300 hover:border-teal-400"}`} aria-label="تحديد">
                            {isSel && <Check size={11} className="text-white" />}
                          </button>
                        </td>
                        <td className="px-2 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={c.name} tint="#0d9488" />
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-slate-800 truncate">{c.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">{[c.governorate, c.city].filter(Boolean).join(" · ") || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] text-slate-600 font-medium" dir="ltr">{c.phone}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <a href={`tel:${c.phone}`} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="اتصال"><Phone size={13} /></a>
                              <a href={toWhatsApp(c.phone)} target="_blank" rel="noopener" className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all" title="واتساب"><MessageCircle size={13} /></a>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[13px] font-bold text-slate-700 tabular-nums">{c.orderCount.toLocaleString("ar-EG")}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[13px] font-bold text-violet-600 tabular-nums">{formatCurrency(c.totalValue)}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[12px] text-slate-500">{c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg ${statusClass}`}>{statusLabel}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <ChevronLeft size={15} className="text-slate-300 group-hover:text-teal-500 transition-colors" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-2.5">
            {customers.map((c) => {
              const isSel = selected.has(c.phone)
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={c.name} tint="#0d9488" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-800 truncate">{c.name}</p>
                        <p className="text-[11px] text-slate-400 truncate" dir="ltr">{c.phone}</p>
                      </div>
                    </div>
                    <button onClick={() => toggleSelect(c.phone)} className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors ${isSel ? "bg-teal-600 border-teal-600" : "border-slate-300"}`} aria-label="تحديد">
                      {isSel && <Check size={11} className="text-white" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <button onClick={() => openDrawer(c)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-[11px] font-bold transition-colors">
                      <UserRound size={12} /> ملف العميل
                    </button>
                    <a href={`tel:${c.phone}`} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 transition-colors" title="اتصال"><Phone size={12} /></a>
                    <a href={toWhatsApp(c.phone)} target="_blank" rel="noopener" className="p-1.5 rounded-lg bg-green-50 text-green-600 transition-colors" title="واتساب"><MessageCircle size={12} /></a>
                    <span className="text-[11px] text-slate-400 mr-auto">آخر نشاط {c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-50">
                    <MiniStat label="الطلبات" value={c.orderCount.toLocaleString("ar-EG")} tint="#2563eb" />
                    <MiniStat label="إجمالي المشتريات" value={formatCurrency(c.totalValue)} tint="#7c3aed" />
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Customer 360 Drawer */}
      <Drawer
        open={!!drawerCust}
        onClose={() => setDrawerCust(null)}
        title="ملف العميل · 360"
        icon={UserRound}
        tint="#0d9488"
        maxWidth="max-w-2xl"
      >
        {drawerCust && (
          <div className="p-5 space-y-5">
            {/* Profile header */}
            <div className="flex items-center gap-3">
              <Avatar name={drawerCust.name} tint="#0d9488" />
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-extrabold text-slate-900 truncate">{drawerCust.name}</h3>
                <p className="text-[11px] text-slate-400" dir="ltr">{drawerCust.phone}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <a href={`tel:${drawerCust.phone}`} className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors" title="اتصال"><Phone size={15} /></a>
                <a href={toWhatsApp(drawerCust.phone)} target="_blank" rel="noopener" className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors" title="واتساب"><MessageCircle size={15} /></a>
              </div>
            </div>

            {/* Contact details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Phone size={14} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400">رقم الهاتف</p>
                  <p className="text-[12px] font-bold text-slate-700 truncate" dir="ltr">{drawerCust.phone}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(drawerCust.phone); toast("تم نسخ الرقم", "success") }} className="mr-auto p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"><Copy size={12} /></button>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Mail size={14} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400">البريد الإلكتروني</p>
                  <p className="text-[12px] font-bold text-slate-700 truncate" dir="ltr">{drawerCust.email || "—"}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <MapPin size={14} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400">المحافظة / المدينة</p>
                  <p className="text-[12px] font-bold text-slate-700 truncate">{[drawerCust.governorate, drawerCust.city].filter(Boolean).join(" · ") || "—"}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Store size={14} className="text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-slate-400">المسوق المسؤول</p>
                  <p className="text-[12px] font-bold text-slate-700 truncate">{drawerCust.affiliate?.name || "غير معروف"}</p>
                </div>
              </div>
            </div>

            {/* Aggregates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <MiniStat label="عدد الطلبات" value={drawerCust.orderCount.toLocaleString("ar-EG")} tint="#2563eb" />
              <MiniStat label="إجمالي المشتريات" value={formatCurrency(drawerCust.totalValue)} tint="#7c3aed" />
              <MiniStat label="متوسط قيمة الطلب" value={formatCurrency(drawerCust.orderCount > 0 ? Math.round(drawerCust.totalValue / drawerCust.orderCount) : 0)} tint="#d97706" />
              <MiniStat label="أول طلب" value={drawerCust.firstOrderAt ? formatDate(drawerCust.firstOrderAt) : "—"} tint="#64748b" />
            </div>

            {/* Status breakdown */}
            {Object.keys(drawerCust.statusBreakdown || {}).length > 0 && (
              <div>
                <p className="text-[12px] font-bold text-slate-700 mb-2">توزيع الطلبات حسب الحالة</p>
                <div className="space-y-2">
                  {Object.entries(drawerCust.statusBreakdown as Record<string, number>).map(([status, cnt]) => (
                    <div key={status} className="flex items-center gap-3">
                      <span className={`w-[86px] shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md text-center ${getStatusColor(status)}`}>{getStatusText(status)}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400" style={{ width: `${Math.max(6, (Number(cnt) / drawerCust.orderCount) * 100)}%` }} />
                      </div>
                      <span className="text-[12px] font-bold text-slate-700 tabular-nums w-6 text-left">{Number(cnt).toLocaleString("ar-EG")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent orders */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-bold text-slate-700">آخر الطلبات</p>
                <a href={`/admin/orders?search=${encodeURIComponent(cleanPhone(drawerCust.phone))}`} className="flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-700 transition-colors">
                  كل الطلبات <ChevronLeft size={12} />
                </a>
              </div>
              {drawerLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
                </div>
              ) : drawerOrders.length === 0 ? (
                <div className="text-center py-8 text-[12px] text-slate-400 bg-slate-50 rounded-xl">لا توجد طلبات</div>
              ) : (
                <div className="space-y-2">
                  {drawerOrders.slice(0, 8).map((o) => (
                    <a key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-slate-700 truncate" dir="ltr">{o.orderNumber}</p>
                        <p className="text-[10px] text-slate-400">{o.items.length} منتج · {formatDateTime(o.createdAt)}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${getStatusColor(o.status)}`}>{getStatusText(o.status)}</span>
                      <span className="text-[12px] font-extrabold text-slate-800 tabular-nums shrink-0">{formatCurrency(o.total)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Targeting prep */}
            <div className="border border-teal-100 bg-teal-50/50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center"><Send size={14} className="text-teal-700" /></div>
                <div>
                  <p className="text-[13px] font-bold text-teal-800">تجهيز حملة تواصل</p>
                  <p className="text-[11px] text-teal-600">النظام لا يرسل رسائل للعملاء تلقائياً — جهّز الرسالة ثم أرسلها يدوياً عبر واتساب.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => { navigator.clipboard.writeText(`مرحباً ${drawerCust.name} 👋 \nلديك عرض خاص لدينا اليوم! للاطلاع على المنتجات تواصل معنا.`); toast("تم نسخ نص الرسالة", "success") }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-teal-200 text-teal-700 text-[12px] font-bold hover:bg-teal-50 transition-colors">
                  <Copy size={13} /> نسخ رسالة جاهزة
                </button>
                <a href={toWhatsApp(drawerCust.phone)} target="_blank" rel="noopener" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 text-white text-[12px] font-bold hover:bg-teal-700 transition-colors">
                  <MessageCircle size={13} /> فتح واتساب
                </a>
                <button onClick={() => { navigator.clipboard.writeText(drawerCust.phone); toast("تم نسخ الرقم", "success") }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-teal-200 text-teal-700 text-[12px] font-bold hover:bg-teal-50 transition-colors">
                  <Link2 size={13} /> نسخ الرقم
                </button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
    </RequirePerms>
  )
}
