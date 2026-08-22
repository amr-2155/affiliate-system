"use client"
import { useEffect, useState, useMemo, useCallback } from "react"
import {
  Store, Loader2, Wallet, Package, Phone, MapPin, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronUp, CalendarDays, ToggleLeft, ToggleRight,
  ClipboardList, BarChart3, Settings2, Check, Link2, MessageSquare, History, Zap,
} from "lucide-react"
import { RequirePerms } from "@/components/admin/RequirePerms"
import DateTimePicker from "@/components/admin/DateTimePicker"
import BottomSheet from "@/components/BottomSheet"
import { useToast } from "@/components/Toast"
import { SUPPLIER_STATUS_META, SUPPLIER_STATUS, supplierStatusLabel, formatDateSmart } from "@/lib/supplier-referrals"
import { formatCurrency, formatDate } from "@/lib/utils"

interface AffiliateBrief { id: string; name: string | null; email: string }
interface BonusEntry { id: string; amount: number; status: string; createdAt: string; orderNumber: string }
interface LinkedProduct { id: string; nameAr: string | null; name: string | null; sku: string | null }

interface Referral {
  id: string
  supplierName: string
  brandName: string
  phone: string
  whatsapp: string | null
  city: string
  productType: string
  storeUrl: string | null
  expectedProducts: number
  notes: string | null
  contactMethod: string
  status: string
  displayStatus: string
  rejectReason: string | null
  internalNotes: string | null
  activationDate: string | null
  campaignEndDate: string | null
  createdAt: string
  affiliate: AffiliateBrief
  bonusLedger: BonusEntry[]
  products: LinkedProduct[]
  qualifyingCount: number
  earned: number
  paid: number
}

interface SettingsPayload {
  enabled: boolean
  bonusPerOrder: number
  includeCollected: boolean
  campaignStart: string | null
  campaignEnd: string | null
  maxBonusPerSupplier: number | null
  maxTotalBonus: number | null
  minEligibleOrders: number
  durationDays: number
  durationStartFromActivation: boolean
  updatedAt: string
}

const STATUS_FLOW: string[] = [
  SUPPLIER_STATUS.PENDING, SUPPLIER_STATUS.UNDER_REVIEW, SUPPLIER_STATUS.APPROVED,
  SUPPLIER_STATUS.CONTACTED, SUPPLIER_STATUS.ONBOARDING, SUPPLIER_STATUS.ACTIVE,
]

const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-shadow"

const labelCls = "block text-[11px] font-bold text-slate-600 mb-1.5"

