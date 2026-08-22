"use client"
import { useEffect, useState, useMemo } from "react"
import { Search, ShoppingCart, Eye, X, Download, Package, TrendingUp, Clock, CheckCircle2, ArrowUpRight, Filter, MessageSquare, Check, Loader2, ChevronDown } from "lucide-react"
import Link from "next/link"
import { formatCurrency, formatDate, formatDateTime, getStatusColor, getStatusText } from "@/lib/utils"
import Pagination from "@/components/Pagination"
import { useDebounce } from "@/hooks/useDebounce"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"

const statuses = [
  { key: "", label: "الكل", icon: Filter },
  { key: "PENDING", label: "قيد الانتظار", icon: Clock },
  { key: "CONFIRMED", label: "مؤكد", icon: CheckCircle2 },
  { key: "PROCESSING", label: "قيد المعالجة", icon: Package },
  { key: "SHIPPED", label: "تم الشحن", icon: ArrowUpRight },
  { key: "DELIVERED", label: "تم التوصيل", icon: CheckCircle2 },
  { key: "COLLECTED", label: "تم التحصيل", icon: CheckCircle2 },
  { key: "CANCELLED", label: "ملغي", icon: X },
]

const batchStatuses = [
  { key: "CONFIRMED", label: "تأكيد", color: "text-blue-600 bg-blue-50" },
  { key: "PROCESSING", label: "قيد المعالجة", color: "text-indigo-600 bg-indigo-50" },
  { key: "SHIPPED", label: "تم الشحن", color: "text-purple-600 bg-purple-50" },
  { key: "DELIVERED", label: "تم التوصيل", color: "text-emerald-600 bg-emerald-50" },
  { key: "COLLECTED", label: "تم التحصيل", color: "text-teal-600 bg-teal-50" },
  { key: "CANCELLED", label: "إلغاء", color: "text-red-600 bg-red-50" },
]

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: any; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-extrabold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ background: `${color === "text-emerald-600" ? "#059669" : color === "text-indigo-600" ? "#4f46e5" : color === "text-slate-900" ? "#0f172a" : "#3b82f6"}10` }}>
          <Icon size={18} className={color} />
        </div>
      </div>
    </div>
  )
}

