"use client"
import { useCallback, useEffect, useState } from "react"
import {
  Sparkles,
  RefreshCw,
  Users,
  Target,
  Lightbulb,
  Video,
  Megaphone,
  FileText,
  MousePointerClick,
  HelpCircle,
  ShoppingBag,
  PackageCheck,
  Boxes,
  UserCheck,
  BadgeCheck,
  Coins,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import type { ProductAnalysis } from "@/lib/analysis"
import type { ProductProfile } from "@/lib/profit"
import CopyButton from "@/components/CopyButton"

interface AdvisorResponse {
  product: {
    id: string
    nameAr: string
    name: string
    price: number
    commission: number
    stock: number
    image: string | null
    categoryNameAr: string
  }
  stats: {
    totalOrders: number
    deliveredOrders: number
    collectedOrders: number
    cancelledOrders: number
    deliveryRate: number | null
  }
  affiliate: { totalOrders: number; deliveryRate: number | null }
  analysis: ProductAnalysis
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 40
  const c = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-extrabold tabular-nums leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] font-bold text-slate-400 mt-0.5">من 100</span>
      </div>
    </div>
  )
}

function StatChip({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0" style={{ color }}>
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 font-bold">{label}</p>
        <p className="text-[13px] font-extrabold text-slate-800 tabular-nums leading-tight truncate">{value}</p>
      </div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  color = "#2563eb",
  children,
}: {
  icon: React.ComponentType<{ size?: number }>
  title: string
  color?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4">
      <h3 className="flex items-center gap-2 text-[13px] font-extrabold text-slate-800 mb-3">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}14`, color }}>
          <Icon size={13} />
        </span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function LineItem({
  text,
  onCopy,
  copyLabel,
}: {
  text: string
  onCopy?: string
  copyLabel?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
      <p className="text-[12.5px] text-slate-700 font-medium leading-relaxed flex-1">{text}</p>
      {onCopy && <CopyButton text={onCopy} label={copyLabel} className="shrink-0" />}
    </div>
  )
}

export default function ProductAdvisor({ product }: { product: ProductProfile }) {
  const [data, setData] = useState<AdvisorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/products/${product.id}/analysis`)
      .then((r) => r.json())
      .then((d: AdvisorResponse & { error?: string }) => {
        if (d?.error) throw new Error(d.error)
        setData(d)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [product.id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="p-5 space-y-3">
        <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <Sparkles size={22} className="text-red-400" />
        </div>
        <p className="text-[13px] font-bold text-slate-700">تعذّر تحليل المنتج</p>
        <p className="text-[11.5px] text-slate-400">حدث خطأ أثناء جلب البيانات، حاول مرة أخرى.</p>
        <button
          onClick={load}
          className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 text-white text-[12px] font-bold hover:from-blue-700 hover:to-indigo-700 transition-all"
        >
          <RefreshCw size={14} />
          إعادة المحاولة
        </button>
      </div>
    )
  }

  if (!data) return null

  const { product: p, stats, affiliate, analysis } = data
  const name = p.nameAr || p.name
  const rec = analysis.recommendation
  const profit = analysis.expectedProfit

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-l from-slate-50 to-white border border-slate-200/70 p-4">
        <div className="flex items-center gap-4">
          <ScoreRing score={analysis.score} color={analysis.level.color} />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold text-slate-900 leading-snug">{name}</p>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {p.categoryNameAr || "بدون فئة"}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700">
                <Coins size={11} /> {formatCurrency(p.price)}
              </span>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                عمولة {formatCurrency(p.commission)}/طلب
              </span>
              <span
                className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-1 rounded-lg"
                style={{ background: `${analysis.stock.color}14`, color: analysis.stock.color }}
              >
                <Boxes size={11} /> {analysis.stock.label}
              </span>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="mt-4 rounded-xl px-4 py-3" style={{ background: `${rec.color}12`, border: `1px solid ${rec.color}30` }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[13px] font-extrabold" style={{ color: rec.color }}>
              <BadgeCheck size={15} />
              {rec.label}
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              قوة المنتج: <span style={{ color: analysis.level.color }}>{analysis.level.label}</span>
            </span>
          </div>
          <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{rec.reason}</p>
        </div>
      </div>

      {/* Real data strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatChip icon={ShoppingBag} label="طلبات المنتج" value={String(stats.totalOrders)} color="#2563eb" />
        <StatChip
          icon={PackageCheck}
          label="نسبة التسليم"
          value={stats.deliveryRate != null ? `${Math.round(stats.deliveryRate)}%` : "لا توجد طلبات"}
          color="#059669"
        />
        <StatChip icon={Boxes} label="المخزون" value={String(p.stock)} color="#d97706" />
        <StatChip
          icon={UserCheck}
          label="طلباتك"
          value={
            affiliate.totalOrders > 0
              ? `${affiliate.totalOrders} · تسليم ${affiliate.deliveryRate != null ? Math.round(affiliate.deliveryRate) + "%" : "—"}`
              : "مسوق جديد"
          }
          color="#7c3aed"
        />
      </div>

      {/* Expected profit */}
      <Section icon={Coins} title="الربح المتوقع" color="#059669">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
            <p className="text-[10.5px] font-bold text-emerald-700">لكل 100 طلب</p>
            <p className="text-[13px] font-extrabold text-emerald-700 mt-1 tabular-nums">
              {profit.deliveredPer100} طلب مسلّم
            </p>
            <p className="text-[12px] font-extrabold text-emerald-700 tabular-nums">
              صافي ≈ {formatCurrency(profit.netPer100)}
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
            <p className="text-[10.5px] font-bold text-blue-700">أقصى تكلفة اكتساب</p>
            <p className="text-[16px] font-extrabold text-blue-700 mt-1 tabular-nums">
              {formatCurrency(profit.cpaTarget)}
              <span className="text-[10px] font-bold text-blue-500"> / طلب</span>
            </p>
          </div>
        </div>
        {!profit.hasRealStats && (
          <p className="text-[10.5px] text-slate-400 mt-2">
            * لا توجد طلبات حقيقية بعد، استُخدم معدل تسليم افتراضي ({Math.round(profit.deliveryRate)}%) للتقدير.
          </p>
        )}
      </Section>

      {/* Audience */}
      <Section icon={Users} title="الجمهور المستهدف" color="#2563eb">
        <ul className="space-y-1.5">
          {analysis.audience.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-600 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-[7px] shrink-0" />
              {a}
            </li>
          ))}
        </ul>
      </Section>

      {/* Problem + angle */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Section icon={Lightbulb} title="المشكلة الرئيسية" color="#d97706">
          <p className="text-[12.5px] text-slate-600 leading-relaxed">{analysis.mainProblem}</p>
        </Section>
        <Section icon={Target} title="أفضل زاوية تسويقية" color="#7c3aed">
          <p className="text-[12.5px] text-slate-600 leading-relaxed">{analysis.bestAngle}</p>
        </Section>
      </div>

      {/* Videos */}
      <Section icon={Video} title="3 أفكار فيديو" color="#dc2626">
        <div className="space-y-2">
          {analysis.videos.map((v, i) => (
            <LineItem key={i} text={v} onCopy={v} />
          ))}
        </div>
      </Section>

      {/* Hooks */}
      <Section icon={Megaphone} title="3 افتتاحيات إعلانية" color="#db2777">
        <div className="space-y-2">
          {analysis.hooks.map((h, i) => (
            <LineItem key={i} text={h} onCopy={h} />
          ))}
        </div>
      </Section>

      {/* Ready ad + CTA */}
      <Section icon={FileText} title="إعلان جاهز" color="#2563eb">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
          <p className="text-[12.5px] text-slate-700 leading-relaxed">{analysis.adCopy}</p>
          <div className="flex justify-end mt-2">
            <CopyButton text={analysis.adCopy} label="نسخ الإعلان" />
          </div>
        </div>
      </Section>

      <Section icon={MousePointerClick} title="عبارة الحث على الشراء" color="#059669">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3.5">
          <p className="text-[12.5px] text-slate-700 leading-relaxed">{analysis.cta}</p>
          <div className="flex justify-end mt-2">
            <CopyButton text={analysis.cta} label="نسخ" />
          </div>
        </div>
      </Section>

      {/* Objections */}
      <Section icon={HelpCircle} title="الاعتراضات الأكثر توقعًا" color="#7c3aed">
        <div className="space-y-2">
          {analysis.objections.map((o, i) => (
            <div key={i} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-[12.5px] font-bold text-slate-800">💬 {o.question}</p>
              <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">{o.answer}</p>
            </div>
          ))}
        </div>
      </Section>

      <p className="text-[10px] text-slate-400 leading-relaxed text-center px-2">
        التحليل مبني على بيانات النظام الحقيقية: السعر، العمولة، المخزون، الطلبات، نسبة التسليم، وأداء المسوق.
      </p>
    </div>
  )
}
