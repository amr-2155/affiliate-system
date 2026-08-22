"use client"
import { useEffect, useMemo, useState } from "react"
import {
  Trophy, Plus, Loader2, X, Pencil, Trash2, Target, Coins, Users, CheckCircle2,
  AlertTriangle, CalendarDays, Play, Pause, Ban, Wallet, Hash, Medal, PartyPopper, Clock, CalendarRange,
} from "lucide-react"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import { useToast } from "@/components/Toast"
import DateTimePicker from "@/components/admin/DateTimePicker"

interface Campaign {
  id: string
  name: string
  description?: string | null
  goalType: string
  goalValue: number
  rewardType: string
  levels: { threshold: number; reward: number }[]
  rewardAmount?: number | null
  startDate: string
  endDate: string
  targetType: string
  status: string
  isActive: boolean
  statusLabel: string
  participantCount: number
  activeParticipantCount: number
  achieverCount: number
  nearGoalCount: number
  totalDue: number
  totalPaid: number
  rewardCount: number
}

interface Reward {
  id: string
  amount: number
  threshold: number
  levelIndex: number
  status: string
  statusLabel: string
  notes?: string | null
  paidAt?: string | null
  createdAt: string
  affiliate: { id: string; name: string; email: string }
  campaign: { id: string; name: string; goalType: string }
  processedBy?: { id: string; name: string } | null
}

const GOAL_TYPE_META: Record<string, { label: string; unit: string }> = {
  ORDER_COUNT: { label: "عدد الأوردرات", unit: "أوردر" },
  SALES_VALUE: { label: "قيمة المبيعات", unit: "ج" },
  POINTS: { label: "النقاط", unit: "نقطة" },
}

