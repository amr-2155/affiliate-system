import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, requireAdminActor, actorCan, logActivity } from "@/lib/admin-guard"
import { formatCurrency, getStatusText } from "@/lib/utils"
import { emitEvent } from "@/lib/events"
import { computeCommission } from "@/lib/commission"
import { evaluateAffiliateRewards, INCENTIVE_COUNT_STATUSES } from "@/lib/incentives"
import { settleBonusesForOrder, revokeBonusesForOrder, BONUS_COUNT_STATUSES, BONUS_REVOKE_STATUSES, BONUS_NON_EARNING_STATUSES } from "@/lib/supplier-bonus"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("orders.view")
    if (guard instanceof NextResponse) return guard
    const { id } = await params
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, nameAr: true, name: true, image: true, price: true } } } },
        affiliate: { select: { id: true, name: true, email: true } },
        comments: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" } },
        images: { orderBy: { createdAt: "asc" } },
      },
    })
    if (!order) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
    return NextResponse.json(order)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

async function getOrderCommission(orderId: string): Promise<number> {
  const agg = await prisma.commissionLog.aggregate({
    where: { orderId },
    _sum: { amount: true },
  })
  return agg._sum.amount || 0
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminActor()
    if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { status, paymentStatus, trackingNumber, subtotal, shippingCost, discount, total, notes, internalNotes, customerName, customerPhone, customerAddress, customerCity, items } = body

    // صلاحية التحديث: تأكيد الطلب فقط (إلى CONFIRMED) متاح لفريق التأكيد عبر confirmation.confirm،
    // بينما تعديل أي بيانات/حالات أخرى يتطلب orders.update.
    const isConfirmOnly = status === "CONFIRMED" && Object.keys(body).length === 1
    const canUpdate = actorCan(actor, "orders.update")
    const canConfirm = actorCan(actor, "confirmation.confirm")
    if (isConfirmOnly ? !(canUpdate || canConfirm) : !canUpdate) {
      return NextResponse.json({ error: "ليس لديك صلاحية لهذا الإجراء" }, { status: 403 })
    }

    const existing = await prisma.order.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    // تتبّع الحقول المتغيرة لسجل الطلب (دون تقييد صلاحيات المدير)
    const fieldLabels: Record<string, string> = {
      paymentStatus: "حالة الدفع", trackingNumber: "رقم التتبع",
      subtotal: "المجموع الفرعي", shippingCost: "الشحن", discount: "الخصم", total: "الإجمالي",
      customerName: "اسم العميل", customerPhone: "هاتف العميل", customerAddress: "العنوان", customerCity: "المدينة",
      notes: "ملاحظات", internalNotes: "ملاحظات داخلية",
    }
    const changedFields = Object.keys(fieldLabels).filter((k) => {
      if (!(k in body)) return false
      return String((existing as any)[k] ?? "") !== String(body[k] ?? "")
    }).map((k) => ({ field: k, label: fieldLabels[k] }))

    const data: any = {}
    if (status) {
      data.status = status
      if (status === "DELIVERED") data.deliveredAt = new Date()
      if (status === "CANCELLED") data.cancelledAt = new Date()
      if (status === "COLLECTED") data.collectedAt = new Date()
      if (status === "CONFIRMED" && status !== existing.status) {
        data.confirmedById = actor.id
        data.confirmedAt = new Date()
      }
    }
    if (paymentStatus) data.paymentStatus = paymentStatus
    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber
    if (subtotal !== undefined) data.subtotal = parseFloat(subtotal)
    if (shippingCost !== undefined) data.shippingCost = parseFloat(shippingCost)
    if (discount !== undefined) data.discount = parseFloat(discount)
    if (total !== undefined) data.total = parseFloat(total)
    if (notes !== undefined) data.notes = notes
    if (internalNotes !== undefined) data.internalNotes = internalNotes
    if (customerName !== undefined) data.customerName = customerName
    if (customerPhone !== undefined) data.customerPhone = customerPhone
    if (customerAddress !== undefined) data.customerAddress = customerAddress
    if (customerCity !== undefined) data.customerCity = customerCity

    const order = await prisma.order.update({
      where: { id }, data,
      include: {
        items: { include: { product: { select: { nameAr: true, image: true } } } },
        affiliate: { select: { name: true } },
        comments: { include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "desc" } },
        images: true,
      },
    })

    if (items && Array.isArray(items)) {
      for (const item of items) {
        if (item.id && item.unitPrice !== undefined) {
          await prisma.orderItem.update({
            where: { id: item.id },
            data: {
              unitPrice: parseFloat(item.unitPrice),
              total: parseFloat(item.unitPrice) * (item.quantity || 1),
              quantity: item.quantity || undefined,
              note: item.note !== undefined ? item.note : undefined,
            },
          })
        }
      }
      const updatedItems = await prisma.orderItem.findMany({
        where: { orderId: id },
        include: { product: { select: { price: true, minPrice: true, affiliateCostPrice: true } } },
      })
      const newSubtotal = updatedItems.reduce((sum, i) => sum + i.total, 0)
      const newTotal = newSubtotal + (data.shippingCost ?? order.shippingCost) - (data.discount ?? order.discount)
      await prisma.order.update({ where: { id }, data: { subtotal: newSubtotal, total: newTotal } })

      // إعادة حساب العمولة بعد تعديل أسعار/كميات المنتجات (المدير غير مقيد)
      const newCommission = computeCommission(updatedItems.map((i) => ({ product: i.product, unitPrice: i.unitPrice, quantity: i.quantity })))
      await prisma.commissionLog.deleteMany({ where: { orderId: id } })
      if (newCommission > 0) {
        await prisma.commissionLog.create({ data: { amount: newCommission, orderId: id, userId: existing.affiliateId } })
      }

      await logActivity(
        actor.id,
        "ORDER_ITEMS_UPDATED",
        "orders",
        JSON.stringify({ orderId: id, subtotal: newSubtotal, commission: newCommission }),
        id
      )
    }

    if (status && status !== existing.status) {
      // احتساب إنجازات المسوق في الحملات التحفيزية عند التسليم/التحصيل الفعلي
      if ((INCENTIVE_COUNT_STATUSES as readonly string[]).includes(status)) {
        evaluateAffiliateRewards(existing.affiliateId).catch((e) => console.error("incentive eval failed", e))
      }
      // بونص حملة الموردين: يُحتسب عند التسليم/التحصيل فقط ويُسحب عند الخروج من هذه الحالات.
      if ((BONUS_COUNT_STATUSES as readonly string[]).includes(status)) {
        settleBonusesForOrder(id).catch((e) => console.error("supplier bonus settle failed", e))
      }
      if ((BONUS_REVOKE_STATUSES as readonly string[]).includes(status) || (BONUS_NON_EARNING_STATUSES as readonly string[]).includes(status)) {
        revokeBonusesForOrder(id).catch((e) => console.error("supplier bonus revoke failed", e))
      }
      await logActivity(
        actor.id,
        "ORDER_STATUS_CHANGED",
        "orders",
        JSON.stringify({ orderId: id, from: existing.status, to: status }),
        id
      )
      const commission = await getOrderCommission(id)
      const prevCollected = existing.status === "COLLECTED"
      const newCollected = status === "COLLECTED"

      if (newCollected && !prevCollected) {
        // Credit the order's commission to the affiliate balance
        if (commission > 0) {
          await prisma.user.update({
            where: { id: existing.affiliateId },
            data: { balance: { increment: commission }, totalEarnings: { increment: commission } },
          })
          notify({
            title: "تم تحصيل العمولة",
            message: `تم تحصيل عمولة طلب ${existing.orderNumber} بقيمة ${formatCurrency(commission)} وأصبحت متاحة للسحب`,
            type: NOTIFICATION_TYPE.EARNINGS,
            userId: existing.affiliateId,
            link: "/dashboard",
            relatedId: order.id,
          })
        }
      } else if (!newCollected && prevCollected && commission > 0) {
        // Revert the credited commission if order leaves the collected state
        const afUser = await prisma.user.findUnique({ where: { id: existing.affiliateId }, select: { balance: true, totalEarnings: true } })
        await prisma.user.update({
          where: { id: existing.affiliateId },
          data: {
            balance: Math.max(0, (afUser?.balance || 0) - commission),
            totalEarnings: Math.max(0, (afUser?.totalEarnings || 0) - commission),
          },
        })
      }

      if (!(newCollected && !prevCollected)) {
        notify({
          title: "تم تحديث حالة الطلب",
          message: `تم تحديث حالة طلب ${existing.orderNumber} إلى ${getStatusText(status)}`,
          type: NOTIFICATION_TYPE.ORDER,
          userId: existing.affiliateId,
          link: `/orders/${existing.id}`,
          relatedId: existing.id,
        })
      }

      // Emit webhook event for status change
      const eventMap: Record<string, string> = {
        CONFIRMED: "order.confirmed",
        REJECTED: "order.rejected",
        PROCESSING: "order.processing",
        SHIPPED: "order.shipped",
        DELIVERED: "order.delivered",
        COLLECTED: "order.collected",
        CANCELLED: "order.cancelled",
      }
      const eventName = eventMap[status]
      if (eventName) {
        await emitEvent(eventName, {
          orderNumber: existing.orderNumber,
          status,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerCity: order.customerCity,
          total: order.total,
          currency: order.currency,
          trackingNumber: order.trackingNumber || null,
        }, existing.id)
      }
    }

    if (changedFields.length > 0) {
      await logActivity(
        actor.id,
        "ORDER_UPDATED",
        "orders",
        JSON.stringify({ orderId: id, fields: changedFields }),
        id
      )
    }

    const finalOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, nameAr: true, name: true, image: true, price: true } } } },
        affiliate: { select: { id: true, name: true, email: true } },
        comments: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" } },
        images: { orderBy: { createdAt: "asc" } },
      },
    })

    return NextResponse.json(finalOrder)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("orders.update")
    if (guard instanceof NextResponse) return guard
    const { id } = await params
    await prisma.order.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
