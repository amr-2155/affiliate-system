"use client"
import { useEffect, useState } from "react"
import { Trophy, Flame, Target, Clock, Coins, CheckCircle2, PartyPopper, Medal, Crown } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { DashboardPanel, DashboardEmptyState } from "@/components/DashboardPanel"

interface ChallengeLevel {
  threshold: number
  reward: number
}

interface Challenge {
  id: string
  name: string
  description?: string | null
  goalType: string
  goalLabel: string
  goalUnit: string
  rewardType: string
  levels: ChallengeLevel[]
  current: number
  nextThreshold: number | null
  remaining: number
  pct: number
  done: boolean
  achievedLevels: ChallengeLevel[]
  startDate: string
  endDate: string
  daysLeft: number
  rewards: { id: string; levelIndex: number; amount: number; status: string; createdAt: string }[]
}

interface Reward {
  id: string
  campaignName: string
  amount: number
  status: string
  statusLabel: string
  paidAt: string | null
  createdAt: string
}

const REWARD_STATUS_META: Record<string, { label: string; cls: string }> = {
  DUE: { label: "مستحقة", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70" },
  REVIEW: { label: "قيد المراجعة", cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/70" },
  PAID: { label: "تم الصرف", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70" },
}

const medalStyle = (i: number) =>
  i === 0
    ? "linear-gradient(135deg, #f59e0b, #fbbf24)"
    : i === 1
      ? "linear-gradient(135deg, #94a3b8, #cbd5e1)"
      : i === 2
        ? "linear-gradient(135deg, #b45309, #d97706)"
        : "linear-gradient(135deg, #f1f5f9, #e2e8f0)"

const medalIcon = (i: number) => (i === 0 ? <Crown size={16} className="text-white" /> : <Medal size={15} className={i >= 3 ? "text-slate-400" : "text-white"} />)

export default function IncentivesSection() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [leaderboard, setLeaderboard] = useState<{ id: string; name: string; count: number; sum: number }[]>([])

  const load = () => {
    setLoading(true)
    setError(false)
    fetch("/api/incentives")
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error)
        setChallenges(d.challenges || [])
        setRewards(d.rewards || [])
        setLeaderboard(d.leaderboard || [])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
  }, [])

  const hasAny = challenges.length > 0 || rewards.length > 0 || leaderboard.length > 0

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-64 bg-white rounded-2xl border border-slate-100 animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-slate-100 animate-pulse" />
      </div>
    )
  }

  if (error || !hasAny) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DashboardPanel title="التحديات والمكافآت" icon={Trophy} tint="#eab308" className="lg:col-span-2">
          <DashboardEmptyState
            icon={Trophy}
            title={error ? "تعذر تحميل التحديات" : "لا توجد تحديات حالية"}
            subtitle={error ? "حاول مرة أخرى لاحقًا" : "ستظهر هنا الحملات التحفيزية الموجهة إليك"}
          />
          {error && (
            <div className="flex justify-center pb-4">
              <button onClick={load} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[12px] font-bold hover:bg-indigo-700 transition-colors">
                إعادة المحاولة
              </button>
            </div>
          )}
        </DashboardPanel>
        <DashboardPanel title="ترتيب المسوقين" icon={Flame} tint="#f97316">
          <DashboardEmptyState icon={Flame} title="لا يوجد ترتيب بعد" subtitle="يُحسب من أوردرات الشهر المحصلة" />
        </DashboardPanel>
      </div>
    )
  }

  const dueCount = rewards.filter((r) => r.status === "DUE" || r.status === "REVIEW").length
  const paidTotal = rewards.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)" }}>
            <Trophy size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">التحديات والمكافآت</h2>
            <p className="text-[12px] text-slate-500">حقق أهدافك واكسب مكافآت إضافية 🎯</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {dueCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200/70 text-[11px] font-bold">
              <Coins size={13} /> {dueCount} مكافأة مستحقة
            </span>
          )}
          {paidTotal > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70 text-[11px] font-bold">
              <CheckCircle2 size={13} /> تم صرف {formatCurrency(paidTotal)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Challenges */}
        <div className="lg:col-span-2 space-y-3">
          {challenges.length === 0 ? (
            <DashboardPanel title="التحديات والمكافآت" icon={Trophy} tint="#eab308">
              <DashboardEmptyState icon={Trophy} title="لا توجد تحديات حالية" subtitle="ستظهر هنا الحملات التحفيزية الموجهة إليك" />
            </DashboardPanel>
          ) : (
            challenges.map((c) => {
              const meta = REWARD_STATUS_META
              const nextReward = c.nextThreshold !== null
                ? c.levels.find((l) => l.threshold === c.nextThreshold)
                : null
              return (
                <div key={c.id} className="relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  {c.done && (
                    <div className="absolute top-0 right-0 left-0 h-1.5" style={{ background: "linear-gradient(90deg, #f59e0b, #fbbf24, #34d399)" }} />
                  )}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${c.done ? "bg-gradient-to-br from-emerald-500 to-teal-500" : "bg-gradient-to-br from-yellow-500 to-amber-600"}`}>
                        {c.done ? <PartyPopper size={20} className="text-white" /> : <Target size={20} className="text-white" />}
                      </div>
                      <div>
                        <p className="text-[14px] font-extrabold text-slate-900">🏆 {c.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {c.goalLabel}: {c.current.toLocaleString("ar-EG")} / {c.nextThreshold?.toLocaleString("ar-EG") || c.levels[c.levels.length - 1]?.threshold.toLocaleString("ar-EG") || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${c.daysLeft === 0 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"}`}>
                        <Clock size={11} /> {c.daysLeft > 0 ? `متبقي ${c.daysLeft} يوم` : "تنتهي اليوم"}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-[10px] font-bold">{c.goalLabel}</span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-slate-500">نسبة التقدم</span>
                      <span className="text-[12px] font-extrabold text-slate-900 tabular-nums">{c.pct}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${c.pct}%`, background: c.done ? "linear-gradient(90deg, #059669, #34d399)" : "linear-gradient(90deg, #f59e0b, #fbbf24)" }}
                      />
                    </div>
                  </div>

                  {/* Remaining + reward */}
                  <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                    {c.nextThreshold !== null ? (
                      <p className="text-[12px] text-slate-600 flex items-center gap-1.5">
                        <Target size={13} className="text-amber-500" />
                        متبقي <span className="font-extrabold text-slate-900 tabular-nums">{c.remaining.toLocaleString("ar-EG")}</span> {c.goalUnit}
                      </p>
                    ) : (
                      <p className="text-[12px] font-bold text-emerald-600 flex items-center gap-1.5">
                        <CheckCircle2 size={13} /> أكملت كل أهداف الحملة!
                      </p>
                    )}
                    {nextReward && (
                      <p className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                        <Coins size={13} className="text-emerald-500" />
                        المكافأة التالية: <span className="text-emerald-600 tabular-nums">{formatCurrency(nextReward.reward)}</span>
                      </p>
                    )}
                  </div>

                  {/* Levels */}
                  {c.rewardType === "LEVELS" && c.levels.length > 1 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {c.levels.map((l) => {
                        const achieved = c.current >= l.threshold
                        const isNext = l.threshold === c.nextThreshold
                        return (
                          <div key={l.threshold} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] ${achieved ? "bg-emerald-50/60 border-emerald-100" : isNext ? "bg-amber-50/60 border-amber-200" : "bg-slate-50/60 border-slate-100"}`}>
                            {achieved ? (
                              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            ) : isNext ? (
                              <Target size={13} className="text-amber-500 shrink-0" />
                            ) : (
                              <span className="w-[13px] h-[13px] rounded-full border-2 border-slate-200 shrink-0" />
                            )}
                            <span className="font-bold text-slate-700">{l.threshold.toLocaleString("ar-EG")} {c.goalUnit}</span>
                            <span className="text-slate-400">—</span>
                            <span className="font-extrabold text-slate-900 tabular-nums">{formatCurrency(l.reward)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Achieved banner */}
                  {c.done && (
                    <div className="mt-3 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-gradient-to-l from-emerald-500/10 to-teal-500/10 ring-1 ring-emerald-200/60">
                      <PartyPopper size={16} className="text-emerald-600 shrink-0" />
                      <p className="text-[12px] font-bold text-emerald-700">🎉 مبروك! حققت هدف الحملة بالكامل — راجع مكافآتك أدناه</p>
                    </div>
                  )}

                  {/* This challenge's rewards */}
                  {c.rewards.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      {c.rewards.map((r) => (
                        <span key={r.id} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${meta[r.status]?.cls || meta.DUE.cls}`}>
                          {formatCurrency(r.amount)} — {meta[r.status]?.label || r.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}

          {/* Earned rewards */}
          {rewards.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Coins size={16} className="text-amber-500" />
                <h3 className="text-[13px] font-extrabold text-slate-800">مكافآتك المحققة</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {rewards.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-800 truncate">{r.campaignName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(r.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[13px] font-extrabold text-emerald-600 tabular-nums">{formatCurrency(r.amount)}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${REWARD_STATUS_META[r.status]?.cls || REWARD_STATUS_META.DUE.cls}`}>{r.statusLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">المكافآت المستحقة تُضاف إلى رصيدك فور اعتماد الصرف من الإدارة.</p>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <DashboardPanel title="ترتيب المسوقين هذا الشهر" icon={Flame} tint="#f97316" className="h-fit">
          {leaderboard.length === 0 ? (
            <DashboardEmptyState icon={Flame} title="لا يوجد ترتيب بعد" subtitle="يُحسب من الأوردرات المسلّمة/المحصلة" />
          ) : (
            <div className="space-y-2">
              {leaderboard.map((u, i) => (
                <div key={u.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${i === 0 ? "bg-gradient-to-l from-amber-50 to-yellow-50 border-amber-100" : "bg-slate-50/50 border-slate-100"}`}>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm" style={{ background: medalStyle(i) }}>
                    {medalIcon(i)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-extrabold text-slate-800 truncate">{i === 0 ? "🏆 " : ""}{u.name}</p>
                    <p className="text-[10px] text-slate-500 tabular-nums">{u.count.toLocaleString("ar-EG")} أوردر · {formatCurrency(u.sum)}</p>
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-400 tabular-nums">#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>
    </div>
  )
}
