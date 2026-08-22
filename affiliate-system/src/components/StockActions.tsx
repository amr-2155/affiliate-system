"use client"
import { useCallback, useEffect, useState } from "react"
import { RefreshCw, Eye, Loader2, X, Clock, CheckCircle2, AlertTriangle, Package, CalendarDays, Hash } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { useToast } from "@/components/Toast"

interface StockProduct {
  id: string
  nameAr: string
  stock: number
  image?: string
}

interface StockRequest {
  id: string
  requestedQty: number
  currentStock: number
  status: string
  reason?: string | null
  createdAt: string
  processedAt?: string | null
}

interface StockData {
  product: {
    id: string
    nameAr: string
    image?: string | null
    stock: number
    lowStockThreshold: number
    status: string
    updatedAt: string
  }
  requests: StockRequest[]
  lastRefill?: { id: string; processedAt: string | null; processedById?: string; requestedQty: number } | null
  lowStock: boolean
  pendingRequest: boolean
}

const REQUEST_STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "قيد المراجعة", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70" },
  RESTOCKED: { label: "تم التجديد", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70" },
  REJECTED: { label: "مرفوض", cls: "bg-red-50 text-red-600 ring-1 ring-red-200/70" },
}

/**
 * مكوّن مشترك لإدارة مخزون أي منتج: زر طلب تجديد المخزون + زر متابعة المخزون مع نوافذهما.
 * يُستخدم تلقائيًا لكل منتج (بطاقات المنتجات وصفحة تفاصيل المنتج) دون إضافة يدوية لكل منتج.
 */
