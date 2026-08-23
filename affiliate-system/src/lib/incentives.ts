import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"
import { zonedStartOfRelativeMonth } from "@/lib/time"
import { Prisma } from "@/generated/prisma/client"

/** حالات الأوردرات الصالحة فقط للاحتساب في الحوافز: تم التسليم/التحصيل فعليًا. */
export const INCENTIVE_COUNT_STATUSES = ["DELIVERED", "COLLECTED"] as const

export interface IncentiveLevel {
  threshold: number
  reward: number
}

export function parseLevels(levels: string | null | undefined): IncentiveLevel[] {
  try {
    const parsed: unknown = JSON.parse(levels || "[]")
    if (!Array.isArray(parsed)) return []
    return (parsed as unknown[])
      .map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>) : null))
      .filter((row): row is Record<string, unknown> =>
        row !== null
        && Number.isFinite(Number(row.threshold))
        && Number.isFinite(Number(row.reward)))
      .map((row) => ({ threshold: Number(row.threshold), reward: Number(row.reward) }))
      .sort((a: IncentiveLevel, b: IncentiveLevel) => a.threshold - b.threshold)
  } catch {
    return []
  }
}

export function campaignLevels(campaign: {
  rewardType: string
  levels: string
  goalValue: number
  rewardAmount: number | null
}): IncentiveLevel[] {
  const parsed = parseLevels(campaign.levels)
  if (parsed.length) return parsed
  if (campaign.rewardType === "ONCE" && campaign.goalValue > 0) {
    return [{ threshold: campaign.goalValue, reward: campaign.rewardAmount || 0 }]
  }
  return parsed
}

export function goalLabel(goalType: string): string {
  if (goalType === "SALES_VALUE") return "قيمة المبيعات"
  if (goalType === "POINTS") return "النقاط"
  return "عدد الأوردرات"
}

export function goalUnit(goalType: string): string {
  if (goalType === "ORDER_COUNT") return "أوردر"
  if (goalType === "POINTS") return "نقطة"
  return "جنيهاً"
}

export function rewardStatusLabel(status: string): string {
  if (status === "REVIEW") return "قيد المراجعة"
  if (status === "PAID") return "تم الصرف"
  return "مستحقة"
}

export function campaignStatusLabel(status: string): string {
  if (status === "PAUSED") return "موقوفة"
  if (status === "ENDED") return "منتهية"
  return "نشطة"
}

export interface CountResult {
  count: number
  sum: number | null
}

export async function countAffiliateOrders(
  affiliateId: string,
  startDate: Date,
  endDate: Date,
): Promise<CountResult> {
  const agg = await prisma.order.aggregate({
    where: {
      affiliateId,
      status: { in: [...INCENTIVE_COUNT_STATUSES] },
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: { _all: true },
    _sum: { total: true },
  })
  return { count: agg._count._all, sum: agg._sum.total }
}

export function currentValue(campaign: { goalType: string }, counts: CountResult): number {
  return campaign.goalType === "ORDER_COUNT" ? counts.count : counts.sum || 0
}

export async function getActiveCampaignsForAffiliate(affiliateId: string) {
  const now = new Date()
  return prisma.incentiveCampaign.findMany({
    where: {
      status: "ACTIVE",
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
      OR: [
        { targetType: "ALL" },
        { targetType: "SPECIFIC", targets: { some: { affiliateId } } },
      ],
    },
    orderBy: { startDate: "asc" },
    include: {
      rewards: {
        where: { affiliateId },
        select: { id: true, levelIndex: true, amount: true, status: true, createdAt: true },
      },
    },
  })
}

/**
 * Atomically claim a milestone for (campaign, affiliate).
 *
 * Concurrency-safe under PostgreSQL READ COMMITTED: the read-modify-write of
 * `milestonesNotified` is gated by an optimistic conditional updateMany on the
 * exact previously-read value; a concurrent writer flips count to 0 and we
 * retry with a fresh read. Returns true exactly once per milestone —
 * duplicates get false instead of double-notifying.
 */
export async function claimMilestone(campaignId: string, affiliateId: string, milestone: string): Promise<boolean> {
  const MAX_ATTEMPTS = 4
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const target = await tx.incentiveTarget.upsert({
          where: { campaignId_affiliateId: { campaignId, affiliateId } },
          create: { campaignId, affiliateId },
          update: {},
        })
        let notified: string[] = []
        try {
          notified = JSON.parse(target.milestonesNotified || "[]")
        } catch {
          notified = []
        }
        if (notified.includes(milestone)) return false
        const gate = await tx.incentiveTarget.updateMany({
          where: { id: target.id, milestonesNotified: target.milestonesNotified },
          data: { milestonesNotified: JSON.stringify([...notified, milestone]) },
        })
        return gate.count === 1
      })
    } catch {
      // P2002 (upsert create race) or serialization retry → fresh read next loop
    }
  }
  return false
}

/**
 * تقييم إنجازات المسوق في كل حملة نشطة وإنشاء المكافآت المستحقة مرة واحدة فقط
 * (منع التكرار عبر القيد الفريد campaignId+affiliateId+levelIndex).
 * يُستدعى عند وصول طلب إلى حالة تسليم/تحصيل وعند فتح لوحة المسوق.
 */
