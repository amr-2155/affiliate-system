import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { formatCurrency } from "@/lib/utils"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ rewardId: string }> }) {
  try {
    const guard = await requireAdminPermission("incentives.manage")
    if (guard instanceof NextResponse) return guard
    const { rewardId } = await params

    const reward = await prisma.incentiveReward.findUnique({
      where: { id: rewardId },
      include: { campaign: { select: { id: true, name: true } } },
    })
    if (!reward) return NextResponse.json({ error: "المكافأة غير موجودة" }, { status: 404 })

    const body = await req.json()
    const { status } = body

    if (status === "REVIEW") {
      if (reward.status === "PAID") {
        return NextResponse.json({ error: "لا يمكن التراجع عن مكافأة تم صرفها" }, { status: 400 })
      }
      const updated = await prisma.incentiveReward.update({
        where: { id: rewardId },
        data: { status: "REVIEW", reviewedAt: new Date(), processedById: guard.actor.id, processedAt: new Date() },
      })
      await logActivity(
        guard.actor.id,
        "INCENTIVE_REWARD_REVIEWED",
        "incentives",
        `تحويل مكافأة ${formatCurrency(reward.amount)} للمسوق إلى قيد المراجعة (حملة "${reward.campaign.name}")`,
      )
      return NextResponse.json(updated)
    }

    if (status === "PAID") {
      if (reward.status === "PAID") {
        return NextResponse.json({ error: "تم صرف هذه المكافأة مسبقًا" }, { status: 400 })
      }

      try {
        await prisma.$transaction(async (tx) => {
          const gate = await tx.incentiveReward.updateMany({
            where: { id: rewardId, status: { not: "PAID" } },
            data: { status: "PAID", paidAt: new Date(), processedById: guard.actor.id, processedAt: new Date() },
          })
          if (gate.count === 0) {
            throw new Error("ALREADY_PAID")
          }
          await tx.user.update({
            where: { id: reward.affiliateId },
            data: { balance: { increment: reward.amount }, totalEarnings: { increment: reward.amount } },
          })
        })
      } catch (e) {
        if (e instanceof Error && e.message === "ALREADY_PAID") {
          return NextResponse.json({ error: "تم صرف هذه المكافأة مسبقًا" }, { status: 400 })
        }
        throw e
      }

      notify({
        title: "💰 تم صرف مكافأتك",
        message: `تم إضافة مكافأة حملة "${reward.campaign.name}" بقيمة ${formatCurrency(reward.amount)} إلى رصيدك وأصبحت متاحة للسحب.`,
        type: NOTIFICATION_TYPE.REWARD,
        userId: reward.affiliateId,
        link: "/dashboard",
        relatedId: reward.campaign.id,
      })
      await logActivity(
        guard.actor.id,
        "INCENTIVE_REWARD_PAID",
        "incentives",
        `صرف مكافأة ${formatCurrency(reward.amount)} للمسوق من حملة "${reward.campaign.name}"`,
      )
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "حالة غير صحيحة" }, { status: 400 })
  } catch (error) {
    console.error("admin incentive reward PUT error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