export default function StockActions({ product, compact = false }: {
  product: StockProduct
  compact?: boolean
}) {
  const { toast } = useToast()
  const [data, setData] = useState<StockData | null>(null)
  const [showRefill, setShowRefill] = useState(false)
  const [showTrack, setShowTrack] = useState(false)
  const [refillQty, setRefillQty] = useState("")
  const [refillSubmitting, setRefillSubmitting] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/stock-refill/requests?productId=${product.id}`)
      .then((r) => r.json())
      .then((d) => setData(d as StockData))
      .catch(() => setData(null))
  }, [product.id])

  useEffect(() => { load() }, [load])

  const pendingRequest = !!data?.pendingRequest
  const lowStock = !!data?.lowStock
  const stock = data?.product?.stock ?? product.stock

  const confirmRefill = async () => {
    setRefillSubmitting(true)
    try {
      const res = await fetch("/api/stock-refill/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity: refillQty }),
      })
      const d = await res.json()
      if (res.ok) {
        toast(`تم إرسال طلب تجديد مخزون "${product.nameAr}" — بانتظار موافقة الإدارة`, "success")
        setShowRefill(false)
        load()
      } else {
        toast(d.error || "تعذر إرسال الطلب", "error")
        if (d.existing) setShowRefill(false)
      }
    } catch {
      toast("حدث خطأ أثناء إرسال الطلب", "error")
    }
    setRefillSubmitting(false)
  }

  return (
    <>
      {compact ? (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setShowRefill(true)}
            disabled={pendingRequest}
            className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
              pendingRequest
                ? "bg-emerald-50 text-emerald-600 border-emerald-200 cursor-default"
                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            }`}
            title={pendingRequest ? "يوجد طلب تجديد مفتوح لهذا المنتج" : "طلب تجديد المخزون"}
          >
            {pendingRequest ? <CheckCircle2 size={12} /> : <RefreshCw size={12} />}
            <span className="truncate">{pendingRequest ? "تم طلب التجديد" : "طلب تجديد المخزون"}</span>
          </button>
          <button
            onClick={() => setShowTrack(true)}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all"
            title="متابعة المخزون"
          >
            <Eye size={12} />
            <span>متابعة المخزون</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => setShowRefill(true)}
            disabled={pendingRequest}
            className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all border ${
              pendingRequest
                ? "bg-emerald-50 text-emerald-600 border-emerald-200 cursor-default"
                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            }`}
            title={pendingRequest ? "يوجد طلب تجديد مفتوح لهذا المنتج" : "طلب تجديد المخزون"}
          >
            {pendingRequest ? <CheckCircle2 size={14} /> : <RefreshCw size={14} />}
            {pendingRequest ? "تم طلب التجديد" : "طلب تجديد المخزون"}
          </button>
          <button
            onClick={() => setShowTrack(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all"
            title="متابعة المخزون"
          >
            <Eye size={14} />
            متابعة المخزون
          </button>
        </div>
      )}

      {/* Refill request modal */}
      {showRefill && (
        <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" onClick={() => setShowRefill(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #b45309, #f59e0b)" }}>
                  <RefreshCw size={16} className="text-white" />
                </div>
                <h2 className="text-[15px] font-bold text-slate-900">طلب تجديد المخزون</h2>
              </div>
              <button onClick={() => setShowRefill(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-5">
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] text-slate-500">المنتج</p>
                  <p className="text-[13px] font-bold text-slate-900 truncate">{product.nameAr}</p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] text-slate-500">الرصيد / المخزون الحالي</p>
                  <span className={`text-[13px] font-extrabold tabular-nums ${stock === 0 ? "text-red-500" : lowStock ? "text-amber-600" : "text-emerald-600"}`}>
                    {stock} قطعة
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] text-slate-500">الكمية المطلوبة (اختياري)</p>
                  <input
                    type="number" min={0}
                    value={refillQty}
                    onChange={(e) => setRefillQty(e.target.value)}
                    placeholder="—"
                    className="w-24 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-left"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-3 flex items-start gap-1.5">
                <Clock size={12} className="shrink-0 mt-0.5" />
                بعد التأكيد سيصل طلبك للإدارة للمراجعة، وتصلك إشعارات فورية عند تجديد المخزون أو رفض الطلب.
              </p>
              <div className="flex items-center gap-2 mt-5">
                <button onClick={() => setShowRefill(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                  إلغاء
                </button>
                <button
                  onClick={confirmRefill}
                  disabled={refillSubmitting}
                  className="flex-1 py-2.5 rounded-xl text-white text-[12px] font-bold transition-all shadow-md bg-brand-gradient-warm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {refillSubmitting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  تأكيد الطلب
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock follow modal */}
      {showTrack && (
        <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" onClick={() => setShowTrack(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
                  <Eye size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-slate-900 truncate">{product.nameAr}</h2>
                  <p className="text-[11px] text-slate-400">متابعة المخزون</p>
                </div>
              </div>
              <button onClick={() => setShowTrack(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="p-5">
              {data ? (
                <>
                  {lowStock && (
                    <div className="mb-4 flex items-start gap-2 text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                      <span>تنبيه: المخزون وصل إلى حد الإنذار ({data.product.lowStockThreshold} قطع أو أقل) — يُنصح بطلب تجديد المخزون.</span>
                    </div>
                  )}

                  <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-[12px] text-slate-500">المخزون الحالي</span>
                      <span className={`text-[14px] font-extrabold tabular-nums ${stock === 0 ? "text-red-500" : lowStock ? "text-amber-600" : "text-emerald-600"}`}>
                        {stock} قطعة
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-[12px] text-slate-500">الكمية المتاحة</span>
                      <span className="font-bold text-slate-800 tabular-nums">{stock} قطعة</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-[12px] text-slate-500">حالة آخر طلب تجديد</span>
                      {data.requests.length > 0 ? (
                        <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-lg ${(REQUEST_STATUS_META[data.requests[0].status] || REQUEST_STATUS_META.PENDING).cls}`}>
                          {(REQUEST_STATUS_META[data.requests[0].status] || REQUEST_STATUS_META.PENDING).label}
                        </span>
                      ) : (
                        <span className="text-slate-400">لا توجد طلبات سابقة</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-[12px] text-slate-500">تاريخ آخر تجديد</span>
                      {data.lastRefill?.processedAt ? (
                        <span className="font-semibold text-slate-800 text-[12px]">{formatDateTime(data.lastRefill.processedAt)}</span>
                      ) : (
                        <span className="text-slate-400">لم يتم تجديده من قبل</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-[12px] text-slate-500">آخر تحديث للمخزون</span>
                      <span className="font-semibold text-slate-800 text-[12px]">{formatDateTime(data.product.updatedAt)}</span>
                    </div>
                  </div>

                  {data.requests.length > 1 && (
                    <div className="mt-4">
                      <p className="text-[11px] font-bold text-slate-500 mb-2 flex items-center gap-1"><CalendarDays size={11} /> طلبات التجديد السابقة</p>
                      <div className="space-y-1.5">
                        {data.requests.slice(1).map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 rounded-lg px-3 py-2">
                            <span className="text-slate-500 flex items-center gap-1"><Hash size={10} /> {formatDateTime(r.createdAt)}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold ${(REQUEST_STATUS_META[r.status] || REQUEST_STATUS_META.PENDING).cls}`}>
                              {(REQUEST_STATUS_META[r.status] || REQUEST_STATUS_META.PENDING).label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!pendingRequest && (
                    <button
                      onClick={() => { setShowTrack(false); setShowRefill(true) }}
                      className="mt-4 w-full py-2.5 rounded-xl text-white text-[12px] font-bold transition-all shadow-md bg-brand-gradient-warm flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={14} />
                      طلب تجديد المخزون الآن
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Package size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-center text-slate-400 text-[13px]">تعذر تحميل بيانات المخزون</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
