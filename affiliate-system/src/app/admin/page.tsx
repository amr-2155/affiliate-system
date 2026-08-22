"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  Coins,
  Wallet,
  ShoppingCart,
  Zap,
  Users,
  PackageCheck,
  TrendingDown,
  Package,
  Bell,
  UserPlus,
  ClipboardList,
  AlertCircle,
  CalendarDays,
  ChartPie,
  Inbox,
  PackageOpen,
} from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts"
import { formatCurrency, formatDate, getStatusColor, getStatusText } from "@/lib/utils"
import { RequirePerms } from "@/components/admin/RequirePerms"

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  PROCESSING: "#6366f1",
  SHIPPED: "#a855f7",
  DELIVERED: "#10b981",
  CANCELLED: "#ef4444",
  RETURNED: "#f97316",
}

const NOTIF_COLORS: Record<string, string> = {
  INFO: "#3b82f6",
  SYSTEM: "#a855f7",
  ORDER: "#10b981",
  WITHDRAWAL: "#f59e0b",
  EARNINGS: "#8b5cf6",
  STOCK: "#ef4444",
  REWARD: "#eab308",
  AFFILIATE: "#f97316",
}

const PERIODS = [
  { key: "daily", label: "اليومي" },
  { key: "weekly", label: "الأسبوعي" },
  { key: "monthly", label: "الشهري" },
]

const QUICK_ACTIONS = [
  { href: "/admin/products", label: "إضافة منتج", icon: Package, tint: "#4f46e5" },
  { href: "/admin/orders", label: "إدارة الطلبات", icon: ShoppingCart, tint: "#2563eb" },
  { href: "/admin/notifications", label: "إرسال إشعارات", icon: Bell, tint: "#7c3aed" },
  { href: "/admin/withdrawals", label: "طلبات السحب", icon: Wallet, tint: "#d97706" },
]

const rankStyle = (i: number) =>
  i === 0 ? "linear-gradient(135deg, #f59e0b, #fbbf24)" : i === 1 ? "linear-gradient(135deg, #94a3b8, #cbd5e1)" : i === 2 ? "linear-gradient(135deg, #b45309, #d97706)" : "linear-gradient(135deg, #f1f5f9, #e2e8f0)"

const compactNum = (v: number) => new Intl.NumberFormat("ar-EG", { notation: "compact" }).format(v)

