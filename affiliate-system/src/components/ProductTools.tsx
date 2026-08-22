"use client"
import { useState } from "react"
import { Calculator, Wand2, Sparkles, TrendingUp, Coins, PackageCheck, ArrowLeft, Info } from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { quickEstimate, productDeliveryRate, type ProductProfile } from "@/lib/profit"
import BottomSheet from "@/components/BottomSheet"
import ProfitCalculator from "@/components/ProfitCalculator"
import StrategyGenerator from "@/components/StrategyGenerator"
import ProductAdvisor from "@/components/ProductAdvisor"

export default function ProductTools({ product }: { product: ProductProfile }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"calc" | "strategy" | "advisor">("calc")

  const est = quickEstimate(product, product?.deliveryStats)
  const realRate = productDeliveryRate(product?.deliveryStats)
  const hasRealStats = (product?.deliveryStats?.totalOrders || 0) > 0

  return (
    <>
      {/* Tools panel */}
      <div className="rounded-2xl overflow-hidden border border-slate-100 bg-gradient-to-l from-blue-50 via-indigo-50/40 to-violet-50">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-200">
              <TrendingUp size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-slate-500">أدوات المسوق</p>
              <p className="text-[15px] font-extrabold text-slate-900 mt-0.5">
                {est.commission > 0 ? (
                  <>
                    🟢 ربح متوقع لكل 100 طلب:{" "}
                    <span className="text-emerald-600 tabular-nums">{formatCurrency(est.per100)}</span>
                  </>
                ) : (
                  "المنتج يحتاج تحديد عمولة أولاً"
                )}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
                <span className="inline-flex items-center gap-1"><Coins size={11} className="text-emerald-500" /> عمولتك {formatCurrency(est.commission)}</span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1"><PackageCheck size={11} className="text-blue-500" /> تسليم متوقع {realRate.toFixed(0)}%</span>
                {hasRealStats && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Info size={10} /> من أدائك الحقيقي</span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={() => { setTab("advisor"); setOpen(true) }}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-[13px] font-bold hover:from-amber-600 hover:to-orange-700 shadow-md shadow-amber-200/60 transition-all active:scale-[0.98]"
          >
            <Sparkles size={16} />
            ✨ حلّل المنتج
            <span className="text-[10px] font-semibold opacity-80">مستشار المسوق الذكي</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            <button
              onClick={() => { setTab("calc"); setOpen(true) }}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 text-white text-[13px] font-bold hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-200/60 transition-all active:scale-[0.98]"
            >
              <Calculator size={16} />
              احسب أرباحي
            </button>
            <button
              onClick={() => { setTab("strategy"); setOpen(true) }}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-l from-violet-600 to-purple-600 text-white text-[13px] font-bold hover:from-violet-700 hover:to-purple-700 shadow-md shadow-violet-200/60 transition-all active:scale-[0.98]"
            >
              <Wand2 size={16} />
              أنشئ خطة تسويق
            </button>
          </div>

          <Link
            href="/dashboard"
            className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            تابع أداء منتجاتك في لوحة التحكم
            <ArrowLeft size={12} />
          </Link>
        </div>
      </div>

      {/* Bottom sheet with tools */}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={tab === "calc" ? "حاسبة الأرباح الذكية" : tab === "strategy" ? "استراتيجية التسويق" : "مستشار المسوق الذكي"}
        icon={tab === "calc" ? Calculator : tab === "strategy" ? Wand2 : Sparkles}
        tint={tab === "calc" ? "#2563eb" : tab === "strategy" ? "#7c3aed" : "#d97706"}
        maxWidth="max-w-3xl"
      >
        {/* Tabs */}
        <div className="flex border-b border-slate-100 shrink-0 bg-white">
          {([
            { key: "calc", label: "حاسبة الأرباح", icon: Calculator },
            { key: "strategy", label: "خطة التسويق", icon: Wand2 },
            { key: "advisor", label: "المستشار الذكي", icon: Sparkles },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[13px] font-bold transition-colors border-b-2 -mb-px
                ${tab === t.key ? "text-blue-600 border-blue-600 bg-blue-50/40" : "text-slate-500 hover:text-slate-700 border-transparent hover:bg-slate-50"}`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "calc" ? (
          <ProfitCalculator product={product} />
        ) : tab === "strategy" ? (
          <StrategyGenerator product={product} />
        ) : (
          <ProductAdvisor product={product} />
        )}
      </BottomSheet>
    </>
  )
}
