"use client"
import { useEffect, useState, useMemo } from "react"
import {
  Wallet, Plus, Loader2, X, Coins, TrendingUp, Clock,
  Landmark, Smartphone, Zap, Info, CheckCircle2, XCircle, CalendarDays, Eye,
  ArrowUpRight, ChevronDown, FileText,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import DashboardStatCard from "@/components/DashboardStatCard"
import { useToast } from "@/components/Toast"
import Lightbox from "@/components/Lightbox"

interface Withdrawal {
  id: string
  amount: number
  status: string
  method: string
  accountName?: string
  accountNumber?: string
  bankName?: string
  notes?: string
  proofImage?: string
  createdAt: string
  processedAt?: string
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
  APPROVED: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/70",
  REJECTED: "bg-red-50 text-red-700 ring-1 ring-red-200/70",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
}

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-amber-500",
  APPROVED: "bg-blue-500",
  REJECTED: "bg-red-500",
  COMPLETED: "bg-emerald-500",
}

const STATUS_DESC: Record<string, string> = {
  PENDING: "قيد مراجعة الإدارة",
  APPROVED: "تمت الموافقة بانتظار التحويل",
  REJECTED: "تم رفض الطلب",
  COMPLETED: "تم تحويل المبلغ بنجاح",
}

const METHOD_INFO: Record<string, { label: string; icon: any; tint: string }> = {
  BANK_TRANSFER: { label: "تحويل بنكي", icon: Landmark, tint: "#2563eb" },
  VODAFONE_CASH: { label: "فودافون كاش", icon: Smartphone, tint: "#dc2626" },
  INSTAPAY: { label: "إنستاباي", icon: Zap, tint: "#7c3aed" },
  OTHER: { label: "أخرى", icon: Wallet, tint: "#64748b" },
}

const statusOptions = ["", "PENDING", "APPROVED", "REJECTED", "COMPLETED"]
const dateOptions = [
  { key: "", label: "كل الفترات" },
  { key: "7", label: "آخر 7 أيام" },
  { key: "30", label: "آخر 30 يوم" },
  { key: "month", label: "هذا الشهر" },
]

const refNo = (id: string) => `WDR-${id.slice(-6).toUpperCase()}`

