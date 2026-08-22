"use client"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  LayoutDashboard,
  Wallet,
  Coins,
  TrendingUp,
  CalendarDays,
  DollarSign,
  ShoppingCart,
  Zap,
  Package,
  PlusCircle,
  Share2,
  ChartPie,
  Inbox,
  PackageOpen,
  Bell,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  PackageX,
  MessageCircle,
  Wand2,
  Calculator,
  FolderOpen,
  Heart,
  Store,
} from "lucide-react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import DashboardStatCard from "@/components/DashboardStatCard"
import { DashboardPanel, DashboardEmptyState, DashboardChartTip, DashboardSkeleton } from "@/components/DashboardPanel"
import IncentivesSection from "@/components/IncentivesSection"
import PerformancePanel from "@/components/PerformancePanel"
import { formatCurrency, formatDate, getStatusColor, getStatusText } from "@/lib/utils"
import { useToast } from "@/components/Toast"
import { notificationMeta, resolveNotificationHref } from "@/components/NotificationUI"
import { waLink } from "@/lib/orderUtils"

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  CONFIRMED: "#3b82f6",
  PROCESSING: "#6366f1",
  SHIPPED: "#a855f7",
  DELIVERED: "#10b981",
  CANCELLED: "#ef4444",
  RETURNED: "#f97316",
}

const QUICK_ACTIONS = [
  { href: "/products", label: "إنشاء طلب جديد", icon: PlusCircle, tint: "#2563eb" },
  { href: "/products", label: "المنتجات", icon: Package, tint: "#4f46e5" },
  { href: "/withdrawals", label: "طلبات السحب", icon: Wallet, tint: "#d97706" },
]

