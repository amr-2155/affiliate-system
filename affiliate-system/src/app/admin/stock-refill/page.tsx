"use client"
import { useEffect, useState } from "react"
import { Boxes, Loader2, Clock, CheckCircle2, XCircle, RefreshCw, X, Package, AlertTriangle, User, CalendarDays, Hash } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import { useToast } from "@/components/Toast"

interface StockRequest {
  id: string
  productId: string
  requestedQty: number
  currentStock: number
  status: string
  reason?: string | null
  createdAt: string
  processedAt?: string | null
  product: { id: string; nameAr: string; name: string; image?: string; stock: number; lowStockThreshold: number }
  affiliate: { id: string; name: string; email: string }
  processedBy?: { id: string; name: string } | null
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "قيد الانتظار", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70" },
  RESTOCKED: { label: "تم التجديد", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70" },
  REJECTED: { label: "مرفوض", cls: "bg-red-50 text-red-600 ring-1 ring-red-200/70" },
}

export default function AdminStockRefillPage() {
  const perms = usePermissions()
  const can = perms.can
  const { toast } = useToast()
  const [requests, setRequests] = useState<StockRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [approveTarget, setApproveTarget] = useState<StockRequest | null>(null)
  const [rejectTarget, setRejectTarget] = useState<StockRequest | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchData = (status = filter) => {
    setLoading(true)
    const qs = status ? `?status=${status}` : ""
    fetch(`/api/admin/stock-refill${qs}`)
      .then((r) => r.json())
      .then((d) => {
        setRequests(d.requests || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(filter) }, [filter])

  const doApprove = async (quantity: number) => {
    if (!approveTarget) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/stock-refill/${approveTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", quantity }),
      })
      const d = await res.json()
      if (res.ok) {
        toast(`تم تجديد مخزون "${approveTarget.product.nameAr}" بنجاح`, "success")
        setApproveTarget(null)
        fetchData()
      } else {
        toast(d.error || "تعذر تجديد المخزون", "error")
      }
    } catch {
      toast("حدث خطأ أثناء تجديد المخزون", "error")
    }
    setSubmitting(false)
  }

  const doReject = async (reason: string) => {
    if (!rejectTarget) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/stock-refill/${rejectTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason }),
      })
      const d = await res.json()
      if (res.ok) {
        toast(`تم رفض طلب "${rejectTarget.product.nameAr}"`, "warning")
        setRejectTarget(null)
        fetchData()
      } else {
        toast(d.error || "تعذر رفض الطلب", "error")
      }
    } catch {
      toast("حدث خطأ أثناء رفض الطلب", "error")
    }
    setSubmitting(false)
  }

  const pendingCount = requests.filter((r) => r.status === "PENDING").length
  const filters = [
    { key: "", label: `الكل (${requests.length})` },
    { key: "PENDING", label: `قيد الانتظار (${pendingCount})` },
    { key: "RESTOCKED", label: "تم التجديد" },
    { key: "REJECTED", label: "مرفوض" },
  ]

  return (
    <RequirePerms perm="products.view">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #b45309, #f59e0b)" }}>
              <Boxes size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">طلبات تجديد المخزون</h1>
              <p className="text-[12px] text-slate-500">مراجعة طلبات المسوقين وتجديد مخزون المنتجات</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-[12px] font-bold">
              <Clock size={13} />
              {pendingCount} طلب بانتظار المراجعة
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex flex-wrap gap-1.5">
            {filters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  filter === key
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="w-40 h-3 bg-slate-100 rounded-lg" />
                    <div className="w-24 h-2 bg-slate-100 rounded-lg" />
                  </div>
                  <div className="w-20 h-6 bg-slate-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <Boxes size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-900 font-semibold mb-1">لا توجد طلبات</p>
            <p className="text-slate-400 text-sm">{filter ? "لا توجد طلبات بهذه الحالة" : "لم يقدم المسوقون أي طلبات تجديد بعد"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const meta = STATUS_META[r.status] || { label: r.status, cls: "bg-slate-50 text-slate-600" }
              const lowStock = r.product.stock <= r.product.lowStockThreshold
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-100 shrink-0">
                        {r.product.image ? (
                          <img src={r.product.image} alt={r.product.nameAr} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Package size={20} className="text-slate-300" /></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-bold text-slate-900">{r.product.nameAr}</span>
                          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-lg ${meta.cls}`}>{meta.label}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1"><User size={10} /> {r.affiliate.name} <span className="text-slate-400" dir="ltr">· {r.affiliate.email}</span></p>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1"><CalendarDays size={10} /> {formatDate(r.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      {r.status === "PENDING" && (
                        <>
                          {can("products.update") && (
                            <button onClick={() => setApproveTarget(r)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[12px] font-semibold hover:bg-emerald-100 border border-emerald-100 transition-colors">
                              <RefreshCw size={14} /> تجديد المخزون
                            </button>
                          )}
                          {can("products.update") && (
                            <button onClick={() => setRejectTarget(r)} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[12px] font-semibold hover:bg-red-100 border border-red-100 transition-colors">
                              <XCircle size={14} /> رفض الطلب
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-50 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Hash size={11} className="text-slate-400" />
                      المخزون الحالي:
                      <span className={`font-bold tabular-nums ${lowStock ? "text-red-500" : "text-emerald-600"}`}>{r.product.stock}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <RefreshCw size={11} className="text-slate-400" />
                      الكمية المطلوبة:
                      <span className="font-bold text-slate-700 tabular-nums">{r.requestedQty > 0 ? r.requestedQty : "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock size={11} className="text-slate-400" />
                      المخزون عند الطلب:
                      <span className="font-bold text-slate-700 tabular-nums">{r.currentStock}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <CheckCircle2 size={11} className="text-slate-400" />
                      {r.status === "PENDING" ? "في انتظار المعالجة" : r.status === "RESTOCKED" ? `تمت المعالجة بواسطة ${r.processedBy?.name || ""}` : "تم الرفض"}
                    </div>
                  </div>

                  {r.status === "REJECTED" && r.reason && (
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                      <span><span className="font-bold">سبب الرفض:</span> {r.reason}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Approve modal */}
        {approveTarget && (
          <ApproveModal
            request={approveTarget}
            submitting={submitting}
            onClose={() => setApproveTarget(null)}
            onConfirm={doApprove}
          />
        )}

        {/* Reject modal */}
        {rejectTarget && (
          <RejectModal
            request={rejectTarget}
            submitting={submitting}
            onClose={() => setRejectTarget(null)}
            onConfirm={doReject}
          />
        )}
      </div>
    </RequirePerms>
  )
}

function ApproveModal({ request, submitting, onClose, onConfirm }: {
  request: StockRequest
  submitting: boolean
  onClose: () => void
  onConfirm: (quantity: number) => void
}) {
  const [quantity, setQuantity] = useState(request.requestedQty > 0 ? String(request.requestedQty) : "10")
  const lowStock = request.product.stock <= request.product.lowStockThreshold

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
              <RefreshCw size={15} className="text-white" />
            </div>
            <h2 className="text-[15px] font-bold text-slate-900">تجديد المخزون</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden border border-slate-100 shrink-0">
              {request.product.image ? (
                <img src={request.product.image} alt={request.product.nameAr} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Package size={20} className="text-slate-300" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-slate-900 truncate">{request.product.nameAr}</p>
              <p className="text-[12px] text-slate-500 mt-0.5">
                المخزون الحالي:{" "}
                <span className={`font-bold tabular-nums ${lowStock ? "text-red-500" : "text-emerald-600"}`}>{request.product.stock}</span>
                {lowStock && <span className="text-red-500 text-[11px] mr-1">(منخفض)</span>}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">طلب من: {request.affiliate.name}</p>
            </div>
          </div>

          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الكمية المضافة للمخزون</label>
          <div className="relative">
            <Hash size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="number" min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition-all"
              autoFocus
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <RefreshCw size={11} /> سيُضاف الرقم إلى المخزون الحالي، ويُسجَّل في سجل المخزون، ويصل إشعار فوري للمسوق.
          </p>

          <div className="flex gap-2 mt-5">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              إلغاء
            </button>
            <button
              onClick={() => { const q = parseInt(quantity); if (q > 0) onConfirm(q); }}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              تجديد المخزون
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RejectModal({ request, submitting, onClose, onConfirm }: {
  request: StockRequest
  submitting: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState("")

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #dc2626, #ef4444)" }}>
              <XCircle size={15} className="text-white" />
            </div>
            <h2 className="text-[15px] font-bold text-slate-900">رفض طلب التجديد</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6">
          <p className="text-[13px] text-slate-700 mb-3">
            رفض طلب تجديد مخزون <span className="font-bold">{request.product.nameAr}</span> من المسوق <span className="font-bold">{request.affiliate.name}</span>؟
          </p>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">سبب الرفض (اختياري)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="اكتب سبب الرفض ليظهر للمسوق..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent focus:bg-white transition-all resize-none"
          />

          <div className="flex gap-2 mt-5">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              إلغاء
            </button>
            <button
              onClick={() => onConfirm(reason.trim())}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-[13px] font-semibold hover:bg-red-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              رفض الطلب
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
