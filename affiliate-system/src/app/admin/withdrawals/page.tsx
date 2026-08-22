"use client"
import { useEffect, useState, useRef } from "react"
import { Wallet, Loader2, CheckCircle, XCircle, Clock, CheckCheck, Upload, X, Eye, Maximize2, Landmark, Smartphone, Zap, MoreHorizontal } from "lucide-react"
import { formatCurrency, formatDate, getStatusColor, getStatusText } from "@/lib/utils"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import Lightbox from "@/components/Lightbox"
import { useToast } from "@/components/Toast"
import ConfirmDialog from "@/components/ConfirmDialog"

export default function AdminWithdrawalsPage() {
  const perms = usePermissions()
  const can = perms.can
  const { toast } = useToast()
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [actionTarget, setActionTarget] = useState<any>(null)
  const [completing, setCompleting] = useState<any>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const fetchData = () => {
    setLoading(true)
    fetch("/api/admin/withdrawals").then(r => r.json()).then(d => {
      setWithdrawals(Array.isArray(d) ? d : []); setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    const hid = new URLSearchParams(window.location.search).get("highlight")
    if (hid) {
      setHighlighted(hid)
      setFilter("")
      fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relatedId: hid }),
      }).catch(() => {})
      window.history.replaceState(null, "", "/admin/withdrawals")
    }
  }, [])

  useEffect(() => {
    if (!highlighted || loading) return
    const scrollT = setTimeout(() => {
      const el = document.getElementById(`wdr-admin-${highlighted}`)
      if (el && el.offsetParent !== null) el.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 300)
    const clearT = setTimeout(() => setHighlighted(null), 4000)
    return () => { clearTimeout(scrollT); clearTimeout(clearT) }
  }, [highlighted, loading])

  const handleAction = async (id: string, status: string) => {
    const res = await fetch("/api/admin/withdrawals", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      toast(status === "APPROVED" ? "تم قبول الطلب بنجاح" : "تم رفض الطلب", status === "APPROVED" ? "success" : "warning")
    } else {
      const d = await res.json()
      toast(d.error || "تعذر تحديث الطلب", "error")
    }
    setActionTarget(null)
    fetchData()
  }

  const filtered = filter ? withdrawals.filter(w => w.status === filter) : withdrawals

  const methodLabels: Record<string, string> = { BANK_TRANSFER: "تحويل بنكي", VODAFONE_CASH: "فودافون كاش", INSTAPAY: "إنستاباي", OTHER: "أخرى" }

  const filters = [
    { key: "", label: `الكل (${withdrawals.length})`, icon: MoreHorizontal },
    { key: "PENDING", label: "قيد الانتظار", icon: Clock },
    { key: "APPROVED", label: "مقبول", icon: CheckCircle },
    { key: "REJECTED", label: "مرفوض", icon: XCircle },
    { key: "COMPLETED", label: "مكتمل", icon: CheckCheck },
  ]

  return (
    <RequirePerms perm="withdrawals.view">
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #b45309, #f59e0b)" }}>
          <Wallet size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">طلبات السحب</h1>
          <p className="text-[12px] text-slate-500">مراجعة طلبات سحب الأرباح وتأكيد التحويلات</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-1.5">
          {filters.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all
                ${filter === key
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"}`}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3 bg-slate-100 rounded-lg" />
                  <div className="w-24 h-2 bg-slate-100 rounded-lg" />
                </div>
                <div className="w-16 h-6 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Wallet size={32} className="text-slate-300" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">لا توجد طلبات</p>
          <p className="text-slate-400 text-sm">{filter ? "لا توجد طلبات بهذه الحالة" : "لم يتم تقديم أي طلبات سحب بعد"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(w => (
            <div key={w.id} id={`wdr-admin-${w.id}`} className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-sm transition-all ${highlighted === w.id ? "border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50/40" : "border-slate-100 hover:shadow-md"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: w.method === "BANK_TRANSFER" ? "#2563eb12" : w.method === "VODAFONE_CASH" ? "#d9770612" : w.method === "INSTAPAY" ? "#7c3aed12" : "#64748b12" }}>
                    {w.method === "BANK_TRANSFER" ? <Landmark size={17} className="text-blue-600" /> : w.method === "VODAFONE_CASH" ? <Smartphone size={17} className="text-amber-600" /> : w.method === "INSTAPAY" ? <Zap size={17} className="text-purple-600" /> : <Wallet size={17} className="text-slate-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-extrabold text-slate-900 tabular-nums">{formatCurrency(w.amount)}</span>
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-lg ${getStatusColor(w.status)}`}>{getStatusText(w.status)}</span>
                    </div>
                    <p className="text-[12px] text-slate-600 mt-1">{w.user?.name} <span className="text-slate-400" dir="ltr">· {w.user?.email}</span></p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{methodLabels[w.method] || w.method} · {w.accountName || "-"} {w.bankName ? `· ${w.bankName}` : ""}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1"><Clock size={10} /> {formatDate(w.createdAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  {w.status === "PENDING" && (
                    <>
                      {can("withdrawals.approve") && (
                        <button onClick={() => setActionTarget({ ...w, action: "APPROVED" })} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[12px] font-semibold hover:bg-emerald-100 border border-emerald-100 transition-colors"><CheckCircle size={14} /> قبول</button>
                      )}
                      {can("withdrawals.reject") && (
                        <button onClick={() => setActionTarget({ ...w, action: "REJECTED" })} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[12px] font-semibold hover:bg-red-100 border border-red-100 transition-colors"><XCircle size={14} /> رفض</button>
                      )}
                    </>
                  )}
                  {w.status === "APPROVED" && can("withdrawals.complete") && (
                    <button onClick={() => setCompleting(w)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[12px] font-semibold hover:bg-blue-100 border border-blue-100 transition-colors"><Upload size={14} /> إرسال إثبات التحويل</button>
                  )}
                  {w.proofImage && (
                    <button onClick={() => setPreview(w.proofImage)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-slate-600 rounded-xl text-[12px] font-semibold hover:bg-slate-100 border border-slate-100 transition-colors"><Eye size={14} /> الإثبات</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {completing && (
        <CompleteModal
          withdrawal={completing}
          onClose={() => { setCompleting(null); fetchData() }}
        />
      )}

      {preview && (
        <Lightbox src={preview} alt="إثبات التحويل" onClose={() => setPreview(null)} />
      )}

      <ConfirmDialog
        open={!!actionTarget}
        onClose={() => setActionTarget(null)}
        onConfirm={() => { if (actionTarget) handleAction(actionTarget.id, actionTarget.action) }}
        title={actionTarget?.action === "APPROVED" ? "قبول طلب السحب" : "رفض طلب السحب"}
        message={actionTarget?.action === "APPROVED" ? `سيتم الموافقة على سحب ${formatCurrency(actionTarget?.amount || 0)} للمسوق ${actionTarget?.user?.name}.` : `سيتم رفض طلب سحب ${formatCurrency(actionTarget?.amount || 0)}.`}
        confirmText={actionTarget?.action === "APPROVED" ? "قبول" : "رفض"}
        confirmClass={actionTarget?.action === "APPROVED" ? "bg-emerald-500 hover:bg-emerald-600" : ""}
      />
    </div>
    </RequirePerms>
  )
}

function CompleteModal({ withdrawal, onClose }: { withdrawal: any; onClose: () => void }) {
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [proofImage, setProofImage] = useState<string | null>(null)
  const [showFull, setShowFull] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "withdrawals")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (res.ok) {
        const { url } = await res.json()
        setProofImage(url)
      }
    } catch {
      toast("تعذر رفع الصورة", "error")
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleConfirm = async () => {
    if (!proofImage) {
      toast("ارفع صورة إثبات التحويل أولاً", "warning")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: withdrawal.id, status: "COMPLETED", proofImage }),
      })
      if (res.ok) toast("تم تأكيد التحويل بنجاح", "success")
      else {
        const d = await res.json()
        toast(d.error || "تعذر تأكيد التحويل", "error")
      }
      onClose()
    } catch {
      toast("حدث خطأ أثناء التأكيد", "error")
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}>
              <Upload size={15} className="text-white" />
            </div>
            <h2 className="text-[15px] font-bold text-slate-900">إثبات تحويل السحب</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6">
          <div className="card-premium p-4 mb-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-slate-500">المبلغ</p>
              <span className="text-[15px] font-extrabold text-slate-900 tabular-nums">{formatCurrency(withdrawal.amount)}</span>
            </div>
            <p className="text-[13px] text-slate-700 font-semibold">{withdrawal.user?.name}</p>
            <p className="text-[11px] text-slate-400" dir="ltr">{withdrawal.user?.email}</p>
            <p className="text-[11px] text-slate-500 mt-1 pt-1.5 border-t border-slate-100">{withdrawal.accountName} · {withdrawal.bankName} · {withdrawal.accountNumber}</p>
          </div>

          {proofImage ? (
            <div className="relative rounded-xl overflow-hidden mb-4 border border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowFull(true)}
                className="block w-full group relative"
                title="اضغط لفتح الصورة بالحجم الكامل"
              >
                <img
                  src={proofImage}
                  alt="الإثبات"
                  draggable={false}
                  decoding="async"
                  className="w-full max-h-56 object-contain"
                />
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="text-[12px] font-bold text-white bg-black/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <Maximize2 size={13} />
                    تكبير الصورة
                  </span>
                </span>
              </button>
              <button onClick={() => setProofImage(null)} className="absolute top-2 left-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className={`block mb-4 border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors bg-slate-50/50 ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-slate-500 text-sm"><Loader2 size={16} className="animate-spin" /> جاري الرفع...</div>
              ) : (
                <>
                  <Upload size={28} className="mx-auto text-slate-400 mb-2" />
                  <p className="text-[13px] text-slate-600 font-semibold">اضغط لرفع صورة إثبات التحويل</p>
                  <p className="text-[11px] text-slate-400 mt-1">jpg, png, webp — بحد أقصى 5 ميجا</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            </label>
          )}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              إلغاء
            </button>
            <button onClick={handleConfirm} disabled={submitting || !proofImage} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
              تأكيد التحويل
            </button>
          </div>
        </div>
      </div>

      {showFull && proofImage && (
        <Lightbox src={proofImage} alt="إثبات التحويل" onClose={() => setShowFull(false)} />
      )}
    </div>
  )
}
