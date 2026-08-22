"use client"
import { useMemo, useState } from "react"
import { Wallet, Package, Percent, BarChart3, Target, TrendingDown, Coins, Info, Calculator, BadgePercent } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import {
  calculateProfit,
  applyScenario,
  SCENARIOS,
  productMoney,
  productDeliveryRate,
  type ScenarioId,
  type ProfitInputs,
  type ProductProfile,
} from "@/lib/profit"

function num(value: number): string {
  return value.toLocaleString("ar-EG", { maximumFractionDigits: 0 })
}

const fmtPct = (v: number) => `${v.toFixed(1)}%`

export default function ProfitCalculator({ product }: { product: ProductProfile }) {
  const money = productMoney(product)
  const realRate = productDeliveryRate(product?.deliveryStats)
  const hasRealStats = (product?.deliveryStats?.totalOrders || 0) > 0

  const [salePrice, setSalePrice] = useState(money.displayPrice || 0)
  const [commission, setCommission] = useState(money.unitCommission || 0)
  const [orders, setOrders] = useState(100)
  const [deliveryRate, setDeliveryRate] = useState(realRate)
  const [adCost, setAdCost] = useState(0)
  const [extraCosts, setExtraCosts] = useState(0)
  const [scenario, setScenario] = useState<ScenarioId | "custom">("realistic")

  const results = useMemo(() => {
    const inputs: ProfitInputs = { salePrice, commission, adCost, orders, deliveryRate, extraCosts }
    if (scenario === "custom") return calculateProfit(inputs)
    return calculateProfit(applyScenario(inputs, scenario))
  }, [salePrice, commission, adCost, orders, deliveryRate, extraCosts, scenario])

  const missing = commission <= 0
  const statusColor =
    results.status === "profit"
      ? "from-emerald-500 to-teal-600"
      : results.status === "loss"
        ? "from-red-500 to-rose-600"
        : "from-amber-500 to-orange-500"

  const inputs: { label: string; value: number; setter: (v: number) => void; hint?: string; prefix?: string; suffix?: string }[] = [
    { label: "سعر البيع", value: salePrice, setter: setSalePrice, prefix: "ج.م" },
    { label: "عمولة الوحدة", value: commission, setter: setCommission, prefix: "ج.م", hint: "عمولتك الحقيقية من النظام" },
    { label: "عدد الطلبات", value: orders, setter: setOrders },
    { label: "نسبة التسليم %", value: deliveryRate, setter: setDeliveryRate, suffix: "%", hint: hasRealStats ? `من أدائك الحقيقي (${(product.deliveryStats?.deliveredOrders || 0) + (product.deliveryStats?.collectedOrders || 0)} من ${product.deliveryStats?.totalOrders || 0} طلب)` : "لا توجد بيانات كافية — استخدم التقدير الافتراضي" },
    { label: "تكلفة الإعلانات", value: adCost, setter: setAdCost, prefix: "ج.م" },
    { label: "مصروفات إضافية", value: extraCosts, setter: setExtraCosts, prefix: "ج.م" },
  ]

  const changeScenario = (s: ScenarioId | "custom") => setScenario(s)

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Product header */}
      <div className="flex items-center gap-3">
        {product?.image ? (
          <img src={product.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-100" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Package size={20} className="text-slate-400" /></div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-slate-900 truncate">{product?.nameAr}</p>
          <p className="text-[11px] text-slate-500">
            عمولة الوحدة: <span className="font-bold text-emerald-600 tabular-nums">{formatCurrency(commission)}</span>
            {money.commissionRate ? ` · نسبة ${money.commissionRate}%` : ""}
          </p>
        </div>
      </div>

      {/* Missing data warning */}
      {missing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex gap-2.5">
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[12px] text-amber-800 leading-relaxed">
            <p className="font-bold">بيانات غير مكتملة</p>
            <p>هذا المنتج لا يحتوي على عمولة محددة حالياً. أدخل عمولة الوحدة يدوياً حتى تصح الحسابات.</p>
          </div>
        </div>
      )}

      {/* Scenarios */}
      <div>
        <p className="text-[12px] font-bold text-slate-600 mb-2">سيناريوهات جاهزة للمقارنة</p>
        <div className="flex gap-2 flex-wrap">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => changeScenario(s.id)}
              className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all border-2
                ${scenario === s.id ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm" : "border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50"}`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
          <button
            onClick={() => changeScenario("custom")}
            className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all border-2
              ${scenario === "custom" ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm" : "border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-50"}`}
          >
            ✏️ مخصص
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        {inputs.map((f) => (
          <label key={f.label} className="block">
            <span className="text-[11px] font-bold text-slate-500 block mb-1.5">{f.label}</span>
            <div className="relative">
              <input
                type="number"
                min={0}
                value={Number.isFinite(f.value) ? f.value : 0}
                onChange={(e) => {
                  setScenario("custom")
                  f.setter(parseFloat(e.target.value) || 0)
                }}
                className="input-premium text-[13px] font-bold tabular-nums py-2.5 pr-3 pl-10"
                dir="ltr"
                style={{ textAlign: "right" }}
              />
              {f.prefix && (
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{f.prefix}</span>
              )}
            </div>
            {f.hint && <span className="text-[10px] text-slate-400 block mt-1 leading-snug">{f.hint}</span>}
          </label>
        ))}
      </div>

      {/* Hero results */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className={`col-span-2 sm:col-span-3 rounded-2xl bg-gradient-to-l ${statusColor} text-white p-4 flex items-center gap-3 shadow-lg`}>
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Wallet size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-white/85">صافي الربح المتوقع</p>
            <p className="text-2xl font-extrabold tabular-nums leading-tight truncate">{formatCurrency(results.netProfit)}</p>
            <p className="text-[10px] text-white/80 mt-0.5">
              {results.status === "profit" ? "المنتج يستحق الاستثمار في الإعلانات 🟢" : results.status === "loss" ? "ينصح بمراجعة التكاليف قبل الإطلاق 🔴" : "أنت على حافة التعادل 🟡"}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Package size={11} /> طلبات متوقعة</p>
          <p className="text-lg font-extrabold text-slate-900 tabular-nums mt-1">{num(results.expectedDelivered)}</p>
          <p className="text-[10px] text-slate-400">من {num(orders)} طلب</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Percent size={11} /> هامش الربح</p>
          <p className="text-lg font-extrabold text-slate-900 tabular-nums mt-1">{fmtPct(results.margin)}</p>
          <p className="text-[10px] text-slate-400">من المبيعات</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
          <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><BarChart3 size={11} /> ROAS</p>
          <p className="text-lg font-extrabold text-slate-900 tabular-nums mt-1">{adCost > 0 ? `${results.roas.toFixed(2)}×` : "—"}</p>
          <p className="text-[10px] text-slate-400">مقابل كل 1 ج.م إعلان</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Target size={11} /> نقطة التعادل</p>
            <p className="text-lg font-extrabold text-slate-900 tabular-nums mt-1">
              {Number.isFinite(results.breakEvenOrders) ? `${num(results.breakEvenOrders)} طلب` : "—"}
            </p>
          </div>
          <div className="text-left">
            <p className="text-[10px] text-slate-400">أو معدل تسليم</p>
            <p className="text-[13px] font-extrabold text-slate-800 tabular-nums">{Number.isFinite(results.breakEvenDeliveryRate) ? fmtPct(results.breakEvenDeliveryRate) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="rounded-2xl border border-slate-100 overflow-hidden">
        {[
          { label: "إجمالي المبيعات (المسلّمة)", value: formatCurrency(results.totalSales), icon: BadgePercent },
          { label: "إجمالي العمولة", value: formatCurrency(results.totalCommission), icon: Coins, positive: true },
          { label: "تكلفة الإعلانات", value: `− ${formatCurrency(results.adCost)}`, icon: TrendingDown },
          { label: "مصروفات إضافية", value: `− ${formatCurrency(results.extraCosts)}`, icon: Info },
          { label: "الربح لكل طلب مُسلّم", value: formatCurrency(results.profitPerOrder), icon: Wallet },
          { label: "تكلفة اكتساب الطلب CPA", value: adCost > 0 ? formatCurrency(results.cpa) : "—", icon: Target },
        ].map((row, i) => (
          <div key={row.label} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
            <span className="text-[12px] font-semibold text-slate-500 flex items-center gap-2">
              <row.icon size={13} className={row.positive ? "text-emerald-500" : "text-slate-400"} />
              {row.label}
            </span>
            <span className="text-[13px] font-extrabold text-slate-800 tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-400 flex items-center gap-1.5 leading-relaxed">
        <Calculator size={11} className="shrink-0" />
        الحسابات تتحدث فورياً أثناء الكتابة، وكلها مبنية على بيانات المنتج الحقيقية من النظام.
      </p>
    </div>
  )
}
