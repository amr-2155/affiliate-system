import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { formatCurrency, getStatusText } from "@/lib/utils"
import { canTransitionOrder, TERMINAL_STATUSES } from "@/lib/order-state"
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

    // Validate transitions for all orders
    const invalidOrders: string[] = []
    for (const order of existing) {
      if (order.status === status) continue
      if ((TERMINAL_STATUSES as readonly string[]).includes(order.status)) {
        invalidOrders.push(`${order.orderNumber} (حالة نهائية)`)
        continue
      }
      if (!canTransitionOrder(order.status, status)) {
        invalidOrders.push(`${order.orderNumber} (${getStatusText(order.status)} → ${getStatusText(status)})`)
      }
    }
    if (invalidOrders.length > 0) {
      return NextResponse.json({ error: `لا يمكن تحديث الطلبات: ${invalidOrders.join(", ")}` }, { status: 400 })
    }

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
        await prisma.user.update({
          where: { id: order.affiliateId },
          data: { balance: { decrement: commission }, totalEarnings: { decrement: commission } },
        })
      }
    }

    return NextResponse.json({ updated: result.count })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
