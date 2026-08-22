"use client"
import { useCallback, useEffect, useState } from "react"
import {
  Landmark,
  Wallet,
  Coins,
  TrendingUp,
  Banknote,
  PiggyBank,
  AlertTriangle,
  Search,
  Loader2,
  X,
  FilterX,
  Calendar,
  Download,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownLeft,
  History,
  Copy,
  Image as ImageIcon,
  Eye,
  MessageCircle,
} from "lucide-react"
import { formatCurrency, formatDateTime, formatDate, getStatusColor, getStatusText } from "@/lib/utils"
import { useToast } from "@/components/Toast"
import { RequirePerms } from "@/components/admin/RequirePerms"
import Pagination from "@/components/Pagination"
import Drawer from "@/components/Drawer"
import EmptyState from "@/components/EmptyState"

const PER_PAGE = 15

const TYPE_OPTIONS = [
  { key: "", label: "الكل", icon: Coins },
  { key: "COMMISSION", label: "عمولات", icon: TrendingUp },
  { key: "WITHDRAWAL", label: "سحوبات", icon: Banknote },
]

const STATUS_OPTIONS = [
  { key: "", label: "كل الحالات" },
  { key: "PENDING", label: "قيد الانتظار" },
  { key: "APPROVED", label: "موافق عليه" },
  { key: "COMPLETED", label: "مكتمل" },
  { key: "REJECTED", label: "مرفوض" },
]