export default function AdminOrdersPage() {
  const perms = usePermissions()
  const can = perms.can
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchStatus, setBatchStatus] = useState("")
  const [batchUpdating, setBatchUpdating] = useState(false)
  const [showBatchComment, setShowBatchComment] = useState(false)
  const [batchCommentText, setBatchCommentText] = useState("")
  const [batchCommentPosting, setBatchCommentPosting] = useState(false)

  const debouncedSearch = useDebounce(search, 400)

  const fetchOrders = () => {
    setLoading(true)
    const p = new URLSearchParams({ page: page.toString(), limit: "20" })
    if (debouncedSearch) p.set("search", debouncedSearch)
    if (statusFilter) p.set("status", statusFilter)
    fetch(`/api/admin/orders?${p}`).then(r => r.json()).then(d => {
      setOrders(d.orders || []); setTotalPages(d.pages || 1); setTotalOrders(d.total || 0); setTotalRevenue(d.totalRevenue || 0); setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchOrders() }, [debouncedSearch, statusFilter, page])

  useEffect(() => { setSelectedIds(new Set()) }, [orders])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)))
    }
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBatchUpdate = async () => {
    if (!batchStatus || selectedIds.size === 0) return
    setBatchUpdating(true)
    try {
      const res = await fetch("/api/admin/orders/batch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status: batchStatus }),
      })
      if (res.ok) {
        setShowBatchModal(false)
        setBatchStatus("")
        setSelectedIds(new Set())
        fetchOrders()
      }
    } catch {} finally {
      setBatchUpdating(false)
    }
  }

  const handleBatchComment = async () => {
    if (!batchCommentText.trim() || selectedIds.size === 0) return
    setBatchCommentPosting(true)
    try {
      const res = await fetch("/api/admin/orders/batch-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), content: batchCommentText.trim() }),
      })
      if (res.ok) {
        setShowBatchComment(false)
        setBatchCommentText("")
        setSelectedIds(new Set())
        fetchOrders()
      }
    } catch {} finally {
      setBatchCommentPosting(false)
    }
  }


  const exportCSV = () => {
    const header = "رقم الطلب,العميل,الهاتف,المسوق,المبلغ,الحالة,التاريخ"
    const rows = orders.map(o => [
      o.orderNumber, o.customerName, o.customerPhone,
      o.affiliate?.name || "", o.total,
      getStatusText(o.status), formatDate(o.createdAt),
    ].map(v => `"${v}"`).join(","))
    const blob = new Blob(["\uFEFF" + header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `orders-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0

  return (
    <RequirePerms perm="orders.view">
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
            <ShoppingCart size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">إدارة الطلبات</h1>
            <p className="text-[12px] text-slate-500">{totalOrders} طلب في النظام</p>
          </div>
        </div>
        <button onClick={exportCSV} disabled={orders.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[13px] font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-colors border border-emerald-100">
          <Download size={15} /> تصدير CSV
        </button>
      </div>

      {/* Stats */}
      {!loading && totalOrders > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="إجمالي الطلبات" value={totalOrders.toString()} icon={ShoppingCart} color="text-slate-900" />
          <StatCard label="إجمالي الإيرادات" value={formatCurrency(totalRevenue)} icon={TrendingUp} color="text-emerald-600" />
          <StatCard label="متوسط الطلب" value={formatCurrency(avgOrder)} icon={Package} color="text-indigo-600" />
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، رقم الطلب، الهاتف، المدينة..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 transition-colors">
              <X size={14} className="text-slate-400" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(key); setPage(1) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all
                ${statusFilter === key
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"}`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
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
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <ShoppingCart size={32} className="text-slate-300" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">لا توجد طلبات</p>
          <p className="text-slate-400 text-sm">{search || statusFilter ? "جرّب تغيير معايير البحث" : "لم يتم إنشاء أي طلبات بعد"}</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={orders.length > 0 && selectedIds.size === orders.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">رقم الطلب</th>
                  <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">العميل</th>
                  <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">المسوق</th>
                  <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">المبلغ</th>
                  <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الحالة</th>
                  <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">التاريخ</th>
                  <th className="px-3 py-3.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orders.map(o => {
                  const lastComment = o.comments?.[0]
                  return (
                    <tr key={o.id} className={`hover:bg-slate-50/50 transition-colors group ${selectedIds.has(o.id) ? "bg-indigo-50/40" : ""}`}>
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelect(o.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-slate-800 font-mono" dir="ltr">{o.orderNumber}</span>
                          {lastComment && (
                            <span className="relative group/comment" title={lastComment.content}>
                              <MessageSquare size={12} className="text-slate-300" />
                              <span className="absolute bottom-full right-1/2 translate-x-1/2 mb-1 px-2 py-1 rounded-lg bg-slate-800 text-white text-[10px] whitespace-nowrap opacity-0 group-hover/comment:opacity-100 transition-opacity pointer-events-none z-10">
                                {formatDateTime(lastComment.createdAt)}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="text-[13px] font-semibold text-slate-800">{o.customerName}</p>
                        <p className="text-[11px] text-slate-400" dir="ltr">{o.customerPhone}</p>
                        {lastComment && (
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <MessageSquare size={9} className="shrink-0" />
                            <span>{formatDateTime(lastComment.createdAt)}</span>
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
                            {o.affiliate?.name?.charAt(0)}
                          </div>
                          <span className="text-[13px] text-slate-600">{o.affiliate?.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-bold text-slate-800 tabular-nums">{formatCurrency(o.total)}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg ${getStatusColor(o.status)}`}>
                          {getStatusText(o.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[12px] text-slate-500">{formatDate(o.createdAt)}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <Link href={`/admin/orders/${o.id}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100">
                          <Eye size={15} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-2.5">
            {orders.map(o => {
              const lastComment = o.comments?.[0]
              return (
                <div key={o.id} className={`bg-white rounded-2xl border shadow-sm transition-all ${selectedIds.has(o.id) ? "border-indigo-300 bg-indigo-50/30" : "border-slate-100"}`}>
                  <div className="flex items-start gap-3 p-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(o.id)}
                      onChange={() => toggleSelect(o.id)}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                    />
                    <Link href={`/admin/orders/${o.id}`} className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold text-slate-800 font-mono" dir="ltr">{o.orderNumber}</span>
                            {lastComment && (
                              <MessageSquare size={11} className="text-slate-300 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(o.createdAt)}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getStatusColor(o.status)}`}>
                          {getStatusText(o.status)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{o.customerName}</p>
                          <p className="text-[11px] text-slate-400">{o.affiliate?.name}</p>
                          {lastComment && (
                            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <MessageSquare size={9} className="shrink-0" />
                              <span>{formatDateTime(lastComment.createdAt)}</span>
                            </p>
                          )}
                        </div>
                        <span className="text-[14px] font-extrabold text-indigo-600 tabular-nums">{formatCurrency(o.total)}</span>
                      </div>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-50 px-4">
          <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-indigo-200 shadow-xl shadow-indigo-200/30 p-4 flex items-center justify-between gap-3 animate-slideInUp">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-slate-700">
                تم اختيار <span className="text-indigo-600">{selectedIds.size}</span> طلب
              </span>
              <button onClick={clearSelection} className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
                إلغاء التحديد
              </button>
            </div>
            <div className="flex items-center gap-2">
              {can("orders.comments") && (
                <button onClick={() => { setBatchCommentText(""); setShowBatchComment(true) }}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-[13px] font-semibold hover:bg-slate-50 transition-all shadow-sm active:scale-[0.97]">
                  <MessageSquare size={14} />
                  إضافة تعليق
                </button>
              )}
              {can("orders.batch") && (
                <button onClick={() => setShowBatchModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[13px] font-semibold hover:bg-indigo-700 transition-all shadow-sm active:scale-[0.97]">
                  <Check size={14} />
                  تحديث الحالة
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Status Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowBatchModal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-slate-800 mb-1">تحديث الحالة للطلبات المحددة</h3>
            <p className="text-[12px] text-slate-400 mb-4">{selectedIds.size} طلب</p>
            <div className="space-y-1.5 mb-5">
              {batchStatuses.map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setBatchStatus(key)}
                  className={`w-full text-right px-4 py-3 rounded-xl text-[13px] font-semibold transition-all border
                    ${batchStatus === key
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBatchModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                إلغاء
              </button>
              <button onClick={handleBatchUpdate} disabled={!batchStatus || batchUpdating}
                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {batchUpdating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Comment Modal */}
      {showBatchComment && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowBatchComment(false); setBatchCommentText("") }}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-slate-800 mb-1">إضافة تعليق للطلبات المحددة</h3>
            <p className="text-[12px] text-slate-400 mb-4">سيتم إرسال التعليق لـ {selectedIds.size} طلب</p>
            <textarea
              value={batchCommentText}
              onChange={(e) => setBatchCommentText(e.target.value)}
              placeholder="اكتب التعليق..."
              rows={4}
              className="input-premium w-full text-[13px] mb-5 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowBatchComment(false); setBatchCommentText("") }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                إلغاء
              </button>
              <button onClick={handleBatchComment} disabled={!batchCommentText.trim() || batchCommentPosting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {batchCommentPosting ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
                إرسال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </RequirePerms>
  )
}