export async function evaluateAffiliateRewards(affiliateId: string): Promise<{ created: number; reminders: number }> {
  const campaigns = await getActiveCampaignsForAffiliate(affiliateId)
  let created = 0
  let reminders = 0

  for (const campaign of campaigns) {
    const counts = await countAffiliateOrders(affiliateId, campaign.startDate, campaign.endDate)
    const current = currentValue(campaign, counts)
    const levels = campaignLevels(campaign)
    if (!levels.length) continue

    // إنشاء المكافآت لكل مستوى تم الوصول إليه
    for (let i = 0; i < levels.length; i++) {
      if (current < levels[i].threshold) break
      const exists = await prisma.incentiveReward.findUnique({
        where: {
          campaignId_affiliateId_levelIndex: { campaignId: campaign.id, affiliateId, levelIndex: i },
        },
        select: { id: true },
      })
      if (exists) continue
      try {
        await prisma.incentiveReward.create({
          data: {
            campaignId: campaign.id,
            affiliateId,
            levelIndex: i,
            threshold: levels[i].threshold,
            amount: levels[i].reward,
            status: "DUE",
          },
        })
        notify({
          title: "🎉 مبروك! حققت مكافأة جديدة",
          message: `أنجزت هدف "${campaign.name}" وحصلت على مكافأة ${formatCurrency(levels[i].reward)} — مستحقة وستُصرف بعد مراجعة الإدارة.`,
          type: NOTIFICATION_TYPE.REWARD,
          userId: affiliateId,
          link: "/dashboard",
          relatedId: campaign.id,
        })
        created++
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue
        throw e
      }
    }

    // تذكير بالاقتراب من الهدف (المستوى التالي غير المحقق)
    const nextLevel = levels.find((l) => current < l.threshold)
    if (!nextLevel || nextLevel.threshold <= 0) continue
    if ((current / nextLevel.threshold) * 100 < 90) continue

    // Atomic claim — concurrent evaluations notify exactly once (PG-safe).
    const claimed = await claimMilestone(campaign.id, affiliateId, "90")
    if (!claimed) continue
    const remaining = Math.max(1, Math.ceil(nextLevel.threshold - current))
    notify({
      title: "أنت قريب جدًا من الهدف 🎯",
      message: `باقي ${remaining.toLocaleString("ar-EG")} ${goalUnit(campaign.goalType)} فقط وتحقق مكافأتك من حملة "${campaign.name}"`,
      type: NOTIFICATION_TYPE.REWARD,
      userId: affiliateId,
      link: "/dashboard",
      relatedId: campaign.id,
    })
    reminders++
  }

  return { created, reminders }
}

export async function getAffiliateChallenges(affiliateId: string) {
  await evaluateAffiliateRewards(affiliateId)
  const campaigns = await getActiveCampaignsForAffiliate(affiliateId)
  const challenges = await Promise.all(
    campaigns.map(async (campaign) => {
      const counts = await countAffiliateOrders(affiliateId, campaign.startDate, campaign.endDate)
      const levels = campaignLevels(campaign)
      const current = currentValue(campaign, counts)
      const next = levels.find((l) => current < l.threshold)
      const achieved = levels.filter((l) => current >= l.threshold)
      const nextGoal = next ? next.threshold : levels.length ? levels[levels.length - 1].threshold : campaign.goalValue
      const pct = nextGoal > 0 ? Math.min(100, Math.round((current / nextGoal) * 100)) : 100
      return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        goalType: campaign.goalType,
        goalLabel: goalLabel(campaign.goalType),
        goalUnit: goalUnit(campaign.goalType),
        rewardType: campaign.rewardType,
        levels,
        current,
        nextThreshold: next ? next.threshold : null,
        remaining: next ? Math.max(0, next.threshold - current) : 0,
        pct,
        done: !next && achieved.length > 0,
        achievedLevels: achieved,
        startDate: campaign.startDate.toISOString(),
        endDate: campaign.endDate.toISOString(),
        daysLeft: Math.max(0, Math.ceil((campaign.endDate.getTime() - Date.now()) / 86400000)),
        rewards: campaign.rewards.map((r) => ({
          id: r.id,
          levelIndex: r.levelIndex,
          amount: r.amount,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      }
    }),
  )
  return { challenges }
}

export async function getLeaderboard(limit = 10) {
  const now = new Date()
  // Cairo-time month window (see src/lib/time.ts — identical to prior local-time behavior)
  const start = zonedStartOfRelativeMonth(now, 0)
  const end = zonedStartOfRelativeMonth(now, 1)
  const orders = await prisma.order.findMany({
    where: { status: { in: [...INCENTIVE_COUNT_STATUSES] }, createdAt: { gte: start, lt: end } },
    select: { affiliateId: true, total: true },
  })
  const map = new Map<string, { count: number; sum: number }>()
  for (const o of orders) {
    const e = map.get(o.affiliateId) || { count: 0, sum: 0 }
    e.count++
    e.sum += o.total
    map.set(o.affiliateId, e)
  }
  const ids = [...map.keys()]
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : []
  const byId = Object.fromEntries(users.map((u) => [u.id, u]))
  return [...map.entries()]
    .map(([id, v]) => ({ id, name: byId[id]?.name || "مسوق", count: v.count, sum: v.sum }))
    .sort((a, b) => b.count - a.count || b.sum - a.sum)
    .slice(0, limit)
}

export async function getAffiliateRewards(affiliateId: string) {
  const rewards = await prisma.incentiveReward.findMany({
    where: { affiliateId },
    include: { campaign: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return rewards.map((r) => ({
    id: r.id,
    campaignId: r.campaignId,
    campaignName: r.campaign.name,
    levelIndex: r.levelIndex,
    threshold: r.threshold,
    amount: r.amount,
    status: r.status,
    statusLabel: rewardStatusLabel(r.status),
    paidAt: r.paidAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
  }))
}