const REWARD_STATUS_META: Record<string, { label: string; cls: string }> = {
  DUE: { label: "مستحقة", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70" },
  REVIEW: { label: "قيد المراجعة", cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/70" },
  PAID: { label: "تم الصرف", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70" },
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "نشطة", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70" },
  PAUSED: { label: "موقوفة", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70" },
  ENDED: { label: "منتهية", cls: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/70" },
}

export default function AdminIncentivesPage() {
  const perms = usePermissions()
  const can = perms.can
  const { toast } = useToast()

  const [tab, setTab] = useState<"active" | "ended" | "rewards">("active")
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    fetch("/api/admin/incentives")
      .then((r) => r.json())
      .then((d) => {
        setCampaigns(d.campaigns || [])
        setRewards(d.rewards || [])
        setSummary(d.summary || {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const activeCampaigns = useMemo(() => campaigns.filter((c) => c.status === "ACTIVE" && c.isActive), [campaigns])
  const endedCampaigns = useMemo(() => campaigns.filter((c) => c.status === "ENDED" || !c.isActive), [campaigns])

  const toggleStatus = async (c: Campaign, status: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/incentives/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const d = await res.json()
      if (res.ok) {
        toast(status === "ENDED" ? "تم إنهاء الحملة" : status === "PAUSED" ? "تم إيقاف الحملة" : "تم تفعيل الحملة", "success")
        load()
      } else toast(d.error || "تعذر تحديث الحملة", "error")
    } catch {
      toast("حدث خطأ", "error")
    }
    setSubmitting(false)
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/incentives/${deleteTarget.id}`, { method: "DELETE" })
      const d = await res.json()
      if (res.ok) {
        toast("تم حذف الحملة", "success")
        setDeleteTarget(null)
        load()
      } else toast(d.error || "تعذر الحذف", "error")
    } catch {
      toast("حدث خطأ", "error")
    }
    setSubmitting(false)
  }

  const setRewardStatus = async (r: Reward, status: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/incentives/rewards/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const d = await res.json()
      if (res.ok) {
        toast(status === "PAID" ? `تم صرف ${formatCurrency(r.amount)} وإضافتها للرصيد` : "تم تحويل المكافأة إلى قيد المراجعة", "success")
        load()
      } else toast(d.error || "تعذر تحديث المكافأة", "error")
    } catch {
      toast("حدث خطأ", "error")
    }
    setSubmitting(false)
  }

  const tabs = [
    { key: "active" as const, label: `الحملات النشطة (${activeCampaigns.length})` },
    { key: "ended" as const, label: `الحملات المنتهية (${endedCampaigns.length})` },
    { key: "rewards" as const, label: `المكافآت (${rewards.length})` },
  ]

  const summaryCards = [
    { label: "حملات نشطة", value: summary.activeCampaigns ?? 0, icon: Play, tint: "#059669", cls: "from-emerald-500 to-teal-500" },
    { label: "حملات منتهية", value: summary.endedCampaigns ?? 0, icon: Ban, tint: "#64748b", cls: "from-slate-400 to-slate-500" },
    { label: "مسوقون مشاركون", value: summary.participants ?? 0, icon: Users, tint: "#2563eb", cls: "from-blue-500 to-indigo-500" },
    { label: "مكافآت مستحقة", value: formatCurrency(summary.totalDue ?? 0), icon: Wallet, tint: "#d97706", cls: "from-amber-500 to-orange-500" },
    { label: "مكافآت مصروفة", value: formatCurrency(summary.totalPaid ?? 0), icon: CheckCircle2, tint: "#7c3aed", cls: "from-violet-500 to-purple-500" },
  ]

  return (
    <RequirePerms perm="incentives.view">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #b45309, #f59e0b)" }}>
              <Trophy size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">الحوافز والمكافآت</h1>
              <p className="text-[12px] text-slate-500">حملات تحفيزية محسوبة من الأوردرات المسلّمة/المحصلة فعليًا</p>
            </div>
          </div>
          {can("incentives.create") && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-amber-500 to-orange-600 text-white rounded-xl text-[12px] font-bold shadow-sm hover:shadow-md hover:brightness-105 transition-all"
            >
              <Plus size={15} />
              حملة جديدة
            </button>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {summaryCards.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.cls} text-white flex items-center justify-center shadow-sm mb-2.5`}>
                <s.icon size={16} />
              </div>
              <p className="text-[11px] text-slate-500 font-bold">{s.label}</p>
              <p className="text-lg font-extrabold text-slate-900 tabular-nums mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-50/80 rounded-xl border border-slate-100 overflow-x-auto scrollbar-none w-fit max-w-full">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-[10px] text-[12px] font-bold whitespace-nowrap transition-all ${tab === t.key ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-white rounded-2xl border border-slate-100 animate-pulse" />)}
          </div>
        ) : tab === "rewards" ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {rewards.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Trophy size={32} className="text-slate-200" />
                <p className="text-[14px] font-bold text-slate-600">لا توجد مكافآت بعد</p>
                <p className="text-[12px] text-slate-400">ستظهر هنا المكافآت المستحقة عند تحقيق المسوقين لأهداف الحملات</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {rewards.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${r.status === "PAID" ? "bg-emerald-50 text-emerald-500" : r.status === "REVIEW" ? "bg-blue-50 text-blue-500" : "bg-amber-50 text-amber-500"}`}>
                        <Trophy size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-800 truncate">
                          {r.affiliate.name} — <span className="text-amber-600">{formatCurrency(r.amount)}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          حملة "{r.campaign.name}" · {formatDate(r.createdAt)}
                          {r.processedBy ? ` · بواسطة ${r.processedBy.name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${REWARD_STATUS_META[r.status]?.cls || REWARD_STATUS_META.DUE.cls}`}>{r.statusLabel}</span>
                      {can("incentives.manage") && r.status === "DUE" && (
                        <button
                          onClick={() => setRewardStatus(r, "REVIEW")}
                          disabled={submitting}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-60"
                        >
                          قيد المراجعة
                        </button>
                      )}
                      {can("incentives.manage") && r.status !== "PAID" && (
                        <button
                          onClick={() => setRewardStatus(r, "PAID")}
                          disabled={submitting}
                          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-60 flex items-center gap-1"
                        >
                          <Wallet size={11} /> صرف
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(tab === "active" ? activeCampaigns : endedCampaigns).length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Trophy size={32} className="text-slate-200" />
                <p className="text-[14px] font-bold text-slate-600">{tab === "active" ? "لا توجد حملات نشطة" : "لا توجد حملات منتهية"}</p>
                {tab === "active" && can("incentives.create") && (
                  <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[12px] font-bold hover:bg-indigo-700 transition-colors">
                    أنشئ أول حملة
                  </button>
                )}
              </div>
            ) : (
              (tab === "active" ? activeCampaigns : endedCampaigns).map((c) => {
                const goal = GOAL_TYPE_META[c.goalType]
                const levels = c.levels.length ? c.levels : [{ threshold: c.goalValue, reward: c.rewardAmount || 0 }]
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                          <Trophy size={18} className="text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-[14px] font-extrabold text-slate-900">🏆 {c.name}</h3>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_META[c.status]?.cls || STATUS_META.ACTIVE.cls}`}>{c.statusLabel}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{c.description || "—"}</p>
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                            <CalendarDays size={11} /> {formatDateTime(c.startDate)} ← {formatDateTime(c.endDate)} · {c.targetType === "SPECIFIC" ? "لمسوقين محددين" : "لكل المسوقين"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {tab === "active" ? (
                          <>
                            {can("incentives.update") && (
                              <>
                                <button onClick={() => toggleStatus(c, "PAUSED")} disabled={submitting} title="إيقاف مؤقت"
                                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors disabled:opacity-60">
                                  <Pause size={14} />
                                </button>
                                <button onClick={() => toggleStatus(c, "ENDED")} disabled={submitting} title="إنهاء الحملة"
                                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-60">
                                  <Ban size={14} />
                                </button>
                              </>
                            )}
                            {can("incentives.delete") && (
                              <button onClick={() => setDeleteTarget(c)} title="حذف"
                                className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        ) : (
                          can("incentives.update") && c.status === "PAUSED" && (
                            <button onClick={() => toggleStatus(c, "ACTIVE")} disabled={submitting}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                              <Play size={12} /> إعادة تفعيل
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Goal + levels */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50/60 border border-slate-100">
                        <Target size={14} className="text-amber-500 shrink-0" />
                        <span className="text-[11px] text-slate-600">الهدف: <span className="font-extrabold text-slate-800">{c.goalValue.toLocaleString("ar-EG")} {goal.unit}</span> — {goal.label}</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50/60 border border-slate-100">
                        <Coins size={14} className="text-emerald-500 shrink-0" />
                        <span className="text-[11px] text-slate-600">المكافآت: <span className="font-extrabold text-slate-800">{levels.map((l) => formatCurrency(l.reward)).join(" + ")}</span></span>
                      </div>
                    </div>

                    {/* Stats chips */}
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 ring-1 ring-slate-100 text-[11px] font-bold text-slate-600">
                        <Users size={12} className="text-blue-500" /> {c.participantCount} مشارك
                      </span>
                      <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ring-1 text-[11px] font-bold ${c.achieverCount > 0 ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70" : "bg-slate-50 text-slate-500 ring-slate-100"}`}>
                        <PartyPopper size={12} /> {c.achieverCount} حقق الهدف
                      </span>
                      <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ring-1 text-[11px] font-bold ${c.nearGoalCount > 0 ? "bg-amber-50 text-amber-700 ring-amber-200/70" : "bg-slate-50 text-slate-500 ring-slate-100"}`}>
                        <AlertTriangle size={12} /> {c.nearGoalCount} اقترب من الهدف
                      </span>
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-200/70 text-[11px] font-bold">
                        <Wallet size={12} /> مستحق {formatCurrency(c.totalDue)}
                      </span>
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70 text-[11px] font-bold">
                        <CheckCircle2 size={12} /> مصروف {formatCurrency(c.totalPaid)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-slate-900">حذف الحملة "{deleteTarget.name}"؟</h3>
                <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">سيتم حذف الحملة وجميع مكافآتها واشتراكاتها نهائيًا. لا يمكن التراجع.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                إلغاء
              </button>
              <button onClick={doDelete} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[12px] font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60">
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </RequirePerms>
  )
}

function CreateCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [affiliates, setAffiliates] = useState<{ id: string; name: string; email: string }[]>([])
  const [loadingAffiliates, setLoadingAffiliates] = useState(false)

  const [form, setForm] = useState({
    name: "",
    description: "",
    goalType: "ORDER_COUNT",
    goalValue: "1000",
    rewardType: "LEVELS",
    rewardAmount: "",
    targetType: "ALL",
  })
  const [levels, setLevels] = useState([{ threshold: "500", reward: "200" }, { threshold: "1000", reward: "500" }, { threshold: "2000", reward: "1200" }])
  const [selectedAffiliates, setSelectedAffiliates] = useState<string[]>([])

  // الوقت الحقيقي من الخادم + تواريخ افتراضية (البداية = الآن، النهاية = بعد ٧ أيام)
  const [serverNow, setServerNow] = useState<Date | null>(null)
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [durationDays, setDurationDays] = useState("7")
  const [dateError, setDateError] = useState("")
  const [dateInfo, setDateInfo] = useState("")
  const [serverNotice, setServerNotice] = useState("")

  const DAY_MS = 86400000
  const daysBetween = useMemo(() => {
    if (!startDate || !endDate) return 0
    const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime()
    const e = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime()
    return Math.round((e - s) / DAY_MS)
  }, [startDate, endDate])

  // تعديل البداية يُبقي المدة بالايام محفوظة ويضبط الانتهاء تلقائيًا
  const setStart = (d: Date) => {
    setStartDate(d)
    const n = parseInt(durationDays, 10)
    if (!Number.isNaN(n) && n >= 0) setEndDate(new Date(d.getTime() + n * DAY_MS))
  }

  // اختيار الانتهاء من المنتقي يحدّث عدد الايام تلقائيًا
  const setEnd = (d: Date) => {
    setEndDate(d)
    if (startDate) {
      const s = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime()
      const e = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      setDurationDays(String(Math.round((e - s) / DAY_MS)))
    }
  }

  // خانة عدد الايام: ضبط تاريخ الانتهاء تلقائيًا
  const onDurationChange = (v: string) => {
    setDurationDays(v)
    const n = parseInt(v, 10)
    if (!Number.isNaN(n) && n >= 0 && startDate) setEndDate(new Date(startDate.getTime() + n * DAY_MS))
  }

  const loadAffiliates = () => {
    setLoadingAffiliates(true)
    fetch("/api/admin/affiliates?limit=500")
      .then((r) => r.json())
      .then((d) => {
        setAffiliates(Array.isArray(d) ? d : [])
        setLoadingAffiliates(false)
      })
      .catch(() => setLoadingAffiliates(false))
  }

  useEffect(() => {
    if (form.targetType === "SPECIFIC") loadAffiliates()
  }, [form.targetType])

  // تحميل وقت الخادم الحقيقي لحظة فتح النموذج (وليس قيمة ثابتة)
  useEffect(() => {
    let cancelled = false
    fetch("/api/server-time")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const now = new Date(d.now)
        if (Number.isNaN(now.getTime())) throw new Error("invalid server time")
        setServerNow(now)
        setStartDate(new Date(now.getTime()))
        setEndDate(new Date(now.getTime() + 7 * 86400000))
      })
      .catch(() => {
        if (cancelled) return
        const now = new Date()
        setServerNow(now)
        setStartDate(new Date(now.getTime()))
        setEndDate(new Date(now.getTime() + 7 * 86400000))
        setServerNotice("تعذر الاتصال بالخادم — تم استخدام وقت الجهاز الحالي")
      })
    return () => {
      cancelled = true
    }
  }, [])

  // تحقق حي: منع تاريخ نهاية قبل البداية، وتنبيه للحملات التي بدأت أو انتهت فعليًا
  useEffect(() => {
    if (!serverNow) {
      setDateError("")
      setDateInfo("جاري تحميل وقت الخادم...")
      return
    }
    if (!startDate || !endDate) {
      setDateError("أدخل تاريخ البدء وتاريخ الانتهاء")
      setDateInfo("")
      return
    }
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setDateError("التاريخ المُدخل غير صحيح")
      setDateInfo("")
      return
    }
    if (endDate.getTime() <= startDate.getTime()) {
      setDateError("تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء")
      setDateInfo("")
      return
    }
    setDateError("")
    // سلوك صحيح للحملات التي بدأت أو انتهت فعليًا (وفق وقت الخادم)
    const tolerance = 60 * 1000
    if (startDate.getTime() <= serverNow.getTime() - tolerance) {
      setDateInfo("⚠️ الحملة بدأت بالفعل — ستُفعل فورًا ويُحسب الإنجاز من تاريخ البدء")
    } else if (endDate.getTime() <= serverNow.getTime()) {
      setDateInfo("⚠️ تاريخ الانتهاء قد مضى بالفعل — الحملة ستنتهي فورًا")
    } else {
      setDateInfo("")
    }
  }, [serverNow, startDate, endDate])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const toggleAffiliate = (id: string) =>
    setSelectedAffiliates((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const submit = async () => {
    if (!serverNow || !startDate || !endDate || !!dateError) return
    setSubmitting(true)
    try {
      const body: any = {
        name: form.name,
        description: form.description,
        goalType: form.goalType,
        goalValue: form.goalValue,
        rewardType: form.rewardType,
        rewardAmount: form.rewardType === "ONCE" ? form.rewardAmount : undefined,
        startDate: new Date(startDate.getTime()).toISOString(),
        endDate: new Date(endDate.getTime()).toISOString(),
        targetType: form.targetType,
        affiliateIds: form.targetType === "SPECIFIC" ? selectedAffiliates : [],
      }
      if (form.rewardType === "LEVELS") {
        body.levels = levels
          .map((l) => ({ threshold: l.threshold, reward: l.reward }))
          .filter((l) => l.threshold.trim() !== "" && l.reward.trim() !== "")
      }
      const res = await fetch("/api/admin/incentives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (res.ok) {
        toast("تم إنشاء الحملة بنجاح 🏆", "success")
        onCreated()
      } else {
        toast(d.error || "تعذر إنشاء الحملة", "error")
      }
    } catch {
      toast("حدث خطأ أثناء إنشاء الحملة", "error")
    }
    setSubmitting(false)
  }

  const inputCls = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent focus:bg-white transition-all"
  const labelCls = "block text-[11px] font-bold text-slate-600 mb-1"

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-xl animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Trophy size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-extrabold text-slate-900">حملة تحفيزية جديدة</h2>
              <p className="text-[11px] text-slate-400">يُحسب الإنجاز من الأوردرات المسلّمة/المحصلة فقط</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={17} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={labelCls}>اسم الحملة *</label>
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: تحدي 1000 أوردر" />
          </div>
          <div>
            <label className={labelCls}>الوصف</label>
            <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="وصف الحملة والمكافآت" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>نوع الهدف</label>
              <select className={inputCls} value={form.goalType} onChange={(e) => set("goalType", e.target.value)}>
                <option value="ORDER_COUNT">عدد الأوردرات</option>
                <option value="SALES_VALUE">قيمة المبيعات</option>
                <option value="POINTS">النقاط</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{form.rewardType === "ONCE" ? "قيمة الهدف (المستوى الوحيد) *" : "الهدف الأقصى للحملة *"}</label>
              <input type="number" min={1} className={inputCls} value={form.goalValue} onChange={(e) => set("goalValue", e.target.value)} placeholder="1000" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>نظام المكافأة</label>
              <select className={inputCls} value={form.rewardType} onChange={(e) => set("rewardType", e.target.value)}>
                <option value="LEVELS">مستويات (500=200، 1000=500 ...)</option>
                <option value="ONCE">مكافأة واحدة عند الهدف</option>
              </select>
            </div>
            {form.rewardType === "ONCE" && (
              <div>
                <label className={labelCls}>قيمة المكافأة *</label>
                <input type="number" min={0} className={inputCls} value={form.rewardAmount} onChange={(e) => set("rewardAmount", e.target.value)} placeholder="500" />
              </div>
            )}
          </div>

          {form.rewardType === "LEVELS" && (
            <div>
              <label className={labelCls}>مستويات المكافأة (عدد الأوردرات = المكافأة)</label>
              <div className="space-y-2">
                {levels.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="number" min={1}
                      className={`${inputCls} flex-1`}
                      placeholder="عدد الأوردرات"
                      value={l.threshold}
                      onChange={(e) => setLevels((prev) => prev.map((x, xi) => (xi === i ? { ...x, threshold: e.target.value } : x)))}
                    />
                    <span className="text-slate-400 text-[12px]">=</span>
                    <input
                      type="number" min={0}
                      className={`${inputCls} flex-1`}
                      placeholder="المكافأة"
                      value={l.reward}
                      onChange={(e) => setLevels((prev) => prev.map((x, xi) => (xi === i ? { ...x, reward: e.target.value } : x)))}
                    />
                    <button onClick={() => setLevels((prev) => prev.filter((_, xi) => xi !== i))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setLevels((prev) => [...prev, { threshold: "", reward: "" }])}
                className="mt-2 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-[11px] font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors">
                <Plus size={13} /> إضافة مستوى
              </button>
            </div>
          )}

          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <CalendarRange size={13} className="text-amber-500" /> مدة الحملة
              </span>
              {startDate && endDate && (
                <span className="text-[11px] font-extrabold text-amber-700 bg-amber-100/70 px-2.5 py-1 rounded-lg tabular-nums">
                  {daysBetween} يوم
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>عدد الأيام *</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={durationDays}
                  onChange={(e) => onDurationChange(e.target.value)}
                  placeholder="مثال: 7"
                />
              </div>
              <div>
                <label className={labelCls}>تاريخ البدء *</label>
                <DateTimePicker
                  value={startDate}
                  onChange={setStart}
                  now={serverNow}
                  placeholder="اليوم / الآن تلقائيًا"
                  error={!!dateError}
                />
              </div>
              <div>
                <label className={labelCls}>تاريخ الانتهاء *</label>
                <DateTimePicker
                  value={endDate}
                  onChange={setEnd}
                  now={serverNow}
                  minDate={startDate}
                  placeholder="اختر تاريخ الانتهاء"
                  error={!!dateError}
                  info={startDate && endDate ? `المدة منذ البداية: ${daysBetween} يوم` : undefined}
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">غيّر "عدد الأيام" لضبط تاريخ الانتهاء تلقائيًا، أو اختر تاريخ الانتهاء من التقويم وسيُحدَّث عدد الأيام تلقائيًا.</p>
          </div>

          {dateError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100 text-[11px] font-bold text-red-600">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>{dateError}</span>
            </div>
          )}
          {!dateError && dateInfo && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-bold ${dateInfo.startsWith("⚠️") ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-slate-50 border-slate-100 text-slate-500"}`}>
              <Clock size={13} className="shrink-0 mt-0.5" />
              <span>{dateInfo}</span>
            </div>
          )}
          {serverNotice && !dateError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
              <Clock size={12} className="text-slate-400" /> {serverNotice}
            </div>
          )}

          <div>
            <label className={labelCls}>الفئة المستهدفة</label>
            <div className="flex items-center gap-2">
              {[
                { key: "ALL", label: "كل المسوقين" },
                { key: "SPECIFIC", label: "مسوقين محددين" },
              ].map((o) => (
                <button key={o.key} onClick={() => set("targetType", o.key)}
                  className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border transition-all ${form.targetType === o.key ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {form.targetType === "SPECIFIC" && (
            <div>
              <label className={labelCls}>اختر المسوقين</label>
              {loadingAffiliates ? (
                <div className="flex items-center gap-2 py-4 text-slate-400 text-[12px]"><Loader2 size={14} className="animate-spin" /> جاري تحميل المسوقين...</div>
              ) : affiliates.length === 0 ? (
                <p className="text-[12px] text-slate-400 py-2">لا يوجد مسوقون</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {affiliates.map((a) => {
                    const active = selectedAffiliates.includes(a.id)
                    return (
                      <button key={a.id} onClick={() => toggleAffiliate(a.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${active ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${active ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`}>
                          {active && <CheckCircle2 size={10} className="text-white" />}
                        </span>
                        <span className="truncate">{a.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            إلغاء
          </button>
          <button onClick={submit} disabled={submitting || !form.name.trim() || !startDate || !endDate || !!dateError || !serverNow}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-orange-600 text-white text-[12px] font-bold hover:brightness-105 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Trophy size={13} />}
            {submitting ? "جاري الإنشاء..." : "إنشاء الحملة"}
          </button>
        </div>
      </div>
    </div>
  )
}
