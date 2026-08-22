"use client"
import { useEffect, useState } from "react"
import { Lightbulb, Plus, Loader2, X, ExternalLink, Send, AlertCircle, PackageSearch } from "lucide-react"
import { formatDate, getStatusColor, getStatusText } from "@/lib/utils"
import { useToast } from "@/components/Toast"
import EmptyState from "@/components/EmptyState"

interface Suggestion {
  id: string
  productName: string
  productUrl?: string
  description?: string
  reason?: string
  status: string
  adminNotes?: string
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "قيد المراجعة",
  APPROVED: "تمت الموافقة",
  REJECTED: "مرفوض",
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchData = () => {
    setLoading(true)
    fetch("/api/suggestions")
      .then((res) => res.json())
      .then((data) => {
        setSuggestions(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const pendingCount = suggestions.filter((s) => s.status === "PENDING").length

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #b45309, #f59e0b)" }}>
            <Lightbulb size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">اقتراح منتج</h1>
            <p className="text-[12px] text-slate-500">
              {suggestions.length > 0
                ? pendingCount > 0
                  ? `${pendingCount} اقتراح قيد المراجعة`
                  : `${suggestions.length} اقتراح`
                : "اقترح منتجات جديدة تضيفها الإدارة للمتجر"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
        >
          <Plus size={16} />
          اقتراح منتج
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-premium p-5 space-y-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 w-40 bg-slate-100 rounded-lg" />
                <div className="h-5 w-20 bg-slate-100 rounded-full" />
              </div>
              <div className="h-3 w-3/4 bg-slate-50 rounded-lg" />
              <div className="h-3 w-1/2 bg-slate-50 rounded-lg" />
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <EmptyState
          icon={<PackageSearch size={26} className="text-slate-300" />}
          title="لم تقدم أي اقتراحات بعد"
          subtitle="عند اقتراحك منتجًا جديدًا ستظهر هنا حالته — قيد المراجعة، موافق عليه، أو مرفوض"
          action={
            <button onClick={() => setShowModal(true)} className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm">
              <Plus size={16} />
              اقترح أول منتج
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <div key={s.id} className="card-premium p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[14px] font-bold text-slate-900">{s.productName}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(s.status)}`}>
                      {STATUS_LABELS[s.status] || getStatusText(s.status)}
                    </span>
                  </div>
                  {s.description && <p className="text-[12px] text-slate-600 mt-1.5 leading-relaxed">{s.description}</p>}
                  {s.reason && (
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      <span className="font-semibold text-slate-500">السبب: </span>
                      {s.reason}
                    </p>
                  )}
                  {s.productUrl && (
                    <a
                      href={s.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 mt-2 transition-colors"
                    >
                      <ExternalLink size={11} />
                      رابط المنتج
                    </a>
                  )}
                  {s.adminNotes && (
                    <div className="mt-3 rounded-xl bg-blue-50/70 border border-blue-100 p-3 flex items-start gap-2">
                      <AlertCircle size={13} className="text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-blue-700">رد الإدارة</p>
                        <p className="text-[12px] text-blue-800/90 leading-snug">{s.adminNotes}</p>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 shrink-0">{formatDate(s.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <SuggestionModal onClose={() => { setShowModal(false); fetchData() }} />}
    </div>
  )
}

function SuggestionModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    productName: "",
    productUrl: "",
    description: "",
    reason: "",
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.productName.trim()) {
      toast("اسم المنتج مطلوب", "error")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast("تم إرسال الاقتراح، بانتظار مراجعة الإدارة", "success")
        onClose()
      } else {
        toast("حدث خطأ أثناء الإرسال", "error")
      }
    } catch {
      toast("حدث خطأ في الاتصال", "error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl animate-slideInUp" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #b45309, #f59e0b)" }}>
              <Lightbulb size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-[16px] font-extrabold text-slate-900">اقتراح منتج</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">سيراجعه فريق الإدارة ويخبرك بالنتيجة</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1.5">اسم المنتج *</label>
            <input
              type="text"
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              required
              className="input-premium w-full"
              placeholder="اسم المنتج"
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1.5">رابط المنتج (اختياري)</label>
            <input
              type="url"
              value={form.productUrl}
              onChange={(e) => setForm({ ...form, productUrl: e.target.value })}
              className="input-premium w-full"
              placeholder="https://..."
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1.5">الوصف</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="input-premium w-full resize-none"
              placeholder="وصف للمنتج..."
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1.5">لماذا هذا المنتج؟</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={2}
              className="input-premium w-full resize-none"
              placeholder="سبب الاقتراح..."
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            {submitting ? "جاري الإرسال..." : "إرسال الاقتراح"}
          </button>
        </form>
      </div>
    </div>
  )
}
