"use client"
import { useEffect, useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight, Package, Loader2, Pencil, MessageCircle, Phone, Share2, Printer,
  RotateCcw, Truck, User, MapPin, FileText, Check, X, Plus, Minus,
  BadgePercent, Clock, CheckCircle2, History, AlertCircle, Search as SearchIcon,
  Wallet, ShieldCheck, Ban, Undo2,
} from "lucide-react"
import { formatCurrency, formatDateTime, getStatusText } from "@/lib/utils"
import StatusBadge from "@/components/StatusBadge"
import { buildOrderTimeline, waLink, telLink, orderSummaryText, shareOrder, printOrder, recreateOrder } from "@/lib/orderUtils"
import { useToast } from "@/components/Toast"
import CopyButton from "@/components/CopyButton"
import { PHONE_RE, cleanPhone } from "@/lib/cart-utils"

const ACTION_LABELS: Record<string, string> = {
  ORDER_EDITED: "تعديل الطلب",
  ORDER_STATUS_CHANGED: "تغيير الحالة",
  ORDER_UPDATED: "تحديث البيانات",
  ORDER_ITEMS_UPDATED: "تعديل المنتجات",
  ORDER_AUTO_CANCELLED: "إلغاء تلقائي",
  ORDER_EXTERNAL_UPDATE: "تحديث خارجي (n8n)",
}

function HistoryDetails({ entry }: { entry: any }) {
  let parsed: any = null
  try { parsed = entry.details ? JSON.parse(entry.details) : null } catch { parsed = null }

  if (parsed && Array.isArray(parsed.changes)) {
    return (
      <div className="mt-2 space-y-1">
        {parsed.changes.map((c: any, i: number) => (
          <div key={i} className="flex items-center gap-2 text-[11px] flex-wrap">
            <span className="font-semibold text-slate-700">{c.label}</span>
            <span className="text-slate-400 line-through">{String(c.oldValue ?? "") || "—"}</span>
            <span className="text-slate-300">←</span>
            <span className="font-semibold text-emerald-600">{String(c.newValue ?? "") || "—"}</span>
          </div>
        ))}
      </div>
    )
  }
  if (parsed && parsed.from && parsed.to) {
    return (
      <div className="mt-2 flex items-center gap-2 text-[11px] flex-wrap">
        <span className="text-slate-400 line-through">{getStatusText(parsed.from)}</span>
        <span className="text-slate-300">←</span>
        <span className="font-semibold text-emerald-600">{getStatusText(parsed.to)}</span>
      </div>
    )
  }
  if (parsed && Array.isArray(parsed.fields)) {
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {parsed.fields.map((f: any, i: number) => (
          <span key={i} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{f.label}</span>
        ))}
      </div>
    )
  }
  if (typeof entry.details === "string" && entry.details.trim()) {
    let text = entry.details
    if (parsed) text = [parsed.subtotal && `إجمالي: ${formatCurrency(parsed.subtotal)}`, parsed.commission !== undefined && `عمولة: ${formatCurrency(parsed.commission)}`].filter(Boolean).join(" · ")
    return <p className="mt-1.5 text-[11px] text-slate-500">{text}</p>
  }
  return null
}