function timeAgo(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "الآن"
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} ساعة`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `منذ ${days} يوم`
  return formatDate(date)
}

function Panel({ title, icon: Icon, tint, action, children, className = "" }: {
  title: string
  icon: any
  tint: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${tint}12` }}>
            <Icon size={14} style={{ color: tint }} />
          </div>
          <h3 className="text-[13px] font-bold text-slate-800">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-2 sm:p-3">{children}</div>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, tint, growth }: {
  label: string
  value: string
  sub?: string
  icon: any
  tint: string
  growth?: number | null
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400">{label}</p>
          <p className="text-xl sm:text-[22px] font-extrabold mt-1 truncate tabular-nums text-slate-900">{value}</p>
          {growth !== undefined && growth !== null ? (
            <span className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold ${growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(growth).toFixed(1)}%
              <span className="text-slate-400 font-medium">عن السابق</span>
            </span>
          ) : sub ? (
            <p className="text-[11px] text-slate-400 mt-1.5">{sub}</p>
          ) : null}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-200" style={{ background: `${tint}12` }}>
          <Icon size={19} style={{ color: tint }} />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
        <Icon size={22} className="text-slate-300" />
      </div>
      <p className="text-[13px] font-semibold text-slate-600">{title}</p>
      {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const name = item.name || (item.payload?.status ? getStatusText(item.payload.status) : "") || label
  const isMoney = item.dataKey === "revenue" || item.payload?.status
  const value = isMoney && !item.payload?.status ? formatCurrency(item.value) : item.value
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-lg px-3 py-2 text-[12px]">
      <p className="font-bold text-slate-800 mb-0.5">{item.payload?.status ? getStatusText(item.payload.status) : name}</p>
      <p className="text-slate-500">
        {isMoney ? "الإيرادات" : "الكمية"}: <span className="font-bold text-slate-800 tabular-nums">{value}</span>
      </p>
    </div>
  )
}

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 p-4 animate-pulse ${className}`}>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-slate-100 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="w-20 h-2.5 bg-slate-100 rounded-lg" />
        <div className="w-32 h-4 bg-slate-100 rounded-lg" />
      </div>
    </div>
  </div>
)

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null)
  const [widgets, setWidgets] = useState<any>(null)
  const [perUser, setPerUser] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly")

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/dashboard").then(r => r.json()),
      fetch("/api/admin/dashboard/widgets").then(r => r.json()),
      fetch("/api/admin/affiliates/stats").then(r => r.json()),
    ]).then(([d, w, st]) => {
      setData(d)
      setWidgets(w)
      setPerUser(st?.perUser || {})
      setLoading(false)
    }).catch(() => { setError(true); setLoading(false) })
  }, [])

  const s = data?.stats

  const monthlyFormatted = useMemo(() => {
    const monthly: any[] = data?.monthlyData || []
    return monthly.map((d: any) => {
      const [y, m] = String(d.month).split("-")
      return { ...d, label: new Intl.DateTimeFormat("ar", { month: "short", year: "2-digit" }).format(new Date(+y, +m - 1, 1)) }
    })
  }, [data])

  const growth = useMemo(() => {
    const n = monthlyFormatted.length
    const curRev = n ? monthlyFormatted[n - 1].revenue : 0
    const prevRev = n > 1 ? monthlyFormatted[n - 2].revenue : 0
    const curOrd = n ? monthlyFormatted[n - 1].orders : 0
    const prevOrd = n > 1 ? monthlyFormatted[n - 2].orders : 0
    return {
      revenue: prevRev > 0 ? ((curRev - prevRev) / prevRev) * 100 : null,
      orders: prevOrd > 0 ? ((curOrd - prevOrd) / prevOrd) * 100 : null,
    }
  }, [monthlyFormatted])

  const chartData = period === "daily" ? (widgets?.dailyEarnings || []) : period === "weekly" ? (widgets?.weeklyEarnings || []) : monthlyFormatted
  const periodRevenue = chartData.reduce((sum: number, d: any) => sum + (d.revenue || 0), 0)
  const periodOrders = chartData.reduce((sum: number, d: any) => sum + (d.orders || 0), 0)

  const donut = useMemo(() => (widgets?.ordersByStatus || []).slice().sort((a: any, b: any) => b.count - a.count), [widgets])
  const totalOrdersStatus = donut.reduce((s2: number, r: any) => s2 + r.count, 0)

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-xl animate-pulse" />
          <div className="space-y-2">
            <div className="w-40 h-4 bg-slate-100 rounded-lg animate-pulse" />
            <div className="w-56 h-2.5 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-80 bg-white rounded-2xl border border-slate-100 animate-pulse" />
          <div className="h-80 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <div key={i} className="h-72 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (error || !s) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={30} className="text-red-400" />
        </div>
        <p className="text-slate-900 font-semibold mb-1">تعذر تحميل البيانات</p>
        <button onClick={() => { setLoading(true); setError(false); fetch("/api/admin/dashboard").then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => { setError(true); setLoading(false) }) }}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[13px] font-semibold hover:bg-indigo-700 transition-colors">
          إعادة المحاولة
        </button>
      </div>
    )
  }

  const todayLabel = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(new Date())
  const avgOrder = s.totalOrders > 0 ? s.totalRevenue / s.totalOrders : 0
  const monthShare = s.totalRevenue > 0 ? Math.round((s.monthRevenue / s.totalRevenue) * 100) : 0
  const topAffiliates = (data.topAffiliates || []).map((a: any) => ({ ...a, commissions: perUser[a.id]?.commissions || 0 }))

  return (
    <RequirePerms perm="dashboard.view">
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">لوحة التحكم</h1>
            <p className="text-[12px] text-slate-500">{todayLabel} — نظرة عامة على أداء النظام</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {QUICK_ACTIONS.map(a => (
          <Link key={a.href} href={a.href}
            className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-100 shadow-sm px-3.5 py-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ background: `${a.tint}12` }}>
              <a.icon size={16} style={{ color: a.tint }} />
            </div>
            <span className="text-[12px] font-bold text-slate-700">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي الإيرادات" value={formatCurrency(s.totalRevenue)} sub={`متوسط الطلب ${formatCurrency(avgOrder)}`} icon={DollarSign} tint="#2563eb" growth={growth.revenue} />
        <StatCard label="إيرادات الشهر" value={formatCurrency(s.monthRevenue)} sub={`${monthShare}% من إجمالي الإيرادات`} icon={TrendingUp} tint="#4f46e5" />
        <StatCard label="إجمالي العمولات" value={formatCurrency(s.totalCommission)} sub="من فرق سعر البيع" icon={Coins} tint="#7c3aed" />
        <StatCard label="طلبات السحب المعلقة" value={s.pendingWithdrawals.toLocaleString("ar-EG")} sub="بانتظار المراجعة" icon={Wallet} tint="#d97706" />
        <StatCard label="إجمالي الطلبات" value={s.totalOrders.toLocaleString("ar-EG")} sub={`${s.deliveredOrders} تم التوصيل · ${s.cancelledOrders} ملغي`} icon={ShoppingCart} tint="#0ea5e9" growth={growth.orders} />
        <StatCard label="طلبات اليوم" value={s.todayOrders.toLocaleString("ar-EG")} sub={`${s.monthOrders} طلب هذا الشهر`} icon={Zap} tint="#f97316" />
        <StatCard label="إجمالي المسوقين" value={s.totalAffiliates.toLocaleString("ar-EG")} sub={`${s.activeAffiliates} نشط`} icon={Users} tint="#059669" />
        <StatCard label="معدل التوصيل" value={`${s.deliveryRate}%`} sub={`معدل التأكيد ${s.confirmationRate}%`} icon={PackageCheck} tint="#0d9488" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel
          title="الأرباح والإيرادات"
          icon={CalendarDays}
          tint="#2563eb"
          className="lg:col-span-2"
          action={
            <div className="flex items-center bg-slate-50 rounded-lg p-0.5">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key as any)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${period === p.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
                  {p.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="flex items-center gap-2 px-3 pt-1 pb-3 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1">
              الإجمالي: <span className="text-slate-800 tabular-nums">{formatCurrency(periodRevenue)}</span>
            </span>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1">
              {periodOrders.toLocaleString("ar-EG")} طلب
            </span>
          </div>
          {chartData.length === 0 || periodRevenue === 0 ? (
            <EmptyState icon={PackageOpen} title="لا توجد بيانات لهذه الفترة" />
          ) : (
            <div className="h-60 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} minTickGap={18} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => compactNum(v)} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="الطلبات حسب الحالة" icon={ChartPie} tint="#7c3aed">
          {donut.length === 0 || totalOrdersStatus === 0 ? (
            <EmptyState icon={Inbox} title="لا توجد طلبات بعد" />
          ) : (
            <>
              <div className="relative h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={54} outerRadius={80} paddingAngle={2} strokeWidth={2} stroke="#fff">
                      {donut.map((r: any) => (
                        <Cell key={r.status} fill={STATUS_COLORS[r.status] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{totalOrdersStatus.toLocaleString("ar-EG")}</p>
                  <p className="text-[11px] text-slate-400">طلب</p>
                </div>
              </div>
              <div className="space-y-1.5 mt-2">
                {donut.map((r: any) => (
                  <div key={r.status} className="flex items-center gap-2 text-[12px] px-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[r.status] || "#94a3b8" }} />
                    <span className="text-slate-600 font-medium">{getStatusText(r.status)}</span>
                    <span className="text-slate-400 tabular-nums">{r.count.toLocaleString("ar-EG")}</span>
                    <span className="text-slate-400 tabular-nums mr-auto">{((r.count / totalOrdersStatus) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* Orders + Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel
          title="أحدث الطلبات"
          icon={ShoppingCart}
          tint="#2563eb"
          className="lg:col-span-2"
          action={<Link href="/admin/orders" className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">عرض الكل</Link>}
        >
          {!data.recentOrders?.length ? (
            <EmptyState icon={Inbox} title="لا توجد طلبات" subtitle="عند إنشاء أول طلب ستظهر تفاصيله هنا" />
          ) : (
            <div className="divide-y divide-slate-50">
              {data.recentOrders.slice(0, 6).map((o: any) => (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold font-mono text-slate-800" dir="ltr">{o.orderNumber}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getStatusColor(o.status)}`}>{getStatusText(o.status)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{o.customerName} · {o.affiliate?.name}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-[13px] font-bold text-slate-900 tabular-nums">{formatCurrency(o.total)}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(o.createdAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="أكثر المنتجات مبيعاً" icon={Package} tint="#0ea5e9">
          {!widgets?.topProducts?.length ? (
            <EmptyState icon={PackageOpen} title="لا توجد مبيعات بعد" />
          ) : (
            <div className="divide-y divide-slate-50">
              {widgets.topProducts.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold text-white shrink-0" style={{ background: rankStyle(i), color: i >= 3 ? "#64748b" : "#fff" }}>
                    {i + 1}
                  </span>
                  {p.image ? (
                    <img src={p.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Package size={15} className="text-slate-400" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{p.nameAr}</p>
                    <p className="text-[10px] text-slate-400">بيع {p.totalQty.toLocaleString("ar-EG")} قطعة</p>
                  </div>
                  <span className="text-[12px] font-bold text-slate-900 tabular-nums">{formatCurrency(p.totalRevenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* People + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel
          title="أفضل المسوقين"
          icon={ClipboardList}
          tint="#4f46e5"
          action={<Link href="/admin/affiliates" className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">عرض الكل</Link>}
        >
          {!topAffiliates.length ? (
            <EmptyState icon={UserPlus} title="لا يوجد مسوقين بعد" />
          ) : (
            <div className="divide-y divide-slate-50">
              {topAffiliates.map((a: any, i: number) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold text-white shrink-0" style={{ background: rankStyle(i), color: i >= 3 ? "#64748b" : "#fff" }}>
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
                    {(a.name || "؟").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{a.name}</p>
                    <p className="text-[10px] text-slate-400">{a._count.orders} طلب</p>
                  </div>
                  <span className="text-[12px] font-bold text-emerald-600 tabular-nums">{formatCurrency(a.commissions)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="أحدث المسوقين" icon={UserPlus} tint="#059669">
          {!widgets?.latestAffiliates?.length ? (
            <EmptyState icon={UserPlus} title="لا يوجد مسوقين بعد" />
          ) : (
            <div className="divide-y divide-slate-50">
              {widgets.latestAffiliates.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #059669, #34d399)" }}>
                    {(a.name || "؟").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{a.name}</p>
                    <p className="text-[10px] text-slate-400 truncate" dir="ltr">{a.email}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(a.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="إشعارات سريعة" icon={Bell} tint="#d97706">
          {!widgets?.recentNotifications?.length ? (
            <EmptyState icon={Inbox} title="لا توجد إشعارات" subtitle="إشعارات النظام ستظهر هنا" />
          ) : (
            <div className="divide-y divide-slate-50">
              {widgets.recentNotifications.map((n: any) => (
                <div key={n.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: NOTIF_COLORS[n.type] || "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{n.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{n.user?.name ? `${n.user.name} · ` : ""}{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
    </RequirePerms>
  )
}
