"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  ShoppingCart,
  PackageCheck,
  PackageX,
  Wallet,
  Coins,
  TrendingUp,
  Percent,
  Trophy,
  CalendarDays,
  Inbox,
  RefreshCw,
  BarChart3,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { formatCurrency, formatDate } from "@/lib/utils"
import { DashboardEmptyState, DashboardChartTip } from "@/components/DashboardPanel"

type Period = "today" | "week" | "month"

const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "اليوم" },
  { id: "week", label: "الأسبوع" },
  { id: "month", label: "الشهر" },
]

interface DayPoint {
  date: string
  orders: number
  sales: number
  commission: number
  label?: string
}

interface PerformanceData {
  period: string
  totals: {
    orders: number
    delivered: number
    cancelled: number
    sales: number
    commission: number
    estNetProfit: number
    deliveryRate: number
  }
  bestProduct: { productId: string; quantity: number; sales: number; nameAr: string; name: string; image: string | null } | null
  bestDay: DayPoint | null
  series: DayPoint[]
}

const compactNum = (v: number) => new Intl.NumberFormat("ar-EG", { notation: "compact" }).format(v)

const periodDate = (d: string) =>
  new Intl.DateTimeFormat("ar-EG", { weekday: "short", day: "numeric", month: "short" }).format(new Date(d + "T00:00:00"))

export default function PerformancePanel() {
  const [period, setPeriod] = useState<Period>("week")
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const mounted = useRef(true)

  const load = useCallback((p: Period) => {
    setLoading(true)
    setError(false)
    fetch(`/api/performance?period=${p}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error)
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    mounted.current = true
    load(period)
    return () => {
      mounted.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const series = (data?.series || []).map((d) => ({ ...d, label: periodDate(d.date) }))

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#2563eb12" }}>
            <BarChart3 size={14} style={{ color: "#2563eb" }} />
          </div>
          <h3 className="text-[13px] font-bold text-slate-800">لوحة أداء المسوق</h3>
        </div>
        <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all
                ${period === p.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-3 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
          </div>
          <div className="h-44 bg-slate-100 rounded-xl" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-3">
            <PackageX size={20} className="text-red-400" />
          </div>
          <p className="text-[13px] font-semibold text-slate-600 mb-3">تعذر تحميل الأداء</p>
          <button
            onClick={() => load(period)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-[12px] font-bold hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw size={13} /> إعادة المحاولة
          </button>
        </div>
      ) : !data || data.totals.orders === 0 ? (
        <div className="p-3">
          <DashboardEmptyState icon={Inbox} title="لا توجد طلبات في هذه الفترة" subtitle="أنشئ أول طلب من صفحة المنتجات وسيظهر أداؤك هنا" />
        </div>
      ) : (
        <div className="p-4 sm:p-5 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "إجمالي الطلبات", value: (data.totals.orders || 0).toLocaleString("ar-EG"), icon: ShoppingCart, tint: "#2563eb" },
              { label: "الطلبات المسلمة", value: (data.totals.delivered || 0).toLocaleString("ar-EG"), icon: PackageCheck, tint: "#059669" },
              { label: "الطلبات المرفوضة", value: (data.totals.cancelled || 0).toLocaleString("ar-EG"), icon: PackageX, tint: "#ef4444" },
              { label: "معدل التسليم", value: `${(data.totals.deliveryRate || 0).toFixed(0)}%`, icon: Percent, tint: "#0ea5e9" },
              { label: "إجمالي المبيعات", value: formatCurrency(data.totals.sales || 0), icon: Wallet, tint: "#7c3aed" },
              { label: "إجمالي العمولة", value: formatCurrency(data.totals.commission || 0), icon: Coins, tint: "#f59e0b" },
              { label: "صافي الربح التقديري", value: formatCurrency(data.totals.estNetProfit || 0), icon: TrendingUp, tint: "#0d9488" },
              { label: "أفضل يوم", value: data.bestDay ? `${data.bestDay.orders.toLocaleString("ar-EG")} طلب` : "—", icon: CalendarDays, tint: "#4f46e5", sub: data.bestDay ? formatDate(data.bestDay.date) : "" },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                  <k.icon size={11} style={{ color: k.tint }} />
                  {k.label}
                </p>
                <p className="text-[15px] sm:text-lg font-extrabold text-slate-900 tabular-nums mt-1 truncate">{k.value}</p>
                {k.sub && <p className="text-[10px] text-slate-400">{k.sub}</p>}
              </div>
            ))}
          </div>

          {/* Best product + daily chart */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-100 p-3.5">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-2.5">
                <Trophy size={12} className="text-amber-500" /> أفضل منتج
              </p>
              {data.bestProduct ? (
                <div className="flex items-center gap-2.5">
                  {data.bestProduct.image ? (
                    <img src={data.bestProduct.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center"><ShoppingCart size={15} className="text-slate-400" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{data.bestProduct.nameAr}</p>
                    <p className="text-[10px] text-slate-400">{data.bestProduct.quantity.toLocaleString("ar-EG")} قطعة · {formatCurrency(data.bestProduct.sales)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">لا يوجد بعد</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-100 p-3.5 md:col-span-2">
              <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 mb-2">
                <BarChart3 size={12} className="text-blue-500" /> الطلبات اليومية
              </p>
              {series.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-6 text-center">لا توجد بيانات لهذه الفترة</p>
              ) : (
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} minTickGap={14} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} tickFormatter={(v: number) => compactNum(v)} allowDecimals={false} />
                      <Tooltip content={<DashboardChartTip />} />
                      <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
