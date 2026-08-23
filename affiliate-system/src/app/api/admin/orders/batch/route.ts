import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { formatCurrency, getStatusText } from "@/lib/utils"
import { canTransitionOrder, TERMINAL_STATUSES } from "@/lib/order-state"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"
import {
  applyOrderTransition,
  OrderStateError,
  qualifiesForIncentive,
} from "@/lib/order-service"
import { evaluateAffiliateRewards } from "@/lib/incentives"

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

    const succeeded: string[] = []
    const failed: { id: string; error: string }[] = []

    for (const order of existing) {
      if (order.status === status) {
        succeeded.push(order.id)
        continue
      }
      try {
        const transition = await applyOrderTransition({
          orderId: order.id,
          to: status,
          source: "batch",
          actorId: guard.actor.id,
        })

        await logActivity(
          guard.actor.id,
          "ORDER_STATUS_CHANGED",
          "orders",
          JSON.stringify({ orderId: order.id, from: transition.from, to: transition.to }),
          order.id,
        )

        if (qualifiesForIncentive(status)) {
          evaluateAffiliateRewards(order.affiliateId).catch((e) =>
            console.error("incentive eval failed", e),
          )
        }

        if (transition.commissionCredited > 0) {
          notify({
            title: "تم تحصيل العمولة",
            message: `تم تحصيل عمولة طلب ${order.orderNumber} بقيمة ${formatCurrency(transition.commissionCredited)} وأصبحت متاحة للسحب`,
            type: NOTIFICATION_TYPE.EARNINGS,
            userId: order.affiliateId,
            link: "/dashboard",
            relatedId: order.id,
          })
        }

        succeeded.push(order.id)
      } catch (e) {
        const msg = e instanceof OrderStateError ? e.message : "خطأ في الخادم"
        failed.push({ id: order.id, error: msg })
      }
    }

    return NextResponse.json({
      updated: succeeded.length,
      failed: failed.length > 0 ? failed : undefined,
    })
  } catch {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