function ChangeRow({ change }: { change: { label: string; oldValue: string; newValue: string } }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
      <span className="text-[12px] font-semibold text-slate-700 shrink-0 w-24">{change.label}</span>
      <div className="flex-1 flex items-center justify-end gap-2 min-w-0 flex-wrap">
        <span className="text-[11px] text-slate-400 line-through truncate">{change.oldValue || "—"}</span>
        <span className="text-slate-300">←</span>
        <span className="text-[12px] font-bold text-emerald-600 truncate">{change.newValue || "—"}</span>
      </div>
    </div>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const { toast } = useToast()
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [savedChanges, setSavedChanges] = useState<any[] | null>(null)

  const fetchDetail = () => {
    setLoading(true)
    fetch(`/api/orders/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) { setNotFound(true); return }
        setDetail(data)
        setNotFound(false)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchDetail() }, [id])

  useEffect(() => {
    fetch(`/api/notifications`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link: `/orders/${id}` }),
    }).catch(() => {})
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 rounded-xl animate-spin" style={{ border: "3px solid #e2e8f0", borderTopColor: "#3b82f6" }} />
      </div>
    )
  }

  if (notFound || !detail?.order) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <Package size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-900 font-semibold mb-1">الطلب غير موجود</p>
        <p className="text-slate-400 text-sm mb-6">قد يكون الطلب غير متاح أو لا يخص حسابك</p>
        <Link href="/orders" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          <ArrowRight size={15} /> العودة للطلبات
        </Link>
      </div>
    )
  }

  const order = detail.order
  const items = detail.items || []
  const commission = detail.commission || 0
  const isEditable = detail.isEditable
  const history = detail.history || []

  const statusBanner =
    order.status === "CANCELLED" ? { tone: "bg-red-50 border-red-100 text-red-700", icon: Ban, text: "تم إلغاء الطلب" } :
    order.status === "RETURNED" ? { tone: "bg-orange-50 border-orange-100 text-orange-700", icon: Undo2, text: "تم إرجاع الطلب" } :
    order.status === "REJECTED" ? { tone: "bg-red-50 border-red-100 text-red-700", icon: X, text: "تم رفض الطلب" } :
    null

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="p-2 rounded-xl hover:bg-white transition-colors text-slate-600">
            <ArrowRight size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-mono" dir="ltr">{order.orderNumber}</h1>
            </div>
            <p className="text-[12px] text-slate-500 mt-0.5">{formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditable && (
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[13px] font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 active:scale-[0.97]">
              <Pencil size={14} /> تعديل الطلب
            </button>
          )}
        </div>
      </div>

      {/* Status badges + timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={order.status} size="md" />
            <StatusBadge status={order.paymentStatus} size="md" />
          </div>
          {isEditable ? (
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <Pencil size={11} /> قابل للتعديل — {getStatusText(order.status)}
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
              <LockIcon /> التعديل غير متاح في هذه المرحلة
            </span>
          )}
        </div>

        {statusBanner && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${statusBanner.tone}`}>
            <statusBanner.icon size={16} />
            <span className="text-[13px] font-bold">{statusBanner.text}</span>
            {order.cancelReason && <span className="text-[12px] opacity-80">— {order.cancelReason}</span>}
          </div>
        )}

        {["PENDING", "UNDER_REVIEW"].includes(order.status) && order.confirmationDeadline && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-[12px] font-semibold">
            <Clock size={13} />
            آخر موعد لتأكيد الطلب: {formatDateTime(order.confirmationDeadline)}
          </div>
        )}

        {order.status === "SHIPPED" && order.trackingNumber && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-purple-50 border border-purple-100">
            <span className="flex items-center gap-2 text-[12px] font-bold text-purple-700">
              <Truck size={14} /> رقم التتبع
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] font-mono text-purple-800 truncate" dir="ltr">{order.trackingNumber}</span>
              <CopyButton text={order.trackingNumber} success="تم نسخ رقم التتبع" />
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <h3 className="text-[12px] font-bold text-slate-500 mb-3 flex items-center gap-1.5">
            <History size={13} /> حالة الطلب
          </h3>
          <ol className="space-y-0">
            {buildOrderTimeline(order.status).map((step, i) => {
              const steps = buildOrderTimeline(order.status)
              const isLast = i === steps.length - 1
              return (
                <li key={step.status} className="relative flex items-start gap-3 pb-5 last:pb-0">
                  {!isLast && (
                    <span className={`absolute top-5 right-[9px] w-0.5 h-[calc(100%-16px)] ${step.done ? "bg-blue-500/40" : step.active ? "bg-blue-200" : "bg-slate-200"}`} />
                  )}
                  <span className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    step.done ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                      : step.active ? "bg-white border-2 border-blue-500"
                      : "bg-slate-200"
                  }`}>
                    {step.done ? <Check size={11} strokeWidth={3} /> : step.active ? <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse-soft" /> : null}
                  </span>
                  <div className="pt-0.5">
                    <p className={`text-[13px] font-semibold ${step.active ? "text-blue-700" : step.done ? "text-slate-700" : "text-slate-400"}`}>
                      {step.label}
                    </p>
                    {step.active && <p className="text-[11px] text-blue-500 mt-0.5">الحالة الحالية</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      {/* Confirmation info */}
      {detail.confirmedBy && (
        <div className="flex items-center gap-3 bg-blue-50/70 border border-blue-100 rounded-2xl px-4 py-3">
          <ShieldCheck size={18} className="text-blue-500 shrink-0" />
          <div className="text-[12px]">
            <p className="font-bold text-blue-700">تم تأكيد الطلب</p>
            <p className="text-blue-600/80">
              بواسطة <span className="font-semibold">{detail.confirmedBy.name}</span> في {detail.confirmedBy.confirmedAt ? formatDateTime(detail.confirmedBy.confirmedAt) : order.confirmedAt ? formatDateTime(order.confirmedAt) : ""}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Items */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Package size={15} className="text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">المنتجات ({items.length})</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {items.map((item: any) => (
                <div key={item.id} className="p-4 flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                    {item.product?.image ? (
                      <img src={item.product.image} alt={item.product?.nameAr} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={18} className="text-slate-300" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800 leading-snug">{item.product?.nameAr}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{formatCurrency(item.unitPrice)} × {item.quantity}</p>
                      </div>
                      <p className="text-[13px] font-bold text-slate-900 tabular-nums shrink-0">{formatCurrency(item.total)}</p>
                    </div>
                    {item.commission > 0 ? (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                        <BadgePercent size={11} /> عمولتك: {formatCurrency(item.commission)}
                      </p>
                    ) : (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <BadgePercent size={11} /> بدون عمولة على هذا المنتج
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commission card */}
          <div className={`rounded-2xl border shadow-sm overflow-hidden ${commission > 0 ? "bg-gradient-to-br from-emerald-500 to-green-600 border-emerald-600" : "bg-white border-slate-100"}`}>
            <div className="px-5 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${commission > 0 ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"}`}>
                  <Wallet size={17} />
                </span>
                <div>
                  <h2 className={`text-sm font-bold ${commission > 0 ? "text-white" : "text-slate-900"}`}>عمولتك من هذا الطلب</h2>
                  <p className={`text-[11px] ${commission > 0 ? "text-white/70" : "text-slate-400"}`}>تُضاف إلى رصيدك عند تحصيل الطلب</p>
                </div>
              </div>
              <p className={`text-2xl font-extrabold tabular-nums ${commission > 0 ? "text-white" : "text-emerald-600"}`}>{formatCurrency(commission)}</p>
            </div>
            {commission > 0 && (
              <div className="px-5 pb-4">
                <div className="bg-white/10 rounded-xl p-3 space-y-1.5">
                  {items.filter((i: any) => i.commission > 0).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between text-[12px] text-white/90">
                      <span className="truncate pl-2">{item.product?.nameAr}</span>
                      <span className="tabular-nums font-semibold shrink-0">{formatCurrency(item.commission)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <User size={15} className="text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900">بيانات العميل</h2>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[14px] font-semibold text-slate-900">{order.customerName}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] text-slate-600" dir="ltr"><Phone size={13} className="text-slate-300" /> {order.customerPhone}</span>
                <CopyButton text={order.customerPhone} success="تم نسخ الهاتف" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] text-slate-600 min-w-0">
                  <MapPin size={13} className="text-slate-300 shrink-0" />
                  <span className="truncate">
                    {order.customerAddress}{order.customerCity ? `، ${order.customerCity}` : ""}{order.customerGovernorate ? ` — ${order.customerGovernorate}` : ""}
                  </span>
                </span>
                <CopyButton text={`${order.customerAddress}، ${order.customerCity}`} success="تم نسخ العنوان" />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-50 pt-3">
                <span className="flex items-center gap-2 text-[13px] text-slate-600"><FileText size={13} className="text-slate-300" /> {order.orderNumber}</span>
                <CopyButton text={order.orderNumber} success="تم نسخ رقم الطلب" />
              </div>
              {order.notes && (
                <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3">
                  <p className="text-[11px] font-bold text-amber-800 mb-1">ملاحظات</p>
                  <p className="text-[13px] text-amber-700 leading-relaxed">{order.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <History size={15} className="text-slate-400" />
                <h2 className="text-sm font-bold text-slate-900">سجل الطلب</h2>
              </div>
              <div className="p-5 space-y-4">
                {history.map((entry: any) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                      <span className="w-px flex-1 bg-slate-100 mt-1" />
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-[12px] font-bold text-slate-800">{ACTION_LABELS[entry.action] || entry.action}</p>
                        <p className="text-[10px] text-slate-400">{formatDateTime(entry.createdAt)}</p>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {entry.user?.name}
                        {entry.action === "ORDER_AUTO_CANCELLED" ? " (النظام)" : ""}
                      </p>
                      <HistoryDetails entry={entry} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Totals */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2.5">
            <h2 className="text-sm font-bold text-slate-900 mb-1">ملخص الطلب</h2>
            <div className="flex justify-between text-[13px]">
              <span className="text-slate-500">المجموع الفرعي</span>
              <span className="font-semibold text-slate-800 tabular-nums">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-slate-500 flex items-center gap-1.5"><Truck size={13} className="text-slate-400" /> الشحن</span>
              <span className="font-semibold text-slate-800 tabular-nums">{formatCurrency(order.shippingCost)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">الخصم</span>
                <span className="font-semibold text-red-500 tabular-nums">− {formatCurrency(order.discount)}</span>
              </div>
            )}
            <div className="border-t border-slate-100 pt-2.5 flex justify-between items-baseline">
              <span className="text-[14px] font-bold text-slate-900">الإجمالي</span>
              <span className="text-lg font-extrabold text-blue-600 tabular-nums">{formatCurrency(order.total)}</span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
              <Wallet size={14} className="text-emerald-600 shrink-0" />
              <span className="text-[12px] font-bold text-emerald-700">صافي استحقاقك: {formatCurrency(commission)}</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h2 className="text-[12px] font-bold text-slate-500 mb-3">إجراءات سريعة</h2>
            <div className="grid grid-cols-2 gap-2">
              <a href={waLink(order.customerPhone, orderSummaryText(order))} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-colors text-[12px] font-bold">
                <MessageCircle size={15} /> واتساب
              </a>
              <a href={telLink(order.customerPhone)}
                className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 hover:bg-blue-100 transition-colors text-[12px] font-bold">
                <Phone size={15} /> اتصال
              </a>
              <button onClick={() => shareOrder(order)}
                className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 hover:bg-purple-100 transition-colors text-[12px] font-bold">
                <Share2 size={15} /> مشاركة
              </button>
              <button onClick={() => printOrder(order)}
                className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors text-[12px] font-bold">
                <Printer size={15} /> طباعة
              </button>
              <button onClick={() => recreateOrder(order)}
                className="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 hover:bg-amber-100 transition-colors text-[12px] font-bold col-span-2 justify-center">
                <RotateCcw size={15} /> إعادة إنشاء الطلب في العربة
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Saved changes banner */}
      {savedChanges && savedChanges.length > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-50 px-4">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-emerald-200 shadow-xl shadow-emerald-200/40 p-5 animate-slideInUp">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-bold text-emerald-700 flex items-center gap-2">
                <CheckCircle2 size={16} /> تم حفظ تعديلات الطلب بنجاح
              </p>
              <button onClick={() => setSavedChanges(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div>
              {savedChanges.map((c, i) => (
                <ChangeRow key={i} change={c} />
              ))}
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <EditOrderModal
          order={order}
          items={items}
          onClose={() => setShowEdit(false)}
          onSaved={(changes) => {
            setShowEdit(false)
            setSavedChanges(changes)
            fetchDetail()
          }}
        />
      )}
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

/* ================= Edit Order Modal ================= */

interface EditItem {
  productId: string
  nameAr: string
  image?: string
  quantity: number
  unitPrice: number
}

interface EditForm {
  customerName: string
  customerPhone: string
  customerEmail: string
  customerAddress: string
  customerCity: string
  customerGovernorate: string
  notes: string
}

const EMPTY_FORM: EditForm = {
  customerName: "", customerPhone: "", customerEmail: "",
  customerAddress: "", customerCity: "", customerGovernorate: "", notes: "",
}

function EditOrderModal({ order, items, onClose, onSaved }: {
  order: any
  items: any[]
  onClose: () => void
  onSaved: (changes: any[]) => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<EditForm>(() => ({
    customerName: order.customerName || "",
    customerPhone: order.customerPhone || "",
    customerEmail: order.customerEmail || "",
    customerAddress: order.customerAddress || "",
    customerCity: order.customerCity || "",
    customerGovernorate: order.customerGovernorate || "",
    notes: order.notes || "",
  }))
  const [editItems, setEditItems] = useState<EditItem[]>(() =>
    items.map((i) => ({
      productId: i.productId,
      nameAr: i.product?.nameAr || "",
      image: i.product?.image,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }))
  )
  const [productSearch, setProductSearch] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ id: string; nameAr: string; price: number }>>([])
  const [preview, setPreview] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (productSearch.trim().length < 2) { setSearchResults([]); return }
    const timer = setTimeout(() => {
      fetch(`/api/products?search=${productSearch}&limit=5`)
        .then((res) => res.json())
        .then((d) => setSearchResults(d.products || []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch])

  useEffect(() => {
    if (editItems.length === 0) { setPreview(null); return }
    setPreviewLoading(true)
    const timer = setTimeout(() => {
      fetch("/api/orders/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: editItems.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
          customerGovernorate: form.customerGovernorate,
          customerCity: form.customerCity,
        }),
      })
        .then((res) => res.json())
        .then((d) => { if (!d.error) setPreview(d) })
        .catch(() => {})
        .finally(() => setPreviewLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [editItems, form.customerGovernorate, form.customerCity])

  const addItem = (p: { id: string; nameAr: string; price: number }) => {
    if (editItems.find((i) => i.productId === p.id)) return
    setEditItems([...editItems, { productId: p.id, nameAr: p.nameAr, quantity: 1, unitPrice: p.price }])
    setProductSearch(""); setSearchResults([])
  }
  const removeItem = (productId: string) => setEditItems(editItems.filter((i) => i.productId !== productId))
  const updateQty = (productId: string, qty: number) => {
    if (qty < 1) return
    setEditItems(editItems.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)))
  }
  const updatePrice = (productId: string, price: number) => {
    if (!isNaN(price) && price >= 0) setEditItems(editItems.map((i) => (i.productId === productId ? { ...i, unitPrice: price } : i)))
  }

  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    if (!form.customerName.trim()) e.customerName = "اسم العميل مطلوب"
    if (!cleanPhone(form.customerPhone)) e.customerPhone = "رقم الهاتف مطلوب"
    else if (!PHONE_RE.test(cleanPhone(form.customerPhone))) e.customerPhone = "رقم غير صحيح — أدخل 11 رقمًا يبدأ بـ 01"
    if (!form.customerCity.trim()) e.customerCity = "المدينة مطلوبة"
    if (!form.customerAddress.trim()) e.customerAddress = "العنوان مطلوب"
    return e
  }, [form])
  const isFormValid = Object.keys(errors).length === 0
  const fieldError = (k: string) => (touched[k] ? errors[k] : undefined)

  const hasChanges = useMemo(() => {
    const sameForm =
      form.customerName === (order.customerName || "") &&
      form.customerPhone === (order.customerPhone || "") &&
      form.customerEmail === (order.customerEmail || "") &&
      form.customerAddress === (order.customerAddress || "") &&
      form.customerCity === (order.customerCity || "") &&
      form.customerGovernorate === (order.customerGovernorate || "") &&
      form.notes === (order.notes || "")
    const sameItems =
      editItems.length === items.length &&
      editItems.every((ni) => {
        const oi = items.find((x) => x.productId === ni.productId)
        return oi && oi.quantity === ni.quantity && oi.unitPrice === ni.unitPrice
      })
    return !sameForm || !sameItems
  }, [form, editItems, order, items])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editItems.length === 0) { toast("أضف منتجات للطلب", "error"); return }
    if (!isFormValid) {
      setTouched({ customerName: true, customerPhone: true, customerCity: true, customerAddress: true })
      toast(Object.values(errors)[0] || "أكمل البيانات المطلوبة", "error")
      return
    }
    if (!hasChanges) { toast("لا توجد تغييرات لحفظها", "info"); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items: editItems.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })) }),
      })
      const data = await res.json()
      if (res.ok) {
        toast("تم حفظ تعديلات الطلب", "success")
        onSaved(data.changes || [])
      } else {
        toast(data.error || "حدث خطأ أثناء الحفظ", "error")
        if (res.status === 403 || res.status === 404) {
          setTimeout(onClose, 1200)
        }
      }
    } catch {
      toast("حدث خطأ في الاتصال", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const subtotal = preview?.subtotal ?? editItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const shippingCost = preview?.shippingCost ?? order.shippingCost
  const total = preview?.total ?? subtotal + shippingCost
  const commission = preview?.commission ?? 0
  const previewItems = preview?.items || []

  return (
    <div className="fixed inset-0 bg-black/50 z-[75] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto animate-fade-in shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">تعديل الطلب</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono" dir="ltr">{order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {/* Customer */}
          <div>
            <h3 className="text-[12px] font-bold text-slate-500 mb-3 flex items-center gap-1.5"><User size={13} /> بيانات العميل</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  onBlur={() => setTouched({ ...touched, customerName: true })}
                  placeholder="اسم العميل *"
                  className={`input-premium ${fieldError("customerName") ? "input-error" : ""}`}
                />
                {fieldError("customerName") && <p className="text-[10px] text-red-500 mt-1">{fieldError("customerName")}</p>}
              </div>
              <div>
                <input
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                  onBlur={() => setTouched({ ...touched, customerPhone: true })}
                  placeholder="هاتف العميل *"
                  dir="ltr"
                  className={`input-premium ${fieldError("customerPhone") ? "input-error" : ""}`}
                />
                {fieldError("customerPhone") && <p className="text-[10px] text-red-500 mt-1">{fieldError("customerPhone")}</p>}
              </div>
              <div className="col-span-2">
                <input
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                  placeholder="البريد الإلكتروني (اختياري)"
                  dir="ltr"
                  className="input-premium w-full"
                />
              </div>
              <input
                value={form.customerGovernorate}
                onChange={(e) => setForm({ ...form, customerGovernorate: e.target.value })}
                placeholder="المحافظة (اختياري)"
                className="input-premium"
              />
              <div>
                <input
                  value={form.customerCity}
                  onChange={(e) => setForm({ ...form, customerCity: e.target.value })}
                  onBlur={() => setTouched({ ...touched, customerCity: true })}
                  placeholder="المدينة *"
                  className={`input-premium ${fieldError("customerCity") ? "input-error" : ""}`}
                />
                {fieldError("customerCity") && <p className="text-[10px] text-red-500 mt-1">{fieldError("customerCity")}</p>}
              </div>
              <div className="col-span-2">
                <input
                  value={form.customerAddress}
                  onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                  onBlur={() => setTouched({ ...touched, customerAddress: true })}
                  placeholder="العنوان بالتفصيل *"
                  className={`input-premium w-full ${fieldError("customerAddress") ? "input-error" : ""}`}
                />
                {fieldError("customerAddress") && <p className="text-[10px] text-red-500 mt-1">{fieldError("customerAddress")}</p>}
              </div>
              <div className="col-span-2">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="ملاحظات"
                  rows={2}
                  className="input-premium w-full resize-none"
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-[12px] font-bold text-slate-500 mb-3 flex items-center gap-1.5"><Package size={13} /> المنتجات</h3>
            <div className="relative mb-3">
              <SearchIcon size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="بحث وإضافة منتج..."
                className="input-premium w-full pr-9"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl mt-1 shadow-lg z-20 overflow-hidden">
                  {searchResults.map((p) => (
                    <button key={p.id} type="button" onClick={() => addItem(p)}
                      className="w-full text-right px-3 py-2.5 text-[13px] hover:bg-blue-50 flex items-center justify-between transition-colors">
                      <span className="font-medium text-slate-700">{p.nameAr}</span>
                      <span className="text-blue-600 font-semibold">{formatCurrency(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {editItems.length === 0 && (
              <p className="text-center text-slate-400 text-[12px] py-6 border border-dashed border-slate-200 rounded-xl">لا توجد منتجات — أضف منتجًا</p>
            )}

            <div className="space-y-2">
              {editItems.map((item) => {
                const itemComm = previewItems.find((p: any) => p.productId === item.productId)?.commission || 0
                return (
                  <div key={item.productId} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                    <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                      {item.image ? <img src={item.image} alt={item.nameAr} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package size={15} className="text-slate-300" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{item.nameAr}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[11px] text-slate-500 flex items-center gap-0.5">
                          السعر:
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updatePrice(item.productId, parseFloat(e.target.value))}
                            className="w-20 px-1.5 py-0.5 text-[12px] font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:border-blue-400 outline-none"
                            dir="ltr"
                          />
                        </span>
                        <span className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
                          <button type="button" onClick={() => updateQty(item.productId, item.quantity - 1)} className="w-6 h-6 rounded-md text-[12px] font-bold hover:bg-slate-100 transition-colors">−</button>
                          <span className="w-6 text-center text-[12px] font-bold tabular-nums">{item.quantity}</span>
                          <button type="button" onClick={() => updateQty(item.productId, item.quantity + 1)} className="w-6 h-6 rounded-md text-[12px] font-bold hover:bg-slate-100 transition-colors">+</button>
                        </span>
                        {itemComm > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md tabular-nums">عمولة {formatCurrency(itemComm)}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-[12px] font-bold text-slate-800 tabular-nums shrink-0">{formatCurrency(item.unitPrice * item.quantity)}</p>
                    <button type="button" onClick={() => removeItem(item.productId)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Preview totals */}
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500 flex items-center gap-1">
                المجموع الفرعي {previewLoading && <Loader2 size={11} className="animate-spin text-slate-300" />}
              </span>
              <span className="font-semibold text-slate-800 tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500 flex items-center gap-1"><Truck size={12} className="text-slate-400" /> الشحن</span>
              <span className="font-semibold text-slate-800 tabular-nums">{formatCurrency(shippingCost)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate-500 flex items-center gap-1"><Wallet size={12} className="text-slate-400" /> عمولتك المتوقعة</span>
              <span className="font-bold text-emerald-600 tabular-nums">{formatCurrency(commission)}</span>
            </div>
            <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between">
              <span className="text-[14px] font-bold text-slate-900">الإجمالي</span>
              <span className="text-lg font-extrabold text-blue-600 tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Change summary preview */}
          {hasChanges && (
            <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4">
              <p className="text-[12px] font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                <AlertCircle size={13} /> ملخص التعديلات
              </p>
              <p className="text-[11px] text-blue-600/80">
                سيتم تحديث بيانات العميل والمنتجات، وإعادة حساب الإجمالي والعمولة حسب الأسعار الحالية للمنتجات.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              إلغاء
            </button>
            <button type="submit" disabled={submitting || !hasChanges}
              className="flex-[1.5] px-4 py-3 rounded-xl bg-indigo-600 text-white text-[13px] font-bold hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {submitting ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