const TOOL_ACTIONS = [
  { href: "/products", label: "حاسبة الأرباح", icon: Calculator, tint: "#2563eb", desc: "اعرف هل المنتج مربح قبل الإعلان" },
  { href: "/strategies", label: "استراتيجياتي", icon: FolderOpen, tint: "#7c3aed", desc: "خططك التسويقية المحفوظة" },
  { href: "/products", label: "المنتجات التي أروج لها", icon: Package, tint: "#059669", desc: "تصفح وأضف طلبات جديدة" },
  { href: "/favorites", label: "المنتجات المفضلة", icon: Heart, tint: "#f43f5e", desc: "منتجاتك المفضلة للترويج" },
  { href: "/referrals", label: "أضف موردًا واربح", icon: Store, tint: "#d97706", desc: "رشّح موردًا واربح بونصًا لكل طلب" },
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

function growth(cur: number, prev: number): number | null {
  if (prev <= 0) return null
  return ((cur - prev) / prev) * 100
}

const FOLLOWUP_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"]

function orderProfit(o: any): number {
  if (!Array.isArray(o?.items)) return 0
  return o.items.reduce((sum: number, it: any) => {
    const sell = it.unitPrice || 0
    const cost = it.product?.minPrice ? it.product.price : (it.product?.affiliateCostPrice ?? null)
    if (cost === null) return sum
    return sum + Math.max(0, sell - cost) * (it.quantity || 1)
  }, 0)
}

export default function DashboardPage() {
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [widgets, setWidgets] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [followUp, setFollowUp] = useState<any[]>([])
  const [profitMap, setProfitMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/dashboard/widgets").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ])
      .then(([d, w, p]) => {
        if (d?.error) throw new Error(d.error)
        setData(d)
        setWidgets(w)
        setProfile(p)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetch("/api/orders?limit=50")
      .then((res) => res.json())
      .then((d) => {
        const orders = Array.isArray(d?.orders) ? d.orders : []
        setFollowUp(orders.filter((o: any) => FOLLOWUP_STATUSES.includes(o.status)))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch("/api/orders?limit=8")
      .then((res) => res.json())
      .then((d) => {
        const orders = Array.isArray(d?.orders) ? d.orders : []
        const map: Record<string, number> = {}
        for (const o of orders) map[o.id] = orderProfit(o)
        setProfitMap(map)
      })
      .catch(() => {})
  }, [])

  const shareStore = () => {
    const code = profile?.referralCode
    if (!code) return
    const link = `${window.location.origin}/register?ref=${code}`
    navigator.clipboard?.writeText(link).then(() => {
      toast("تم نسخ رابط المتجر", "success")
    }).catch(() => {})
  }

  const monthlyFormatted = useMemo(() => {
    const monthly: any[] = data?.monthlyData || []
    return monthly.map((d: any) => {
      const [y, m] = String(d.month).split("-")
      return { ...d, label: new Intl.DateTimeFormat("ar", { month: "short", year: "2-digit" }).format(new Date(+y, +m - 1, 1)) }
    })
  }, [data])

  const commissionFormatted = useMemo(() => {
    const items: any[] = widgets?.commissionMonthly || []
    return items.map((d: any) => {
      const [y, m] = String(d.month).split("-")
      return { ...d, label: new Intl.DateTimeFormat("ar", { month: "short", year: "2-digit" }).format(new Date(+y, +m - 1, 1)) }
    })
  }, [widgets])

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[1, 2, 3, 4].map((i) => <DashboardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <DashboardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 h-80 bg-white rounded-2xl border border-slate-100 animate-pulse" />
          <div className="h-80 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => <div key={i} className="h-72 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (error || !data?.stats) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={30} className="text-red-400" />
        </div>
        <p className="text-slate-900 font-semibold mb-1">تعذر تحميل البيانات</p>
        <button onClick={load}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[13px] font-semibold hover:bg-indigo-700 transition-colors">
          إعادة المحاولة
        </button>
      </div>
    )
  }

  const s = data.stats
  const cmp = widgets?.comparison || {}
  const topProducts = data.topProducts || []
  const recentOrders = data.recentOrders || []
  const ordersByStatus = (widgets?.ordersByStatus || []).slice().sort((a: any, b: any) => b.count - a.count)
  const totalOrdersStatus = ordersByStatus.reduce((sum: number, r: any) => sum + r.count, 0)
  const notifications = widgets?.recentNotifications || []

  const todayLabel = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())
  const firstName = profile?.name ? profile.name.split(" ")[0] : "مسوق"

  const totalRevenue = monthlyFormatted.reduce((sum: number, d: any) => sum + (d.revenue || 0), 0)
  const totalMonthlyOrders = monthlyFormatted.reduce((sum: number, d: any) => sum + (d.orders || 0), 0)
  const totalCommission = commissionFormatted.reduce((sum: number, d: any) => sum + (d.commission || 0), 0)

  const stats = [
    {
      label: "الرصيد المتاح للسحب",
      value: formatCurrency(widgets?.balance || 0),
      icon: Wallet,
      tint: "#059669",
      sub: widgets?.pendingWithdrawals ? `${widgets.pendingWithdrawals} طلب سحب معلق` : "متاح للسحب الآن",
      href: "/withdrawals",
    },
    {
      label: "إجمالي العمولات",
      value: formatCurrency(widgets?.totalCommissions || 0),
      icon: Coins,
      tint: "#7c3aed",
      sub: "كل العمولات المحققة",
    },
    {
      label: "أرباح الشهر",
      value: formatCurrency(cmp.monthEarnings || 0),
      icon: TrendingUp,
      tint: "#2563eb",
      growth: growth(cmp.monthEarnings || 0, cmp.lastMonthEarnings || 0),
    },
    {
      label: "أرباح الأسبوع",
      value: formatCurrency(cmp.weekEarnings || 0),
      icon: CalendarDays,
      tint: "#4f46e5",
      growth: growth(cmp.weekEarnings || 0, cmp.lastWeekEarnings || 0),
    },
    {
      label: "أرباح اليوم",
      value: formatCurrency(cmp.todayEarnings || 0),
      icon: DollarSign,
      tint: "#0d9488",
      growth: growth(cmp.todayEarnings || 0, cmp.yesterdayEarnings || 0),
    },
    {
      label: "طلبات الشهر",
      value: (cmp.monthOrders || 0).toLocaleString("ar-EG"),
      icon: ShoppingCart,
      tint: "#0ea5e9",
      growth: growth(cmp.monthOrders || 0, cmp.lastMonthOrders || 0),
    },
    {
      label: "طلبات الأسبوع",
      value: (cmp.weekOrders || 0).toLocaleString("ar-EG"),
      icon: CalendarDays,
      tint: "#6366f1",
      growth: growth(cmp.weekOrders || 0, cmp.lastWeekOrders || 0),
    },
    {
      label: "طلبات اليوم",
      value: (cmp.todayOrders || 0).toLocaleString("ar-EG"),
      icon: Zap,
      tint: "#f97316",
      growth: growth(cmp.todayOrders || 0, cmp.yesterdayOrders || 0),
    },
  ]

  const deliveryRate = Number(s.deliveryRate) || 0
  const confirmationRate = Number(s.confirmationRate) || 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
            <LayoutDashboard size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">مرحباً، {firstName}</h1>
            <p className="text-[12px] text-slate-500">{todayLabel} — نظرة عامة على أدائك</p>
          </div>
        </div>
        <button onClick={shareStore}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-bold shadow-sm hover:shadow-md transition-all">
          <Share2 size={15} />
          مشاركة رابط المتجر
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.label} href={a.href}
            className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-100 shadow-sm px-3.5 py-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ background: `${a.tint}12` }}>
              <a.icon size={16} style={{ color: a.tint }} />
            </div>
            <span className="text-[12px] font-bold text-slate-700">{a.label}</span>
          </Link>
        ))}
        <button onClick={shareStore}
          className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-100 shadow-sm px-3.5 py-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group text-right">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ background: "#05966912" }}>
            <Share2 size={16} style={{ color: "#059669" }} />
          </div>
          <span className="text-[12px] font-bold text-slate-700">مشاركة رابط المتجر</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((st) => (
          <DashboardStatCard key={st.label} {...st} />
        ))}
      </div>

      {/* Challenges & Rewards */}
      <IncentivesSection />

      {/* Performance + tools */}
      <PerformancePanel />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-extrabold text-slate-900 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Wand2 size={14} className="text-white" />
            </span>
            أدواتي التسويقية
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {TOOL_ACTIONS.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-100 shadow-sm px-3.5 py-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform" style={{ background: `${a.tint}12` }}>
                <a.icon size={16} style={{ color: a.tint }} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-slate-700 truncate">{a.label}</p>
                <p className="text-[10px] text-slate-400 truncate">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DashboardPanel
          title="الإيرادات الشهرية"
          icon={CalendarDays}
          tint="#2563eb"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1">
                الإجمالي: <span className="text-slate-800 tabular-nums">{formatCurrency(totalRevenue)}</span>
              </span>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1">
                {totalMonthlyOrders.toLocaleString("ar-EG")} طلب
              </span>
            </div>
          }
        >
          {monthlyFormatted.length === 0 || totalRevenue === 0 ? (
            <DashboardEmptyState icon={PackageOpen} title="لا توجد بيانات لهذه الفترة" />
          ) : (
            <div className="h-60 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyFormatted} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} minTickGap={18} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => compactNum(v)} />
                  <Tooltip content={<DashboardChartTip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel title="الطلبات الشهرية" icon={ShoppingCart} tint="#0ea5e9">
          {monthlyFormatted.length === 0 || totalMonthlyOrders === 0 ? (
            <DashboardEmptyState icon={Inbox} title="لا توجد طلبات بعد" />
          ) : (
            <div className="h-60 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyFormatted} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} minTickGap={18} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => compactNum(v)} />
                  <Tooltip content={<DashboardChartTip />} />
                  <Bar dataKey="orders" fill="#0ea5e9" radius={[5, 5, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="العمولات الشهرية"
          icon={Coins}
          tint="#7c3aed"
          className="lg:col-span-2"
          action={
            <span className="text-[11px] font-bold text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1">
              آخر 12 شهر: <span className="text-slate-800 tabular-nums">{formatCurrency(totalCommission)}</span>
            </span>
          }
        >
          {commissionFormatted.length === 0 || totalCommission === 0 ? (
            <DashboardEmptyState icon={Coins} title="لا توجد عمولات بعد" />
          ) : (
            <div className="h-60 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={commissionFormatted} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} minTickGap={18} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={46} tickFormatter={(v: number) => compactNum(v)} />
                  <Tooltip content={<DashboardChartTip />} />
                  <Line type="monotone" dataKey="commission" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3, fill: "#7c3aed", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel title="الطلبات حسب الحالة" icon={ChartPie} tint="#f97316">
          {ordersByStatus.length === 0 || totalOrdersStatus === 0 ? (
            <DashboardEmptyState icon={Inbox} title="لا توجد طلبات بعد" />
          ) : (
            <>
              <div className="relative h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ordersByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={54} outerRadius={80} paddingAngle={2} strokeWidth={2} stroke="#fff">
                      {ordersByStatus.map((r: any) => (
                        <Cell key={r.status} fill={STATUS_COLORS[r.status] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip content={<DashboardChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{totalOrdersStatus.toLocaleString("ar-EG")}</p>
                  <p className="text-[11px] text-slate-400">طلب</p>
                </div>
              </div>
              <div className="space-y-1.5 mt-2">
                {ordersByStatus.map((r: any) => (
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
        </DashboardPanel>
      </div>

      {/* Recent orders + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DashboardPanel
          title="أحدث الطلبات"
          icon={ShoppingCart}
          tint="#2563eb"
          className="lg:col-span-2"
          action={<Link href="/orders" className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">عرض الكل</Link>}
        >
          {recentOrders.length === 0 ? (
            <DashboardEmptyState icon={Inbox} title="لا توجد طلبات" subtitle="عند إنشاء أول طلب ستظهر تفاصيله هنا" />
          ) : (
            <div className="divide-y divide-slate-50">
              {recentOrders.slice(0, 6).map((o: any) => {
                const profit = profitMap[o.id]
                return (
                  <div key={o.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold font-mono text-slate-800" dir="ltr">{o.orderNumber}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getStatusColor(o.status)}`}>{getStatusText(o.status)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{o.customerName} · {formatDate(o.createdAt)}</p>
                      {profit !== undefined && profit > 0 && (
                        <p className="text-[10px] font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
                          <Coins size={10} /> ربحك {formatCurrency(profit)}
                        </p>
                      )}
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-[13px] font-bold text-slate-900 tabular-nums">{formatCurrency(o.total)}</p>
                      <p className="text-[10px] text-slate-400">{o.items?.length ? `${o.items.length} منتج` : ""}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel title="أكثر المنتجات مبيعاً" icon={Package} tint="#0ea5e9">
          {topProducts.length === 0 ? (
            <DashboardEmptyState icon={PackageOpen} title="لا توجد مبيعات بعد" />
          ) : (
            <div className="divide-y divide-slate-50">
              {topProducts.map((p: any, i: number) => (
                <div key={p.productId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold text-white shrink-0" style={{ background: rankStyle(i), color: i >= 3 ? "#64748b" : "#fff" }}>
                    {i + 1}
                  </span>
                  {p.product?.image ? (
                    <img src={p.product.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Package size={15} className="text-slate-400" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-800 truncate">{p.product?.nameAr || "منتج"}</p>
                    <p className="text-[10px] text-slate-400">بيع {p._sum?.quantity?.toLocaleString("ar-EG") || 0} قطعة</p>
                  </div>
                  <span className="text-[12px] font-bold text-slate-900 tabular-nums">{formatCurrency(p._sum?.total || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>

      {/* Follow-up orders */}
      {followUp.length > 0 && (
        <DashboardPanel
          title="طلبات تحتاج متابعة"
          icon={Zap}
          tint="#f97316"
          action={<Link href="/orders" className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">عرض الكل</Link>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {followUp.slice(0, 6).map((o: any) => (
              <div key={o.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-sm hover:border-orange-200 transition-all">
                <Link href={`/orders?view=${o.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold font-mono text-slate-800" dir="ltr">{o.orderNumber}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getStatusColor(o.status)}`}>{getStatusText(o.status)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">{o.customerName} · {o.customerCity} · {timeAgo(o.createdAt)}</p>
                </Link>
                <div className="text-left shrink-0 flex flex-col items-end gap-1.5">
                  <span className="text-[12px] font-bold text-slate-900 tabular-nums">{formatCurrency(o.total)}</span>
                  <a
                    href={waLink(o.customerPhone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white bg-gradient-to-l from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-sm transition-all"
                  >
                    <MessageCircle size={11} /> متابعة
                  </a>
                </div>
              </div>
            ))}
          </div>
        </DashboardPanel>
      )}

      {/* Notifications + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DashboardPanel
          title="آخر الإشعارات"
          icon={Bell}
          tint="#d97706"
          className="lg:col-span-2"
          action={<Link href="/notifications" className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">عرض الكل</Link>}
        >
          {notifications.length === 0 ? (
            <DashboardEmptyState icon={Inbox} title="لا توجد إشعارات" subtitle="إشعارات النظام ستظهر هنا" />
          ) : (
            <div className="divide-y divide-slate-50">
              {notifications.map((n: any) => {
                const meta = notificationMeta(n.type)
                const href = resolveNotificationHref(n)
                const content = (
                  <>
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${meta.iconBg} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                      <meta.icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-bold text-slate-800 truncate">{n.title}</p>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.accent }} />}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                    </div>
                  </>
                )
                const cls = "flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors"
                if (href) {
                  return (
                    <Link
                      key={n.id}
                      href={href}
                      onClick={() => {
                        if (!n.read) {
                          fetch("/api/notifications", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ids: [n.id] }),
                          }).catch(() => {})
                        }
                      }}
                      className={`${cls} hover:bg-slate-50`}
                    >
                      {content}
                    </Link>
                  )
                }
                return (
                  <div key={n.id} className={cls}>
                    {content}
                  </div>
                )
              })}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel title="مؤشرات الأداء" icon={CheckCircle2} tint="#059669">
          {s.totalOrders === 0 ? (
            <DashboardEmptyState icon={PackageX} title="لا توجد بيانات بعد" subtitle="ستظهر معدلات أدائك عند أول طلب" />
          ) : (
            <div className="px-2 py-1 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-slate-600 flex items-center gap-1.5">
                    <PackageCheck size={13} className="text-emerald-500" />
                    نسبة التوصيل
                  </span>
                  <span className="text-[12px] font-extrabold text-slate-900 tabular-nums">{deliveryRate.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(deliveryRate, 100)}%`, background: "linear-gradient(90deg, #059669, #34d399)" }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{s.deliveredOrders.toLocaleString("ar-EG")} طلب تم توصيله من {s.totalOrders.toLocaleString("ar-EG")}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-slate-600 flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-blue-500" />
                    نسبة التأكيد
                  </span>
                  <span className="text-[12px] font-extrabold text-slate-900 tabular-nums">{confirmationRate.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(confirmationRate, 100)}%`, background: "linear-gradient(90deg, #2563eb, #60a5fa)" }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{s.cancelledOrders.toLocaleString("ar-EG")} طلب ملغي من {s.totalOrders.toLocaleString("ar-EG")}</p>
              </div>
            </div>
          )}
        </DashboardPanel>
      </div>
    </div>
  )
}
