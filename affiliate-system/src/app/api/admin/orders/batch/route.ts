import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { formatCurrency } from "@/lib/utils"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"
import { settleBonusesForOrder, revokeBonusesForOrder, BONUS_COUNT_STATUSES, BONUS_REVOKE_STATUSES, BONUS_NON_EARNING_STATUSES } from "@/lib/supplier-bonus"

export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("orders.batch")
    if (guard instanceof NextResponse) return guard

    const { ids, status } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 })
    }

    const existing = await prisma.order.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true, orderNumber: true, affiliateId: true },
    })

    const data: any = { status }
    if (status === "DELIVERED") data.deliveredAt = new Date()
    if (status === "CANCELLED") data.cancelledAt = new Date()
    if (status === "COLLECTED") data.collectedAt = new Date()

    const result = await prisma.order.updateMany({
      where: { id: { in: ids } },
      data,
    })

    // بونص حملة الموردين لكل طلب يدخل التسليم/التحصيل أو يخرج منهما.
    for (const order of existing) {
      if (order.status !== status) {
        if ((BONUS_COUNT_STATUSES as readonly string[]).includes(status)) {
          settleBonusesForOrder(order.id).catch((e) => console.error("supplier bonus settle failed", e))
        }
        if ((BONUS_REVOKE_STATUSES as readonly string[]).includes(status) || (BONUS_NON_EARNING_STATUSES as readonly string[]).includes(status)) {
          revokeBonusesForOrder(order.id).catch((e) => console.error("supplier bonus revoke failed", e))
        }
      }
    }

    // Credit commissions for orders entering COLLECTED, revert for orders leaving it
    for (const order of existing) {
      if (order.status !== status) {
        await logActivity(
          guard.actor.id,
          "ORDER_STATUS_CHANGED",
          "orders",
          JSON.stringify({ orderId: order.id, from: order.status, to: status }),
          order.id
        )
      }
      const prevCollected = order.status === "COLLECTED"
      const newCollected = status === "COLLECTED"
      if (prevCollected === newCollected) continue

      const agg = await prisma.commissionLog.aggregate({
        where: { orderId: order.id },
        _sum: { amount: true },
      })
      const commission = agg._sum.amount || 0
      if (commission <= 0) continue

      if (newCollected) {
        await prisma.user.update({
          where: { id: order.affiliateId },
          data: { balance: { increment: commission }, totalEarnings: { increment: commission } },
        })
        notify({
          title: "تم تحصيل العمولة",
          message: `تم تحصيل عمولة طلب ${order.orderNumber} بقيمة ${formatCurrency(commission)} وأصبحت متاحة للسحب`,
          type: NOTIFICATION_TYPE.EARNINGS,
          userId: order.affiliateId,
          link: "/dashboard",
          relatedId: order.id,
        })
      } else {
        const afUser = await prisma.user.findUnique({ where: { id: order.affiliateId }, select: { balance: true, totalEarnings: true } })
        await prisma.user.update({
          where: { id: order.affiliateId },
          data: {
            balance: Math.max(0, (afUser?.balance || 0) - commission),
            totalEarnings: Math.max(0, (afUser?.totalEarnings || 0) - commission),
          },
        })
      }
    }

    return NextResponse.json({ updated: result.count })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
