import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { INCENTIVE_COUNT_STATUSES, campaignLevels, currentValue, goalLabel, campaignStatusLabel } from "@/lib/incentives"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("incentives.view")
    if (guard instanceof NextResponse) return guard

    const campaigns = await prisma.incentiveCampaign.findMany({
      include: {
        targets: { select: { affiliateId: true } },
        rewards: {
          include: { affiliate: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const enriched = await Promise.all(
      campaigns.map(async (c) => {
        const orders = await prisma.order.findMany({
          where: { status: { in: [...INCENTIVE_COUNT_STATUSES] }, createdAt: { gte: c.startDate, lte: c.endDate } },
          select: { affiliateId: true, total: true },
        })
        const byAff = new Map<string, { count: number; sum: number }>()
        for (const o of orders) {
          const e = byAff.get(o.affiliateId) || { count: 0, sum: 0 }
          e.count++
          e.sum += o.total
          byAff.set(o.affiliateId, e)
        }
        const levels = campaignLevels(c)
        const topGoal = levels.length ? levels[levels.length - 1].threshold : c.goalValue
        const participants = [...byAff.entries()].map(([id, v]) => ({
          affiliateId: id,
          count: v.count,
          sum: v.sum,
          value: currentValue(c, v),
        }))
        const achievers = participants.filter((p) => topGoal > 0 && p.value >= topGoal)
        const nearGoal = participants.filter((p) => topGoal > 0 && p.value < topGoal && (p.value / topGoal) * 100 >= 80)
        const totalDue = c.rewards.filter((r) => r.status !== "PAID").reduce((s, r) => s + r.amount, 0)
        const totalPaid = c.rewards.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0)
        return {
          ...c,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate.toISOString(),
          levels,
          participantCount: Math.max(c.targets.length, participants.length),
          activeParticipantCount: participants.length,
          achieverCount: new Set([...achievers.map((a) => a.affiliateId), ...c.rewards.map((r) => r.affiliateId)]).size,
          achievers: achievers.map((a) => a.affiliateId),
          nearGoalCount: nearGoal.length,
          totalDue,
          totalPaid,
          rewardCount: c.rewards.length,
          statusLabel: campaignStatusLabel(c.status),
        }
      }),
    )

    const rewards = await prisma.incentiveReward.findMany({
      include: {
        affiliate: { select: { id: true, name: true, email: true } },
        campaign: { select: { id: true, name: true, goalType: true } },
        processedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const allRewards = enriched.flatMap((c) => c.rewards)
    const summary = {
      activeCampaigns: enriched.filter((c) => c.status === "ACTIVE" && c.isActive).length,
      endedCampaigns: enriched.filter((c) => c.status === "ENDED" || c.endDate < new Date().toISOString()).length,
      totalDue: allRewards.filter((r) => r.status !== "PAID").reduce((s, r) => s + r.amount, 0),
      totalPaid: allRewards.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0),
      totalRewards: allRewards.length,
      participants: enriched.reduce((s, c) => s + c.participantCount, 0),
    }

    return NextResponse.json({
      summary,
      campaigns: enriched,
      rewards: rewards.map((r) => ({
        id: r.id,
        amount: r.amount,
        threshold: r.threshold,
        levelIndex: r.levelIndex,
        status: r.status,
        statusLabel: r.status === "PAID" ? "تم الصرف" : r.status === "REVIEW" ? "قيد المراجعة" : "مستحقة",
        notes: r.notes,
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        affiliate: r.affiliate,
        campaign: r.campaign,
        processedBy: r.processedBy,
      })),
    })
  } catch (error) {
    console.error("admin incentives GET error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("incentives.create")
    if (guard instanceof NextResponse) return guard

    const body = await req.json()
    const {
      name, description, goalType, goalValue, rewardType, levels, rewardAmount,
      startDate, endDate, targetType, affiliateIds,
    } = body

    if (!name?.trim()) return NextResponse.json({ error: "اسم الحملة مطلوب" }, { status: 400 })
    const goal = Number(goalValue)
    if (!Number.isFinite(goal) || goal <= 0) {
      return NextResponse.json({ error: "قيمة الهدف غير صحيحة" }, { status: 400 })
    }
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: "التاريخ أو الوقت المُدخل غير صحيح" }, { status: 400 })
    }
    if (start >= end) {
      return NextResponse.json({ error: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء" }, { status: 400 })
    }

    const gType = ["ORDER_COUNT", "SALES_VALUE", "POINTS"].includes(goalType) ? goalType : "ORDER_COUNT"
    const rType = rewardType === "ONCE" ? "ONCE" : "LEVELS"
    const tType = targetType === "SPECIFIC" ? "SPECIFIC" : "ALL"

    let levelsData: { threshold: number; reward: number }[] = []
    if (rType === "LEVELS") {
      const arr = Array.isArray(levels) ? levels : []
      levelsData = arr
        .map((l: any) => ({ threshold: Number(l.threshold), reward: Number(l.reward) }))
        .filter((l) => Number.isFinite(l.threshold) && Number.isFinite(l.reward) && l.threshold > 0 && l.reward >= 0)
        .sort((a, b) => a.threshold - b.threshold)
      if (!levelsData.length) {
        return NextResponse.json({ error: "أضف مستوى واحدًا على الأقل بقيمة ومكافأة" }, { status: 400 })
      }
    }

    let affiliateIdsList: string[] = []
    if (tType === "SPECIFIC") {
      affiliateIdsList = (Array.isArray(affiliateIds) ? affiliateIds : []).filter(Boolean)
      if (!affiliateIdsList.length) {
        return NextResponse.json({ error: "اختر مسوقًا واحدًا على الأقل للحملة المحددة" }, { status: 400 })
      }
      const valid = await prisma.user.count({ where: { id: { in: affiliateIdsList }, role: "AFFILIATE" } })
      if (valid !== affiliateIdsList.length) {
        return NextResponse.json({ error: "أحد المسوقين المختارين غير موجود" }, { status: 400 })
      }
    }

    const campaign = await prisma.incentiveCampaign.create({
      data: {
        name: name.trim(),
        description: description || null,
        goalType: gType,
        goalValue: goal,
        rewardType: rType,
        levels: JSON.stringify(levelsData),
        rewardAmount: rType === "ONCE" ? Number(rewardAmount) || 0 : null,
        startDate: start,
        endDate: end,
        targetType: tType,
        status: "ACTIVE",
        isActive: true,
        targets: tType === "SPECIFIC"
          ? { create: affiliateIdsList.map((affiliateId) => ({ affiliateId })) }
          : undefined,
      },
    })

    await logActivity(
      guard.actor.id,
      "INCENTIVE_CAMPAIGN_CREATED",
      "incentives",
      `إنشاء حملة "${campaign.name}" — الهدف ${goal} ${goalLabel(gType)}`,
    )

    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    console.error("admin incentives POST error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
