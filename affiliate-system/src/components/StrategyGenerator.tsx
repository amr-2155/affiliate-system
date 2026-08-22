"use client"
import { useRef, useState } from "react"
import { Wand2, Loader2, Save, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react"
import { generateStrategy, strategyToText, type GeneratedStrategy } from "@/lib/strategy"
import StrategyPlan from "@/components/StrategyPlan"
import CopyButton from "@/components/CopyButton"
import { useToast } from "@/components/Toast"
import type { ProductProfile } from "@/lib/profit"

export default function StrategyGenerator({ product }: { product: ProductProfile }) {
  const { toast } = useToast()
  const seedRef = useRef(0)
  const [plan, setPlan] = useState<GeneratedStrategy | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const generate = () => {
    setGenerating(true)
    setSaved(false)
    setSaveError(false)
    setTimeout(() => {
      setPlan(generateStrategy(product, seedRef.current++))
      setGenerating(false)
    }, 350)
  }

  const save = async () => {
    if (!plan) return
    setSaving(true)
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: plan.product.id,
          title: plan.title,
          scenario: "realistic",
          content: JSON.stringify(plan),
          productSnapshot: JSON.stringify(plan.product),
        }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) throw new Error(data?.error || "فشل الحفظ")
      setSaved(true)
      toast("تم حفظ الاستراتيجية", "success")
    } catch {
      setSaveError(true)
      toast("تعذر حفظ الاستراتيجية", "error")
    } finally {
      setSaving(false)
    }
  }

  if (!plan) {
    return (
      <div className="p-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-200">
          <Wand2 size={26} className="text-white" />
        </div>
        <h3 className="text-[15px] font-extrabold text-slate-900 mb-1">مساعد استراتيجية التسويق</h3>
        <p className="text-[12px] text-slate-500 leading-relaxed max-w-sm mx-auto mb-5">
          نبني لك خطة تسويق عملية كاملة من بيانات المنتج الحقيقية: الجمهور، الزوايا، الـ Hooks، أفكار المحتوى، اعتراضات العملاء، وخطة 7 أيام.
        </p>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-l from-violet-600 to-indigo-600 text-white text-[13px] font-bold hover:from-violet-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {generating ? "جاري بناء الخطة..." : "أنشئ استراتيجية"}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 sm:px-5 pt-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              <CheckCircle2 size={13} /> تم الحفظ
            </span>
          ) : saveError ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
              <AlertCircle size={13} /> فشل الحفظ
            </span>
          ) : (
            <span className="text-[11px] font-bold text-slate-400">خطة جديدة تم إنشاؤها من بيانات المنتج</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={generate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-slate-200 text-slate-600 text-[12px] font-bold hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
          >
            <RotateCcw size={13} />
            إنشاء خطة جديدة
          </button>
          <button
            onClick={save}
            disabled={saving || saved}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white text-[12px] font-bold hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "جاري الحفظ..." : "حفظ الاستراتيجية"}
          </button>
        </div>
      </div>
      <StrategyPlan strategy={plan} />
      <div className="px-4 sm:px-5 pb-4">
        <CopyButton text={strategyToText(plan)} label="نسخ الخطة كاملة كنص" className="bg-slate-50 text-slate-600 hover:bg-slate-100 w-full justify-center" />
      </div>
    </div>
  )
}