export default function WithdrawalsPage() {
  const { toast } = useToast()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [minAmount, setMinAmount] = useState(100)
  const [statusFilter, setStatusFilter] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [highlighted, setHighlighted] = useState<string | null>(null)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      fetch("/api/withdrawals").then((res) => res.json()),
      fetch("/api/profile").then((res) => res.json()),
      fetch("/api/settings").then((res) => res.json()),
    ])
      .then(([wData, pData, sData]) => {
        setWithdrawals(Array.isArray(wData) ? wData : [])
        setProfile(pData)
        const min = parseFloat(sData?.["users-affiliate-withdrawal-min"])
        setMinAmount(Number.isFinite(min) && min > 0 ? min : 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    const hid = new URLSearchParams(window.location.search).get("highlight")
    if (hid) {
      setHighlighted(hid)
      setStatusFilter("")
      setDateFilter("")
      window.history.replaceState(null, "", "/withdrawals")
    }
  }, [])

  useEffect(() => {
    if (!highlighted || loading) return
    const scrollT = setTimeout(() => {
      const desktop = document.getElementById(`wdr-desktop-${highlighted}`)
      const mobile = document.getElementById(`wdr-mobile-${highlighted}`)
      const el = [desktop, mobile].find((x) => x && x.offsetParent !== null)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 300)
    const clearT = setTimeout(() => setHighlighted(null), 4000)
    return () => { clearTimeout(scrollT); clearTimeout(clearT) }
  }, [highlighted, loading])

  const balance = profile?.balance || 0
  const totalEarnings = profile?.totalEarnings || 0
  const totalWithdrawn = useMemo(
    () => withdrawals.filter((w) => w.status === "COMPLETED").reduce((s, w) => s + w.amount, 0),
    [withdrawals],
  )
  const pendingCount = withdrawals.filter((w) => w.status === "PENDING").length

  const filtered = useMemo(() => {
    const now = Date.now()
    return withdrawals.filter((w) => {
      if (statusFilter && w.status !== statusFilter) return false
      if (dateFilter) {
        const t = new Date(w.createdAt).getTime()
        if (dateFilter === "7" && now - t > 7 * 86400000) return false
        if (dateFilter === "30" && now - t > 30 * 86400000) return false
        if (dateFilter === "month") {
          const d = new Date(w.createdAt)
          const cur = new Date()
          if (d.getMonth() !== cur.getMonth() || d.getFullYear() !== cur.getFullYear()) return false
        }
      }
      return true
    })
  }, [withdrawals, statusFilter, dateFilter])

  const canWithdraw = minAmount > 0 ? balance >= minAmount : balance > 0

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: "linear-gradient(135deg, #1e3a8a, #4f46e5)" }}>
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">طلبات السحب</h1>
            <p className="text-[12px] sm:text-sm text-slate-500 mt-0.5">تابع رصيدك وطلبات السحب الخاصة بك بسهولة</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!canWithdraw}
          className="group flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-[0.97] transition-all disabled:opacity-50 disabled:shadow-none"
          style={{ background: "linear-gradient(135deg, #1e3a8a, #4f46e5)" }}
        >
          <Plus size={17} className="group-hover:rotate-90 transition-transform" />
          طلب سحب
        </button>
      </div>

      {/* Balance Hero */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-500/20" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3730a3 55%, #4f46e5 100%)" }}>
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-24 -right-8 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-6 left-6 text-white/10 pointer-events-none"><Coins size={140} /></div>

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-white/80">
              <Wallet size={16} />
              <p className="text-[12px] font-semibold tracking-wide">الرصيد المتاح للسحب</p>
            </div>
            <p className="text-3xl sm:text-4xl font-black tabular-nums mt-2 tracking-tight">{formatCurrency(balance)}</p>
            <p className="text-[12px] text-white/70 mt-1.5 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-300" />
              {minAmount > 0 ? `الحد الأدنى للسحب ${formatCurrency(minAmount)}` : "يمكنك السحب بأي مبلغ"}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            disabled={!canWithdraw}
            className="self-start md:self-center flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-indigo-700 text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all disabled:opacity-60 disabled:translate-y-0"
          >
            <ArrowUpRight size={17} />
            {canWithdraw ? "طلب سحب الآن" : balance > 0 ? `الرصيد أقل من الحد الأدنى (${formatCurrency(minAmount)})` : "لا يوجد رصيد متاح"}
          </button>
        </div>

        {/* How it works */}
        <div className="relative mt-6 rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-4">
          <p className="text-[12px] font-bold flex items-center gap-1.5 mb-2">
            <Info size={14} className="text-sky-300" />
            كيف تتم عملية السحب؟
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px] text-white/85">
            <li className="flex items-start gap-2">
              <span className="mt-1 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-black shrink-0">1</span>
              تصبح عمولتك متاحة للسحب بعد وضع الطلب في حالة «تم التحصيل» من قبل الإدارة.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-black shrink-0">2</span>
              أرسل طلب سحب، وسيتم مراجعته ثم موافقة الإدارة عليه.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-black shrink-0">3</span>
              بعد التحويل نرسل لك إثباتًا وستجد حالة الطلب «مكتمل» هنا.
            </li>
          </ul>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DashboardStatCard label="إجمالي الأرباح" value={formatCurrency(totalEarnings)} icon={Coins} tint="#7c3aed" sub="الأرباح المحققة من عمولاتك" href="/dashboard" />
        <DashboardStatCard label="إجمالي المسحوبات" value={formatCurrency(totalWithdrawn)} icon={TrendingUp} tint="#059669" sub="المبالغ التي تم تحويلها فعليًا" />
        <DashboardStatCard label="الطلبات المعلقة" value={pendingCount} icon={Clock} tint="#d97706" sub={pendingCount > 0 ? "في انتظار موافقة الإدارة" : "لا توجد طلبات معلقة"} />
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3 bg-slate-100 rounded-lg" />
                  <div className="w-20 h-2.5 bg-slate-100 rounded-lg" />
                </div>
                <div className="w-16 h-6 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : withdrawals.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm py-16 px-6 text-center">
          <div className="relative w-28 h-28 mx-auto mb-6">
            <div className="absolute inset-0 rounded-3xl rotate-6" style={{ background: "linear-gradient(135deg, #eef2ff, #f5f3ff)" }} />
            <div className="absolute inset-0 rounded-3xl -rotate-6" style={{ background: "linear-gradient(135deg, #e0e7ff, #ede9fe)" }} />
            <div className="absolute inset-3 rounded-2xl bg-white border border-slate-100 shadow-xl flex items-center justify-center">
              <Wallet size={32} className="text-indigo-500" />
            </div>
            <span className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shadow-sm">
              <Coins size={18} className="text-amber-500" />
            </span>
            <span className="absolute -bottom-1 -left-2 w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
              <CheckCircle2 size={15} className="text-emerald-500" />
            </span>
          </div>
          <h3 className="text-lg font-extrabold text-slate-900">لا توجد طلبات سحب بعد</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
            عندما يتم تحصيل عمولاتك سيتاح لك الرصيد للسحب. يمكنك إرسال أول طلب سحب بمجرد توفر الرصيد.
          </p>
          <button
            onClick={() => setShowModal(true)}
            disabled={!canWithdraw}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            <Plus size={17} />
            إنشاء أول طلب سحب
          </button>
          {!canWithdraw && balance > 0 && minAmount > 0 && (
            <p className="text-[12px] text-amber-600 mt-3">رصيدك {formatCurrency(balance)} أقل من الحد الأدنى {formatCurrency(minAmount)}</p>
          )}
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map((s) => (
                  <button
                    key={s || "all"}
                    onClick={() => setStatusFilter(s)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                      statusFilter === s
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"
                    }`}
                  >
                    {s === "PENDING" && <Clock size={12} />}
                    {s === "APPROVED" && <CheckCircle2 size={12} />}
                    {s === "REJECTED" && <XCircle size={12} />}
                    {s === "COMPLETED" && <CheckCircle2 size={12} />}
                    {s ? (s === "APPROVED" ? "موافق عليه" : s === "COMPLETED" ? "مكتمل" : s === "PENDING" ? "قيد الانتظار" : "مرفوض") : "الكل"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="text-slate-400" />
                <div className="relative">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="appearance-none pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                  >
                    {dateOptions.map((d) => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              عرض {filtered.length} من أصل {withdrawals.length} طلب
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-14 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <SearchIcon />
              </div>
              <p className="text-[14px] font-semibold text-slate-600">لا توجد نتائج مطابقة للفلترة</p>
              <button onClick={() => { setStatusFilter(""); setDateFilter("") }} className="mt-3 text-[12px] font-bold text-indigo-600 hover:underline">
                إعادة تعيين الفلاتر
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-right px-4 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">رقم الطلب</th>
                      <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">المبلغ</th>
                      <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">طريقة السحب</th>
                      <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">تاريخ الطلب</th>
                      <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الحالة</th>
                      <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">ملاحظات الإدارة</th>
                      <th className="px-3 py-3.5 w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((w) => {
                      const mi = METHOD_INFO[w.method] || METHOD_INFO.OTHER
                      const proofImg = w.proofImage
                      return (
                        <tr key={w.id} id={`wdr-desktop-${w.id}`} className={`hover:bg-slate-50/50 transition-colors ${highlighted === w.id ? "bg-indigo-50/70" : ""}`}>
                          <td className="px-4 py-3.5">
                            <span className="text-[13px] font-bold text-slate-800 font-mono" dir="ltr">{refNo(w.id)}</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(w.createdAt)}</p>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="text-[14px] font-extrabold text-slate-900 tabular-nums">{formatCurrency(w.amount)}</span>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${mi.tint}12` }}>
                                <mi.icon size={13} style={{ color: mi.tint }} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[12px] font-semibold text-slate-700">{mi.label}</p>
                                {(w.accountName || w.bankName) && (
                                  <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{w.accountName}{w.bankName ? ` · ${w.bankName}` : ""}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="text-[12px] text-slate-500">{formatDate(w.createdAt)}</span>
                            {w.processedAt && w.status === "COMPLETED" && (
                              <p className="text-[10px] text-emerald-600 mt-0.5">تم التنفيذ: {formatDate(w.processedAt)}</p>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex flex-col items-start gap-1">
                              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg ${STATUS_BADGE[w.status] || "bg-slate-50 text-slate-600"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[w.status] || "bg-slate-400"}`} />
                                {w.status === "COMPLETED" ? "مكتمل" : w.status === "APPROVED" ? "موافق عليه" : w.status === "REJECTED" ? "مرفوض" : "قيد الانتظار"}
                              </span>
                              <span className="text-[10px] text-slate-400">{STATUS_DESC[w.status]}</span>
                              <WithdrawalProgress status={w.status} />
                              <ProcessingDuration w={w} />
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            {w.notes ? (
                              <div className="flex items-start gap-1.5 max-w-[180px]">
                                <FileText size={12} className="text-slate-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-slate-600 leading-snug">{w.notes}</p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            {w.status === "COMPLETED" && proofImg && (
                              <button
                                onClick={() => setProofPreview(proofImg)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition-colors whitespace-nowrap"
                              >
                                <Eye size={13} />
                                عرض الإثبات
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Cards */}
              <div className="lg:hidden space-y-3">
                {filtered.map((w) => {
                  const mi = METHOD_INFO[w.method] || METHOD_INFO.OTHER
                  const proofImg = w.proofImage
                  return (
                    <div key={w.id} id={`wdr-mobile-${w.id}`} className={`rounded-2xl border shadow-sm p-4 transition-all ${highlighted === w.id ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200" : "bg-white border-slate-100"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-slate-800 font-mono" dir="ltr">{refNo(w.id)}</span>
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[w.status] || "bg-slate-50 text-slate-600"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[w.status] || "bg-slate-400"}`} />
                            {w.status === "COMPLETED" ? "مكتمل" : w.status === "APPROVED" ? "موافق عليه" : w.status === "REJECTED" ? "مرفوض" : "قيد الانتظار"}
                          </span>
                        </div>
                        <p className="text-[16px] font-extrabold text-slate-900 tabular-nums">{formatCurrency(w.amount)}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-4 text-[12px]">
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400">طريقة السحب</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${mi.tint}12` }}>
                              <mi.icon size={11} style={{ color: mi.tint }} />
                            </div>
                            <span className="font-semibold text-slate-700">{mi.label}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400">تاريخ الطلب</p>
                          <p className="font-semibold text-slate-700 mt-1">{formatDate(w.createdAt)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-50">
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400">{STATUS_DESC[w.status]}</p>
                          <ProcessingDuration w={w} />
                        </div>
                        {w.status === "COMPLETED" && proofImg ? (
                          <button onClick={() => setProofPreview(proofImg)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition-colors shrink-0">
                            <Eye size={13} />
                            عرض الإثبات
                          </button>
                        ) : (
                          <div className="w-24 shrink-0">
                            <WithdrawalProgress status={w.status} />
                          </div>
                        )}
                      </div>

                      {w.notes && (
                        <div className="mt-3 flex items-start gap-1.5 p-2.5 bg-amber-50/60 border border-amber-100 rounded-xl">
                          <FileText size={12} className="text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-bold text-amber-700">ملاحظات الإدارة</p>
                            <p className="text-[11px] text-amber-800/80 leading-snug">{w.notes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {showModal && (
        <WithdrawalDrawer
          balance={balance}
          minAmount={minAmount}
          onClose={() => { setShowModal(false); fetchData() }}
          onSuccess={() => toast("تم إرسال طلب السحب بنجاح، بانتظار موافقة الإدارة", "success")}
        />
      )}

      {proofPreview && (
        <Lightbox src={proofPreview} alt="إثبات التحويل" onClose={() => setProofPreview(null)} />
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function WithdrawalProgress({ status }: { status: string }) {
  const steps = ["PENDING", "APPROVED", "COMPLETED"]
  const activeIndex = status === "REJECTED" ? 0 : steps.indexOf(status)
  const rejected = status === "REJECTED"
  return (
    <div className="flex items-center gap-1 mt-1.5 w-full max-w-[140px]">
      {steps.map((s, i) => (
        <div
          key={s}
          className={`h-1 rounded-full flex-1 transition-colors ${
            i < activeIndex
              ? "bg-indigo-500"
              : i === activeIndex
                ? rejected
                  ? "bg-red-400"
                  : "bg-indigo-500"
                : rejected
                  ? "bg-red-100"
                  : "bg-slate-200"
          }`}
        />
      ))}
    </div>
  )
}

function humanDuration(ms: number) {
  const hours = ms / 3600000
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} دقيقة`
  if (hours < 24) return `${Math.round(hours)} ساعة`
  const days = hours / 24
  if (days < 30) return `${Math.round(days)} يوم`
  const months = days / 30
  return `${Math.round(months)} شهر`
}

function ProcessingDuration({ w }: { w: Withdrawal }) {
  if (w.status !== "COMPLETED" || !w.processedAt) return null
  const ms = new Date(w.processedAt).getTime() - new Date(w.createdAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return (
    <span className="text-[10px] text-emerald-600 flex items-center gap-1">
      <Clock size={10} />
      تم التنفيذ خلال {humanDuration(ms)}
    </span>
  )
}

function WithdrawalDrawer({ balance, minAmount, onClose, onSuccess }: { balance: number; minAmount: number; onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState({
    amount: "",
    method: "BANK_TRANSFER",
    accountName: "",
    accountNumber: "",
    bankName: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const amountValue = parseFloat(form.amount) || 0
  const methodInfo = METHOD_INFO[form.method] || METHOD_INFO.OTHER
  const methodLabel = methodInfo.label
  const balanceAfter = balance - amountValue

  const handleNext = () => {
    setError("")
    if (amountValue <= 0) {
      setError("المبلغ يجب أن يكون أكبر من صفر")
      return
    }
    if (amountValue > balance) {
      setError("المبلغ أكبر من الرصيد المتاح")
      return
    }
    if (minAmount > 0 && amountValue < minAmount) {
      setError(`الحد الأدنى للسحب هو ${formatCurrency(minAmount)}`)
      return
    }
    if (!form.accountName.trim()) {
      setError("يرجى إدخال اسم صاحب الحساب")
      return
    }
    if (!form.accountNumber.trim()) {
      setError("يرجى إدخال رقم الحساب أو المحفظة")
      return
    }
    setStep(2)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: amountValue }),
      })
      if (res.ok) {
        onSuccess()
        onClose()
      } else {
        const data = await res.json()
        setError(data.error || "حدث خطأ")
        setStep(1)
      }
    } catch {
      setError("حدث خطأ")
    } finally {
      setSubmitting(false)
    }
  }

  const quickAmounts = [
    { label: "نصف الرصيد", value: Math.floor(balance / 2) },
    { label: "كامل الرصيد", value: Math.floor(balance) },
  ]

  const methods = [
    { key: "BANK_TRANSFER", label: "تحويل بنكي", icon: Landmark },
    { key: "VODAFONE_CASH", label: "فودافون كاش", icon: Smartphone },
    { key: "INSTAPAY", label: "إنستاباي", icon: Zap },
    { key: "OTHER", label: "أخرى", icon: Wallet },
  ]

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose} />
      {/* Bottom sheet on mobile, side drawer on desktop */}
      <div className="absolute bottom-0 inset-x-0 lg:inset-x-auto lg:top-0 lg:right-0 lg:h-full lg:w-[26rem] lg:max-w-full bg-white shadow-2xl flex flex-col rounded-t-3xl lg:rounded-none max-h-[92vh] lg:max-h-none animate-slideInUp lg:animate-slide-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${methodInfo.tint}14` }}>
              <methodInfo.icon size={16} style={{ color: methodInfo.tint }} />
            </div>
            <div>
              <h2 className="text-[15px] font-extrabold text-slate-900">{step === 1 ? "طلب سحب" : "تأكيد الطلب"}</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">الرصيد المتاح: <span className="font-bold text-slate-600 tabular-nums">{formatCurrency(balance)}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-5 pt-4">
          {[1, 2].map((s) => (
            <div key={s} className={`flex items-center gap-1.5`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${step >= s ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200" : "bg-slate-100 text-slate-400"}`}>
                {step > s ? "✓" : s}
              </span>
              <span className={`text-[11px] font-bold ${step >= s ? "text-slate-800" : "text-slate-400"}`}>
                {s === 1 ? "البيانات" : "المراجعة"}
              </span>
            </div>
          ))}
          <div className="flex-1 h-0.5 rounded-full bg-slate-100 relative overflow-hidden">
            <div className={`h-full bg-indigo-500 transition-all duration-500 ${step === 2 ? "w-full" : "w-0"}`} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-[13px] font-medium px-4 py-3 rounded-xl mb-4 flex items-center gap-2 animate-fade-in">
              <XCircle size={15} className="shrink-0" />
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">المبلغ المطلوب سحبه</label>
                <div className="relative">
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    min={minAmount > 0 ? minAmount : 1}
                    max={balance}
                    className="w-full px-4 py-3 pl-14 rounded-xl border border-slate-200 text-lg font-extrabold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    placeholder="0"
                    autoFocus
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400">ج.م</span>
                </div>
                {minAmount > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1.5">الحد الأدنى للسحب: {formatCurrency(minAmount)}</p>
                )}
                {balance > 0 && (
                  <div className="flex gap-2 mt-2">
                    {quickAmounts.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => setForm({ ...form, amount: String(Math.max(0, q.value)) })}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold hover:bg-indigo-100 transition-colors"
                      >
                        {q.label} ({formatCurrency(q.value)})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">طريقة السحب</label>
                <div className="grid grid-cols-2 gap-2">
                  {methods.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setForm({ ...form, method: m.key })}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12px] font-semibold transition-all ${
                        form.method === m.key
                          ? "border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <m.icon size={15} className={form.method === m.key ? "text-indigo-600" : "text-slate-400"} />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5">اسم صاحب الحساب</label>
                  <input
                    type="text"
                    value={form.accountName}
                    onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    placeholder="الاسم كما في الحساب"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5">رقم الحساب / المحفظة</label>
                  <input
                    type="text"
                    value={form.accountNumber}
                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    placeholder="رقم الحساب أو المحفظة"
                  />
                </div>
              </div>

              {form.method === "BANK_TRANSFER" && (
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5">اسم البنك</label>
                  <input
                    type="text"
                    value={form.bankName}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all"
                    placeholder="اسم البنك"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 overflow-hidden">
                <div className="px-4 py-3 bg-indigo-600 text-white text-[12px] font-bold">مراجعة بيانات طلب السحب</div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-slate-500">المبلغ</span>
                    <span className="text-lg font-black text-indigo-700 tabular-nums">{formatCurrency(amountValue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-slate-500">طريقة السحب</span>
                    <span className="flex items-center gap-1.5 text-[12px] font-bold text-slate-800">
                      <methodInfo.icon size={14} style={{ color: methodInfo.tint }} />
                      {methodLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-slate-500">اسم الحساب</span>
                    <span className="text-[12px] font-bold text-slate-800">{form.accountName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-slate-500">رقم الحساب / المحفظة</span>
                    <span className="text-[12px] font-bold text-slate-800 font-mono" dir="ltr">{form.accountNumber}</span>
                  </div>
                  {form.bankName && (
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-slate-500">البنك</span>
                      <span className="text-[12px] font-bold text-slate-800">{form.bankName}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-indigo-100 pt-3">
                    <span className="text-[12px] text-slate-500">الرصيد بعد السحب</span>
                    <span className="text-[12px] font-bold text-slate-700 tabular-nums">{formatCurrency(Math.max(0, balanceAfter))}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3 flex items-start gap-2">
                <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  سيتم خصم المبلغ من رصيدك المتاح مؤقتًا لحين مراجعة الإدارة، ويُعاد إليك تلقائيًا إذا تم رفض الطلب.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-slate-100 bg-white shrink-0 space-y-2">
          {step === 1 ? (
            <button
              onClick={handleNext}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
            >
              <ArrowUpRight size={16} />
              مراجعة الطلب
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                رجوع
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    تأكيد وإرسال
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