function StatCard({ label, value, icon: Icon, tint, text, sub }: { label: string; value: string; icon: any; tint: string; text: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400">{label}</p>
          <p className={`text-lg sm:text-2xl font-extrabold mt-1 truncate tabular-nums ${text}`}>{value}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tint}12` }}>
          <Icon size={18} style={{ color: tint }} />
        </div>
      </div>
    </div>
  )
}

export default function AdminFinancialsPage() {
  const { toast } = useToast()
  const [summary, setSummary] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [audit, setAudit] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<any>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) })
    if (type) params.set("type", type)
    if (status) params.set("status", status)
    if (search.trim()) params.set("search", search.trim())
    if (dateFrom) params.set("from", dateFrom)
    if (dateTo) params.set("to", dateTo)
    fetch(`/api/admin/financials?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary || null)
        setTransactions(Array.isArray(d.transactions) ? d.transactions : [])
        setAudit(Array.isArray(d.audit) ? d.audit : [])
        setTotal(d.total || 0)
        setTotalPages(d.pages || 1)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [page, type, status, search, dateFrom, dateTo])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [type, status, search, dateFrom, dateTo])

  const hasFilters = !!search || !!type || !!status || !!dateFrom || !!dateTo

  const clearFilters = () => { setSearch(""); setType(""); setStatus(""); setDateFrom(""); setDateTo("") }

  const exportCSV = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ limit: "1000", page: "1" })
      if (type) params.set("type", type)
      if (status) params.set("status", status)
      if (search.trim()) params.set("search", search.trim())
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo) params.set("to", dateTo)
      const res = await fetch(`/api/admin/financials?${params}`)
      const d = await res.json()
      const rows = Array.isArray(d.transactions) ? d.transactions : []
      const header = "النوع,المرجع,المسوق,البريد,المبلغ,الحالة,طريقة السحب,التاريخ,تاريخ المعالجة"
      const lines = rows.map((t: any) => [
        t.type === "COMMISSION" ? "عمولة" : "سحب",
        t.ref, t.user?.name || "", t.user?.email || "",
        t.amount, getStatusText(t.status), t.method || "",
        formatDateTime(t.date), t.processedAt ? formatDateTime(t.processedAt) : "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      const blob = new Blob(["\uFEFF" + header + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url; link.download = `financials-${Date.now()}.csv`; link.click()
      URL.revokeObjectURL(url)
      toast(`تم تصدير ${rows.length} معاملة`, "success")
    } catch { toast("حدث خطأ في التصدير", "error") }
    setExporting(false)
  }

  const copyRef = async (ref: string) => {
    try { await navigator.clipboard.writeText(ref); toast("تم نسخ المرجع", "success") }
    catch { toast("تعذر النسخ", "error") }
  }

  return (
    <RequirePerms perm="withdrawals.view">
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
            <Landmark size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">المعاملات المالية</h1>
            <p className="text-[12px] text-slate-500">العمولات والسحوبات والأرصدة — من البيانات الفعلية للنظام</p>
          </div>
        </div>
        <button onClick={exportCSV} disabled={exporting || total === 0}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[12px] font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-colors border border-emerald-100">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} تصدير CSV
        </button>
      </div>

      {/* Review alert */}
      {!loading && summary && summary.pendingWithdrawals?.count > 0 && (
        <a href="/admin/withdrawals" className="flex items-center gap-3 flex-wrap bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 hover:bg-amber-100/70 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><AlertTriangle size={16} className="text-amber-600" /></div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-amber-800">يوجد {summary.pendingWithdrawals.count.toLocaleString("ar-EG")} طلب سحب بانتظار المراجعة</p>
            <p className="text-[11px] text-amber-600">بإجمالي {formatCurrency(summary.pendingWithdrawals.amount)} — راجعها من صفحة طلبات السحب</p>
          </div>
          <ChevronLeft size={16} className="mr-auto text-amber-400 shrink-0" />
        </a>
      )}

      {/* Stats */}
      {!loading && summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="إجمالي المبيعات" value={formatCurrency(summary.totalRevenue)} icon={Wallet} tint="#7c3aed" text="text-violet-600" sub={`${summary.totalOrders.toLocaleString("ar-EG")} طلب`} />
          <StatCard label="إجمالي العمولات" value={formatCurrency(summary.totalCommissions)} icon={Coins} tint="#2563eb" text="text-blue-600" sub="ما استحقه المسوقون" />
          <StatCard label="صافي الإيراد" value={formatCurrency(summary.netRevenue)} icon={TrendingUp} tint="#059669" text="text-emerald-600" sub="المبيعات - العمولات" />
          <StatCard label="رصيد مستحق للمسوقين" value={formatCurrency(summary.outstandingBalance)} icon={PiggyBank} tint="#d97706" text="text-amber-600" sub="أرصدة المسوقين الحالية" />
          <StatCard label="إجمالي المسحوبات" value={formatCurrency(summary.totalWithdrawn)} icon={Banknote} tint="#64748b" text="text-slate-600" sub="سحوبات مكتملة" />
          <StatCard label="إجمالي أرباح المسوقين" value={formatCurrency(summary.totalEarnings)} icon={Landmark} tint="#0d9488" text="text-teal-600" sub="تراكمي منذ البداية" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث باسم المسوق أو البريد أو المرجع..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all">
            {STATUS_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500">من</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-[12px] text-slate-700 focus:outline-none [color-scheme:light] w-[110px]" />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[11px] text-slate-500">إلى</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-[12px] text-slate-700 focus:outline-none [color-scheme:light] w-[110px]" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-[12px] font-semibold hover:bg-red-100 transition-colors">
              <FilterX size={14} /> مسح الفلاتر
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setType(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all
                ${type === key
                  ? "bg-violet-600 text-white shadow-sm shadow-violet-200"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"}`}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3 bg-slate-100 rounded-lg" />
                  <div className="w-20 h-2 bg-slate-100 rounded-lg" />
                </div>
                <div className="w-16 h-6 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<Coins size={30} className="text-slate-300" />}
          title="لا توجد معاملات"
          subtitle={hasFilters ? "جرّب تغيير معايير البحث أو مسح الفلاتر" : "لم تسجل أي عمولات أو سحوبات بعد"}
        />
      ) : (
        <>
          <p className="text-[12px] text-slate-500">{total.toLocaleString("ar-EG")} معاملة {hasFilters ? "بعد الفلترة" : ""}</p>
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-right px-4 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">النوع</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">المسوق</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">المرجع</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">المبلغ</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الحالة</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">التاريخ</th>
                    <th className="px-3 py-3.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.map((t) => {
                    const isCommission = t.type === "COMMISSION"
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => setSelected(t)}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isCommission ? "bg-emerald-50" : "bg-amber-50"}`}>
                              {isCommission ? <TrendingUp size={15} className="text-emerald-600" /> : <Banknote size={15} className="text-amber-600" />}
                            </div>
                            <span className="text-[12px] font-bold text-slate-700">{isCommission ? "عمولة" : "سحب"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <p className="text-[13px] font-bold text-slate-800 truncate max-w-[180px]">{t.user?.name || "—"}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[180px]" dir="ltr">{t.user?.email || ""}</p>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <code className="text-[11px] font-mono text-slate-500" dir="ltr">{t.ref || "—"}</code>
                            {t.ref && <button onClick={(e) => { e.stopPropagation(); copyRef(t.ref) }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-violet-600 transition-colors opacity-0 group-hover:opacity-100"><Copy size={11} /></button>}
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`text-[13px] font-extrabold tabular-nums ${isCommission ? "text-emerald-600" : "text-red-500"}`}>
                            {isCommission ? "+" : "−"}{formatCurrency(t.amount)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg ${getStatusColor(t.status)}`}>{getStatusText(t.status)}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="text-[12px] text-slate-500">{formatDate(t.date)}</span>
                        </td>
                        <td className="px-3 py-3.5">
                          <ChevronLeft size={15} className="text-slate-300 group-hover:text-violet-500 transition-colors" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-2.5">
            {transactions.map((t) => {
              const isCommission = t.type === "COMMISSION"
              return (
                <button key={t.id} onClick={() => setSelected(t)} className="w-full text-right bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isCommission ? "bg-emerald-50" : "bg-amber-50"}`}>
                        {isCommission ? <TrendingUp size={15} className="text-emerald-600" /> : <Banknote size={15} className="text-amber-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-800 truncate">{isCommission ? "عمولة" : "سحب"} · {t.user?.name || "—"}</p>
                        <p className="text-[10px] text-slate-400 truncate" dir="ltr">{t.ref || ""}</p>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <p className={`text-[13px] font-extrabold tabular-nums ${isCommission ? "text-emerald-600" : "text-red-500"}`}>{isCommission ? "+" : "−"}{formatCurrency(t.amount)}</p>
                      <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-0.5 ${getStatusColor(t.status)}`}>{getStatusText(t.status)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Audit log */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><History size={14} className="text-slate-500" /></div>
          <h2 className="text-[14px] font-bold text-slate-800">سجل التدقيق</h2>
          <span className="text-[11px] text-slate-400">آخر العمليات الإدارية على النظام</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {audit.length === 0 ? (
            <div className="text-center py-8 text-[12px] text-slate-400">لا توجد عمليات مسجلة بعد</div>
          ) : (
            audit.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0"><History size={13} className="text-violet-500" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-slate-700 leading-relaxed">
                    <span className="font-bold">{a.details || a.action}</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-500">{a.user}</span>
                    <span className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{a.module}</span>
                    <span>{formatDateTime(a.createdAt)}</span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Transaction drawer */}
      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="تفاصيل المعاملة"
        icon={Coins}
        tint="#7c3aed"
        maxWidth="max-w-lg"
      >
        {selected && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selected.type === "COMMISSION" ? "bg-emerald-50" : "bg-amber-50"}`}>
                {selected.type === "COMMISSION"
                  ? <ArrowDownLeft size={20} className="text-emerald-600" />
                  : <ArrowUpRight size={20} className="text-amber-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-extrabold text-slate-900">{selected.type === "COMMISSION" ? "عمولة من طلب" : "طلب سحب"}</p>
                <p className="text-[11px] text-slate-400">{formatDateTime(selected.date)}</p>
              </div>
              <span className={`text-[16px] font-extrabold tabular-nums ${selected.type === "COMMISSION" ? "text-emerald-600" : "text-red-500"}`}>
                {selected.type === "COMMISSION" ? "+" : "−"}{formatCurrency(selected.amount)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold text-slate-400">المسوق</p>
                <p className="text-[12px] font-bold text-slate-700 truncate">{selected.user?.name || "—"}</p>
                <p className="text-[10px] text-slate-400 truncate" dir="ltr">{selected.user?.email || ""}</p>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                <p className="text-[10px] font-semibold text-slate-400">الحالة</p>
                <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md mt-1 ${getStatusColor(selected.status)}`}>{getStatusText(selected.status)}</span>
              </div>
              {selected.ref && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5 col-span-2 flex items-center gap-2">
                  <p className="text-[10px] font-semibold text-slate-400 shrink-0">المرجع</p>
                  <code className="text-[12px] font-mono font-bold text-slate-700 truncate flex-1" dir="ltr">{selected.ref}</code>
                  <button onClick={() => copyRef(selected.ref)} className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"><Copy size={12} /></button>
                </div>
              )}
              {selected.type === "WITHDRAWAL" && selected.method && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5 col-span-2">
                  <p className="text-[10px] font-semibold text-slate-400">طريقة السحب</p>
                  <p className="text-[12px] font-bold text-slate-700">{selected.method === "BANK_TRANSFER" ? "تحويل بنكي" : selected.method === "INSTAPAY" ? "إنستاباي" : selected.method === "VODAFONE_CASH" ? "فودافون كاش" : selected.method}</p>
                </div>
              )}
              {selected.bankName && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-slate-400">البنك</p>
                  <p className="text-[12px] font-bold text-slate-700 truncate">{selected.bankName}</p>
                </div>
              )}
              {selected.accountName && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-slate-400">اسم الحساب</p>
                  <p className="text-[12px] font-bold text-slate-700 truncate">{selected.accountName}</p>
                </div>
              )}
              {selected.accountNumber && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5 col-span-2">
                  <p className="text-[10px] font-semibold text-slate-400">رقم الحساب</p>
                  <p className="text-[12px] font-bold text-slate-700" dir="ltr">{selected.accountNumber}</p>
                </div>
              )}
              {selected.notes && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5 col-span-2">
                  <p className="text-[10px] font-semibold text-slate-400">ملاحظات</p>
                  <p className="text-[12px] text-slate-700 leading-relaxed">{selected.notes}</p>
                </div>
              )}
              {selected.processedAt && (
                <div className="bg-slate-50 rounded-xl px-3 py-2.5 col-span-2">
                  <p className="text-[10px] font-semibold text-slate-400">تاريخ المعالجة</p>
                  <p className="text-[12px] font-bold text-slate-700">{formatDateTime(selected.processedAt)}</p>
                </div>
              )}
            </div>

            {selected.proofImage && (
              <div>
                <p className="text-[12px] font-bold text-slate-700 mb-2 flex items-center gap-1.5"><ImageIcon size={13} className="text-slate-400" /> إثبات التحويل</p>
                <div className="rounded-xl overflow-hidden border border-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.proofImage} alt="إثبات التحويل" className="w-full max-h-72 object-contain bg-slate-50" />
                </div>
              </div>
            )}

            {selected.type === "WITHDRAWAL" && selected.user?.phone && (
              <div className="flex gap-2">
                <a href={`tel:${selected.user.phone}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-[12px] font-bold hover:bg-slate-200 transition-colors"><Eye size={14} /> الاتصال</a>
                <a href={`https://wa.me/${selected.user.phone.replace(/[^\d]/g, "").replace(/^0/, "2")}`} target="_blank" rel="noopener" className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-700 rounded-xl text-[12px] font-bold hover:bg-green-100 transition-colors"><MessageCircle size={14} /> واتساب</a>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
    </RequirePerms>
  )
}