function Badge({ status }: { status: string }) {
  const meta = SUPPLIER_STATUS_META[status] || SUPPLIER_STATUS_META.PENDING
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${meta.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

function SummaryCard({ label, value, tint, icon: Icon, sub }: { label: string; value: string; tint: string; icon: any; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${tint}12` }}>
          <Icon size={15} style={{ color: tint }} />
        </div>
        <span className="text-[11px] font-bold text-slate-500">{label}</span>
      </div>
      <p className="text-xl font-extrabold text-slate-900 leading-none">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function TabBtn({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: any }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all ${active ? "bg-gradient-to-l from-blue-600 to-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

export default function AdminSupplierReferralsPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<"dashboard" | "list" | "settings">("list")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [summary, setSummary] = useState<any>({})
  const [topAffiliates, setTopAffiliates] = useState<any[]>([])
  const [topSuppliers, setTopSuppliers] = useState<any[]>([])
  const [settings, setSettings] = useState<SettingsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [actionRef, setActionRef] = useState<Referral | null>(null)
  const [actionMode, setActionMode] = useState<"status" | "notes" | "link" | "pay">("status")
  const [targetStatus, setTargetStatus] = useState<string>(SUPPLIER_STATUS.APPROVED)
  const [rejectReason, setRejectReason] = useState("")
  const [note, setNote] = useState("")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [productOptions, setProductOptions] = useState<LinkedProduct[]>([])
  const [submitting, setSubmitting] = useState(false)

  // settings form
  const [sf, setSf] = useState<SettingsPayload | null>(null)

  const loadList = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/supplier-referrals?status=${statusFilter}&view=list`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error)
        setReferrals(d.referrals || [])
        setSettings(d.settings || null)
        setSf(d.settings || null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [statusFilter])

  const loadDashboard = useCallback(() => {
    fetch("/api/admin/supplier-referrals?view=dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) return
        setSummary(d.summary || {})
        setTopAffiliates(d.topAffiliates || [])
        setTopSuppliers(d.topSuppliers || [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadList()
    loadDashboard()
  }, [loadList, loadDashboard])

  const counts = useMemo(() => summary.counts || {}, [summary.counts])

  const openAction = (r: Referral, mode: "status" | "notes" | "link" | "pay") => {
    setActionRef(r)
    setActionMode(mode)
    setTargetStatus(STATUS_FLOW.find((s) => s !== r.status) || SUPPLIER_STATUS.APPROVED)
    setRejectReason("")
    setNote("")
    setSelectedProducts(r.products.map((p) => p.id))
    if (mode === "link") {
      fetch("/api/admin/products?limit=100")
        .then((res) => res.json())
        .then((d) => setProductOptions(d.products || []))
        .catch(() => setProductOptions([]))
    }
  }

  const runAction = async () => {
    if (!actionRef) return
    setSubmitting(true)
    try {
      const payload: any = { action: actionMode }
      if (actionMode === "status") {
        payload.status = targetStatus
        if (targetStatus === SUPPLIER_STATUS.REJECTED) payload.rejectReason = rejectReason
      }
      if (actionMode === "notes") payload.note = note
      if (actionMode === "link") payload.productIds = selectedProducts
      const res = await fetch(`/api/admin/supplier-referrals/${actionRef.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error || "تعذر تنفيذ الإجراء")
      toast("تم تنفيذ الإجراء بنجاح", "success")
      setActionRef(null)
      loadList()
      loadDashboard()
    } catch (e: any) {
      toast(e?.message || "حدث خطأ", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const saveSettings = async () => {
    if (!sf) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/supplier-referrals/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sf,
          campaignStart: sf.campaignStart || null,
          campaignEnd: sf.campaignEnd || null,
          maxBonusPerSupplier: sf.maxBonusPerSupplier,
          maxTotalBonus: sf.maxTotalBonus,
        }),
      })
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error || "تعذر حفظ الإعدادات")
      setSettings(d.settings)
      setSf(d.settings)
      toast("تم حفظ إعدادات الحملة", "success")
    } catch (e: any) {
      toast(e?.message || "حدث خطأ", "error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <RequirePerms perm="suppliers.view">
      <div className="space-y-5 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
              <Store size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">الموردون المرشحون</h1>
              <p className="text-[12px] text-slate-500">ترشيحات المسوقين — الموافقة والتفعيل وبونصات الحملة</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")} label="لوحة وتقارير" icon={BarChart3} />
            <TabBtn active={tab === "list"} onClick={() => setTab("list")} label="الطلبات" icon={ClipboardList} />
            <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} label="إعدادات الحملة" icon={Settings2} />
          </div>
        </div>

        {/* Campaign status banner */}
        {settings && (
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${settings.enabled ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
            {settings.enabled ? <ToggleRight size={18} className="text-emerald-600" /> : <ToggleLeft size={18} className="text-amber-600" />}
            <p className="text-[12px] font-semibold text-slate-700 flex-1">
              {settings.enabled
                ? `الحملة مفعّلة — بونص ${formatCurrency(settings.bonusPerOrder)} لكل طلب تسليم${settings.includeCollected ? "/تحصيل" : ""} مؤهل`
                : "الحملة متوقفة — لا يمكن إرسال ترشيحات جديدة"}
            </p>
            <span className="hidden sm:inline text-[11px] text-slate-500">{settings.durationDays} يوم حملة من التفعيل</span>
          </div>
        )}

        {tab === "dashboard" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="إجمالي الترشيحات" value={String(counts.total || 0)} tint="#059669" icon={Store} />
              <SummaryCard label="قيد الانتظار" value={String(counts.PENDING || 0)} tint="#f59e0b" icon={ClipboardList} />
              <SummaryCard label="معتمدة / قيد التفعيل" value={String(summary.approved || 0)} tint="#2563eb" icon={CheckCircle2} />
              <SummaryCard label="نشطة" value={String(summary.active || 0)} tint="#10b981" icon={Zap as any} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="الطلبات المؤهلة" value={String(summary.qualifyingOrders || 0)} tint="#7c3aed" icon={Package} />
              <SummaryCard label="بونص مستحق" value={formatCurrency(summary.dueBonus || 0)} tint="#d97706" icon={Wallet} sub={`${summary.dueCount || 0} بونص بانتظار الصرف`} />
              <SummaryCard label="بونص مصروف" value={formatCurrency(summary.paidBonus || 0)} tint="#059669" icon={CheckCircle2} />
              <SummaryCard label="مرفوضة / منتهية" value={String((summary.rejected || 0) + (summary.expired || 0))} tint="#ef4444" icon={AlertTriangle} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
                <p className="px-4 py-3 text-[13px] font-extrabold text-slate-900 border-b border-slate-50 flex items-center gap-2">
                  <Store size={14} className="text-emerald-600" /> أفضل المسوقين
                </p>
                {topAffiliates.length === 0 ? (
                  <p className="px-4 py-6 text-[12px] text-slate-400 text-center">لا توجد بيانات بعد</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {topAffiliates.map((a: any, i: number) => (
                      <div key={a.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 h-6 rounded-lg text-[10px] font-bold text-white flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#b45309"}, ${i === 0 ? "#fbbf24" : i === 1 ? "#cbd5e1" : "#d97706"})` }}>{i + 1}</span>
                          <span className="text-[12px] font-bold text-slate-800 truncate">{a.name || a.email}</span>
                        </div>
                        <span className="text-[11px] text-slate-500">{a.referrals} ترشيح</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
                <p className="px-4 py-3 text-[13px] font-extrabold text-slate-900 border-b border-slate-50 flex items-center gap-2">
                  <Package size={14} className="text-emerald-600" /> أعلى الموردين نشاطًا
                </p>
                {topSuppliers.length === 0 ? (
                  <p className="px-4 py-6 text-[12px] text-slate-400 text-center">لا توجد بيانات بعد</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {topSuppliers.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-slate-800 truncate">{s.supplierName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{s.affiliateName}</p>
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700">{s.count} طلب مؤهل</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "list" && (
          <div className="space-y-4">
            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["ALL", ...Object.keys(SUPPLIER_STATUS_META)].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-[11px] font-bold transition-all ${statusFilter === s ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
                >
                  {s === "ALL" ? "الكل" : supplierStatusLabel(s)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-600" /></div>
            ) : referrals.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 py-12 text-center">
                <Store size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-[13px] font-bold text-slate-500">لا توجد ترشيحات في هذه الحالة</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {referrals.map((r) => {
                  const isExpanded = expanded === r.id
                  const isTerminal = ["REJECTED", "EXPIRED"].includes(r.displayStatus)
                  const canPay = r.earned > 0
  const TabBtn = ({ id, label, icon: Icon }: { id: typeof tab; label: string; icon: any }) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all ${tab === id ? "bg-gradient-to-l from-blue-600 to-indigo-600 text-white shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
    >
      <Icon size={14} />
      {label}
    </button>
  )

  return (
                    <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${SUPPLIER_STATUS_META[r.displayStatus]?.color || "#64748b"}15` }}>
                              <Store size={18} style={{ color: SUPPLIER_STATUS_META[r.displayStatus]?.color || "#64748b" }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[14px] font-extrabold text-slate-900 truncate">{r.supplierName}</p>
                              <p className="text-[11px] text-slate-500 truncate">{r.brandName} · {r.city}</p>
                            </div>
                          </div>
                          <Badge status={r.displayStatus} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-slate-600">
                          <p className="flex items-center gap-1.5 truncate"><Phone size={12} className="text-slate-400 shrink-0" />{r.phone}</p>
                          <p className="flex items-center gap-1.5 truncate"><MapPin size={12} className="text-slate-400 shrink-0" />{r.productType}</p>
                          <p className="flex items-center gap-1.5 truncate col-span-2">
                            <ClipboardList size={12} className="text-slate-400 shrink-0" />
                            رشّحه: {r.affiliate?.name || r.affiliate?.email} · {formatDate(r.createdAt)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 mt-3 flex-wrap text-[10px]">
                          {r.displayStatus === "ACTIVE" && (
                            <>
                              <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold">{r.qualifyingCount} طلب مؤهل</span>
                              <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold">بونص متاح: {formatCurrency(r.earned)}</span>
                            </>
                          )}
                          {r.products.length > 0 && (
                            <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold">{r.products.length} منتج مرتبط</span>
                          )}
                        </div>

                        {r.displayStatus === "REJECTED" && r.rejectReason && (
                          <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[11px] text-red-700 font-medium">سبب الرفض: {r.rejectReason}</div>
                        )}

                        {!isTerminal && (
                          <div className="flex items-center gap-2 mt-4 flex-wrap">
                            <button onClick={() => openAction(r, "status")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-700 transition-colors">
                              <Check size={12} /> تغيير الحالة
                            </button>
                            <button onClick={() => openAction(r, "link")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold hover:bg-blue-100 transition-colors">
                              <Link2 size={12} /> ربط المنتجات
                            </button>
                            <button onClick={() => openAction(r, "notes")} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition-colors">
                              <MessageSquare size={12} /> ملاحظة
                            </button>
                            <button
                              onClick={() => openAction(r, "pay")}
                              disabled={!canPay}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Wallet size={12} /> صرف البونص ({formatCurrency(r.earned)})
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setExpanded(isExpanded ? null : r.id)}
                        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-slate-50 text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                      >
                        <span className="flex items-center gap-1.5"><History size={12} /> السجل والملاحظات وبونصات {r.supplierName}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 bg-slate-50/60">
                          <div className="grid grid-cols-3 gap-2 text-[11px]">
                            <div className="bg-white rounded-lg border border-slate-100 p-2.5 text-center">
                              <p className="text-slate-400 font-medium">مستحق</p>
                              <p className="font-extrabold text-slate-900">{formatCurrency(r.earned)}</p>
                            </div>
                            <div className="bg-white rounded-lg border border-slate-100 p-2.5 text-center">
                              <p className="text-slate-400 font-medium">مصروف</p>
                              <p className="font-extrabold text-emerald-700">{formatCurrency(r.paid)}</p>
                            </div>
                            <div className="bg-white rounded-lg border border-slate-100 p-2.5 text-center">
                              <p className="text-slate-400 font-medium">مؤهل</p>
                              <p className="font-extrabold text-slate-900">{r.qualifyingCount}</p>
                            </div>
                          </div>

                          {r.activationDate && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <CalendarDays size={11} /> التفعيل {formatDateSmart(r.activationDate)}
                              {r.campaignEndDate && ` — نهاية الحملة ${formatDateSmart(r.campaignEndDate)}`}
                            </p>
                          )}

                          {r.internalNotes && (
                            <div className="bg-white rounded-lg border border-slate-100 p-3">
                              <p className="text-[11px] font-bold text-slate-600 mb-1.5">الملاحظات الداخلية</p>
                              <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">{r.internalNotes}</p>
                            </div>
                          )}

                          {r.products.length > 0 && (
                            <div className="bg-white rounded-lg border border-slate-100 p-3">
                              <p className="text-[11px] font-bold text-slate-600 mb-1.5">المنتجات المرتبطة</p>
                              <div className="flex flex-wrap gap-1.5">
                                {r.products.map((p) => (
                                  <span key={p.id} className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold">{p.nameAr || p.name || p.sku}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {r.bonusLedger.length > 0 && (
                            <div className="bg-white rounded-lg border border-slate-100 overflow-hidden">
                              <p className="px-3 py-2 text-[11px] font-bold text-slate-600 border-b border-slate-50">سجل البونصات</p>
                              {r.bonusLedger.map((b) => (
                                <div key={b.id} className="flex items-center justify-between px-3 py-2 border-b border-slate-50 last:border-0">
                                  <span className="text-[11px] text-slate-500">طلب {b.orderNumber} · {formatDate(b.createdAt)}</span>
                                  <span className={`text-[11px] font-bold ${b.status === "PAID" ? "text-emerald-700" : "text-amber-700"}`}>{formatCurrency(b.amount)} · {b.status === "PAID" ? "مصروف" : "مستحق"}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === "settings" && sf && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-extrabold text-slate-900">إعدادات حملة الموردين</p>
                  <p className="text-[11px] text-slate-500">تطبَّق على الموردين الجدد الذين يتم تفعيلهم بعد الحفظ</p>
                </div>
                <button
                  onClick={() => setSf({ ...sf, enabled: !sf.enabled })}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all ${sf.enabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}
                >
                  {sf.enabled ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                  {sf.enabled ? "الحملة مفعّلة" : "الحملة متوقفة"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>البونص لكل طلب مؤهل (ج)</label>
                  <input type="number" min="0" step="0.5" className={inputCls} value={sf.bonusPerOrder} onChange={(e) => setSf({ ...sf, bonusPerOrder: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className={labelCls}>مدة الحملة لكل مورد (أيام)</label>
                  <input type="number" min="1" className={inputCls} value={sf.durationDays} onChange={(e) => setSf({ ...sf, durationDays: parseInt(e.target.value) || 1 })} />
                </div>
                <label className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3 cursor-pointer">
                  <input type="checkbox" checked={sf.includeCollected} onChange={(e) => setSf({ ...sf, includeCollected: e.target.checked })} className="accent-blue-600" />
                  <span className="text-[12px] font-semibold text-slate-700">احتساب طلبات التحصيل (COLLECTED) في البونص</span>
                </label>
                <div className="flex items-center justify-between gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                  <span className="text-[12px] font-semibold text-slate-700">الحد الأدنى من الطلبات المؤهلة</span>
                  <input type="number" min="0" className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500/30" value={sf.minEligibleOrders} onChange={(e) => setSf({ ...sf, minEligibleOrders: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className={labelCls}>الحد الأقصى للبونص لكل مورد (اختياري)</label>
                  <input type="number" min="0" className={inputCls} value={sf.maxBonusPerSupplier ?? ""} onChange={(e) => setSf({ ...sf, maxBonusPerSupplier: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })} placeholder="بدون حد" />
                </div>
                <div>
                  <label className={labelCls}>الحد الأقصى الإجمالي للحملة (اختياري)</label>
                  <input type="number" min="0" className={inputCls} value={sf.maxTotalBonus ?? ""} onChange={(e) => setSf({ ...sf, maxTotalBonus: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })} placeholder="بدون حد" />
                </div>
                <div>
                  <label className={labelCls}>بداية الحملة العامة (اختياري)</label>
                  <DateTimePicker
                    value={sf.campaignStart ? new Date(sf.campaignStart) : null}
                    onChange={(d) => setSf({ ...sf, campaignStart: d.toISOString() })}
                    now={new Date()}
                  />
                </div>
                <div>
                  <label className={labelCls}>نهاية الحملة العامة (اختياري)</label>
                  <DateTimePicker
                    value={sf.campaignEnd ? new Date(sf.campaignEnd) : null}
                    onChange={(d) => setSf({ ...sf, campaignEnd: d.toISOString() })}
                    now={new Date()}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-500">المدة تُحسب من تاريخ تفعيل المورد (بدء حملة كل مورد من تفعيله).</p>
                <button
                  onClick={saveSettings}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 text-white text-[12px] font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  حفظ الإعدادات
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action modal */}
      <BottomSheet
        open={!!actionRef}
        onClose={() => setActionRef(null)}
        title={
          actionMode === "status" ? `تغيير حالة «${actionRef?.supplierName}»` :
          actionMode === "notes" ? `إضافة ملاحظة على «${actionRef?.supplierName}»` :
          actionMode === "link" ? `ربط المنتجات بـ «${actionRef?.supplierName}»` :
          `صرف بونص «${actionRef?.supplierName}»`
        }
        icon={actionMode === "status" ? Check : actionMode === "notes" ? MessageSquare : actionMode === "link" ? Link2 : Wallet}
        tint={actionMode === "pay" ? "#059669" : "#2563eb"}
        maxWidth="max-w-xl"
      >
        {actionMode === "status" && (
          <div className="px-5 py-5 space-y-4">
            <p className="text-[12px] text-slate-500">اختر الحالة الجديدة للمورد. عند اختيار «نشط» تُحسب مدة الحملة تلقائيًا من لحظة التفعيل.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STATUS_FLOW.concat([SUPPLIER_STATUS.REJECTED]).map((s) => (
                <button
                  key={s}
                  onClick={() => setTargetStatus(s)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-bold border transition-all ${targetStatus === s ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {supplierStatusLabel(s)}
                </button>
              ))}
            </div>
            {targetStatus === SUPPLIER_STATUS.REJECTED && (
              <div>
                <label className={labelCls}>سبب الرفض (يُرسل للمسوق) *</label>
                <textarea rows={2} className={`${inputCls} resize-none`} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="مثال: المورد غير متوافق مع سياسات المنصة" />
              </div>
            )}
            {targetStatus === SUPPLIER_STATUS.ACTIVE && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-3 text-[11px] text-emerald-800 font-medium">
                <Zap size={14} className="shrink-0 mt-0.5" />
                سيبدأ احتساب البونصات من الآن وحتى نهاية مدة الحملة — لن تُحتسب الطلبات السابقة على التفعيل.
              </div>
            )}
          </div>
        )}

        {actionMode === "notes" && (
          <div className="px-5 py-5">
            <label className={labelCls}>الملاحظة الداخلية</label>
            <textarea rows={4} className={`${inputCls} resize-none`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة تظهر في سجل المورد ولا تُرسل للمسوق..." />
          </div>
        )}

        {actionMode === "link" && (
          <div className="px-5 py-5">
            <p className="text-[12px] text-slate-500 mb-3">اختر المنتجات التي تُنسب إلى هذا المورد — الطلبات التي تحتويها تُحتسب ضمن حملته.</p>
            {productOptions.length === 0 ? (
              <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-600" /></div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {productOptions.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(p.id)}
                      onChange={(e) => setSelectedProducts((prev) => e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id))}
                      className="accent-blue-600"
                    />
                    <span className="text-[12px] font-semibold text-slate-700 truncate">{p.nameAr || p.name || p.sku}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {actionMode === "pay" && actionRef && (
          <div className="px-5 py-5">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 text-center">
              <Wallet size={28} className="mx-auto text-emerald-600 mb-2" />
              <p className="text-[13px] text-slate-600 mb-1">إجمالي البونص المستحق للمسوق <span className="font-bold">{actionRef.affiliate?.name || actionRef.affiliate?.email}</span></p>
              <p className="text-3xl font-extrabold text-emerald-700">{formatCurrency(actionRef.earned)}</p>
              <p className="text-[11px] text-slate-500 mt-2">سيُضاف المبلغ إلى رصيد المسوق ويصبح متاحًا للسحب فورًا.</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <button onClick={() => setActionRef(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            إلغاء
          </button>
          <button
            onClick={runAction}
            disabled={
              submitting ||
              (actionMode === "status" && targetStatus === SUPPLIER_STATUS.REJECTED && !rejectReason.trim()) ||
              (actionMode === "notes" && !note.trim())
            }
            className={`flex-1 px-4 py-2.5 rounded-xl text-white text-[12px] font-bold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${actionMode === "pay" ? "bg-emerald-600" : "bg-gradient-to-l from-blue-600 to-indigo-600"}`}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {actionMode === "status" ? "تأكيد تغيير الحالة" : actionMode === "pay" ? `صرف ${formatCurrency(actionRef?.earned || 0)}` : actionMode === "notes" ? "إضافة الملاحظة" : "تأكيد الربط"}
          </button>
        </div>
      </BottomSheet>
    </RequirePerms>
  )
}
