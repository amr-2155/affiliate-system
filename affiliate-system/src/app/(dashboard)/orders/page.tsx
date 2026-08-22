"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ShoppingCart, Plus, Loader2, Search, Download, ChevronLeft, User,
  MapPin, X, BadgePercent,
} from "lucide-react"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import Pagination from "@/components/Pagination"
import StatusBadge from "@/components/StatusBadge"
import EmptyState from "@/components/EmptyState"
import { useDebounce } from "@/hooks/useDebounce"
import Link from "next/link"

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  total: number
  product: { id: string; nameAr: string; image?: string }
}

interface Order {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  subtotal: number
  shippingCost: number
  total: number
  commission?: number
  editable?: boolean
  customerName: string
  customerPhone: string
  customerAddress: string
  customerCity: string
  customerGovernorate?: string | null
  notes?: string
  createdAt: string
  items: OrderItem[]
}

function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="h-3.5 w-32 bg-slate-100 rounded-md" />
          <div className="h-3 w-48 bg-slate-50 rounded-md" />
          <div className="h-2.5 w-24 bg-slate-50 rounded-md" />
        </div>
        <div className="space-y-2 text-left">
          <div className="h-4 w-20 bg-slate-100 rounded-md mr-auto" />
          <div className="h-2.5 w-12 bg-slate-50 rounded-md mr-auto" />
        </div>
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 400)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchOrders = useCallback((quiet = false) => {
    if (!quiet) setLoading(true)
    const params = new URLSearchParams({ page: page.toString(), limit: "10" })
    if (statusFilter) params.set("status", statusFilter)
    if (debouncedSearch) params.set("search", debouncedSearch)

    fetch(`/api/orders?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data.orders || [])
        setTotalPages(data.pages || 1)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [debouncedSearch, statusFilter, page])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    pollTimer.current = setInterval(() => fetchOrders(true), 30000)
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [fetchOrders])

  useEffect(() => {
    const viewId = new URLSearchParams(window.location.search).get("view")
    if (viewId) {
      window.location.replace(`/orders/${viewId}`)
    }
  }, [])

  const exportCSV = () => {
    const header = "رقم الطلب,العميل,الهاتف,المدينة,المبلغ,العمولة,الحالة,التاريخ"
    const rows = orders.map(o => [
      o.orderNumber, o.customerName, o.customerPhone, o.customerCity,
      o.total, o.commission || 0, o.status, formatDate(o.createdAt),
    ].map(v => `"${v}"`).join(","))
    const blob = new Blob(["\uFEFF" + header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `my-orders-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const statusOptions = ["", "PENDING", "UNDER_REVIEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COLLECTED", "CANCELLED", "RETURNED"]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">الطلبات</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? <span className="inline-block w-20 h-3 bg-slate-100 rounded animate-pulse align-middle" /> : (
              <span>{orders.length} طلب</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {orders.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <Download size={16} /> تصدير
            </button>
          )}
          <button
            onClick={() => setShowNewOrder(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm"
          >
            <Plus size={17} />
            <span>طلب جديد</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="بحث باسم العميل، رقم الطلب، الهاتف، أو المدينة..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="input-premium pr-10"
        />
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              statusFilter === status
                ? "bg-brand-gradient text-white shadow-md shadow-indigo-500/20"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            {status ? (status === "PENDING" ? "قيد الانتظار" : status === "UNDER_REVIEW" ? "قيد المراجعة" : status === "CONFIRMED" ? "مؤكد" : status === "PROCESSING" ? "قيد المعالجة" : status === "SHIPPED" ? "تم الشحن" : status === "DELIVERED" ? "تم التوصيل" : status === "COLLECTED" ? "تم التحصيل" : status === "CANCELLED" ? "ملغي" : "مرتجع") : "الكل"}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <OrderCardSkeleton key={i} />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart size={28} className="text-slate-300" />}
          title="لا توجد طلبات"
          subtitle={statusFilter || search ? "جرّب تعديل البحث أو الفلتر لعرض المزيد من النتائج" : "أنشئ طلبك الأول الآن من صفحة العربة أو عبر زر «طلب جديد»"}
          action={!statusFilter && !search ? (
            <button onClick={() => setShowNewOrder(true)} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
              <Plus size={16} /> إنشاء طلب
            </button>
          ) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block w-full text-right bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md hover:border-blue-200/70 transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-slate-900">{order.orderNumber}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-[13px] text-slate-500 mt-1.5 flex items-center gap-1.5 min-w-0">
                    <User size={12} className="text-slate-300 shrink-0" />
                    <span className="truncate">{order.customerName}</span>
                    <span className="text-slate-300">·</span>
                    <MapPin size={12} className="text-slate-300 shrink-0" />
                    <span>{order.customerCity}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">{formatDateTime(order.createdAt)}</p>
                </div>
                <div className="text-left shrink-0 flex flex-col items-end gap-1.5">
                  <p className="text-[15px] font-extrabold text-slate-900 tabular-nums">{formatCurrency(order.total)}</p>
                  <div className="flex items-center gap-2">
                    {(order.commission ?? 0) > 0 && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center gap-1 tabular-nums">
                        <BadgePercent size={10} /> {formatCurrency(order.commission ?? 0)}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">{order.items.length} منتج</span>
                    <ChevronLeft size={16} className="text-slate-300 group-hover:text-blue-500 group-hover:-translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && orders.length > 0 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* New Order Modal */}
      {showNewOrder && <NewOrderModal onClose={() => { setShowNewOrder(false); fetchOrders() }} />}
    </div>
  )
}

function NewOrderModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    customerCity: "",
    notes: "",
  })
  const [items, setItems] = useState<{ productId: string; productName: string; quantity: number; price: number }[]>([])
  const [productSearch, setProductSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ id: string; nameAr: string; price: number }>>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (productSearch.length < 2) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/products?search=${productSearch}&limit=5`)
        .then((res) => res.json())
        .then((data) => setSearchResults(data.products || []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch])

  const addItem = (product: { id: string; nameAr: string; price: number }) => {
    if (items.find((i) => i.productId === product.id)) return
    setItems([...items, {
      productId: product.id,
      productName: product.nameAr,
      quantity: 1,
      price: product.price,
    }])
    setProductSearch("")
    setSearchResults([])
  }

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.productId !== productId))
  }

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) return
    setItems(items.map((i) => i.productId === productId ? { ...i, quantity } : i))
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const total = subtotal + 50

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) {
      alert("أضف منتجات للطلب أولاً")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      })
      if (res.ok) {
        onClose()
      } else {
        const data = await res.json()
        alert(data.error || "حدث خطأ")
      }
    } catch {
      alert("حدث خطأ")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[75] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-slate-900">طلب جديد</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="اسم العميل *"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              required
              className="input-premium"
            />
            <input
              type="tel"
              placeholder="هاتف العميل *"
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              required
              className="input-premium"
              dir="ltr"
            />
          </div>
          <input
            type="text"
            placeholder="المدينة *"
            value={form.customerCity}
            onChange={(e) => setForm({ ...form, customerCity: e.target.value })}
            required
            className="input-premium w-full"
          />
          <input
            type="text"
            placeholder="العنوان بالتفصيل *"
            value={form.customerAddress}
            onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
            required
            className="input-premium w-full"
          />
          <textarea
            placeholder="ملاحظات"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="input-premium w-full resize-none"
          />

          <div className="relative">
            <input
              type="text"
              placeholder="بحث عن منتج..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="input-premium w-full"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addItem(p)}
                    className="w-full text-right px-3 py-2.5 text-[13px] hover:bg-blue-50 flex items-center justify-between transition-colors"
                  >
                    <span className="font-medium text-slate-700">{p.nameAr}</span>
                    <span className="text-blue-600 font-semibold">{formatCurrency(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{item.productName}</p>
                    <p className="text-[11px] text-slate-400">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="w-6 h-6 rounded-lg bg-slate-100 text-[13px] font-bold hover:bg-slate-200 transition-colors">-</button>
                    <span className="text-[13px] w-6 text-center font-semibold">{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="w-6 h-6 rounded-lg bg-slate-100 text-[13px] font-bold hover:bg-slate-200 transition-colors">+</button>
                    <button type="button" onClick={() => removeItem(item.productId)} className="text-red-500 hover:text-red-700 mr-1 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-3 space-y-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-slate-500">المجموع</span>
              <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-slate-500">الشحن</span>
              <span className="font-semibold tabular-nums">{formatCurrency(50)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-1">
              <span className="text-sm font-bold text-slate-900">الإجمالي</span>
              <span className="text-lg font-extrabold text-blue-600 tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {submitting ? "جاري الإنشاء..." : "إنشاء الطلب"}
          </button>
        </form>
      </div>
    </div>
  )
}
