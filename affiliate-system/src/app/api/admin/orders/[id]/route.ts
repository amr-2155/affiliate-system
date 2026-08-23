import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, requireAdminActor, actorCan, logActivity } from "@/lib/admin-guard"
import { formatCurrency, getStatusText } from "@/lib/utils"
import { computeCommission } from "@/lib/commission"
import { resolveUnitPrice, parseQuantity } from "@/lib/pricing"
import { applyOrderTransition, validateTransition, qualifiesForIncentive, OrderStateError } from "@/lib/order-service"
import { evaluateAffiliateRewards } from "@/lib/incentives"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"

class OutOfStockError extends Error {
  constructor(public productId: string) {
    super("OUT_OF_STOCK")
  }
}

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminActor()
    if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { status, paymentStatus, trackingNumber, shippingCost, discount, notes, internalNotes, customerName, customerPhone, customerAddress, customerCity, items } = body

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

    // منع تعديل أوامر نهائية + التحقق المبدئي من الانتقال
    // (الفحص النهائي الذري يتم داخل applyOrderTransition)
    if (status && status !== existing.status) {
      try {
        validateTransition(existing.status, status)
      } catch (e) {
        if (e instanceof OrderStateError) {
          return NextResponse.json(
            { error: `لا يمكن الانتقال من ${getStatusText(existing.status)} إلى ${getStatusText(status)}` },
            { status: e.httpStatus },
          )
        }
        throw e
      }
    }

    // Phase 2: الطلب المحصّل (مدفوع) مجمّد — تعديل الأصناف يكسر الرصيد
    // المحصّل مسبقًا، لذا يُمنع تمامًا. تعديل بيانات العميل مسموح.
    if (items && Array.isArray(items) && items.length > 0 && existing.status === "COLLECTED") {
      return NextResponse.json(
        { error: "لا يمكن تعديل أصناف طلب تم تحصيل عمولته — أنشئ طلبًا جديدًا أو استخدم المرتجع" },
        { status: 403 },
      )
    }

    // لا يُسمح بتعديل subtotal/total مباشرة من العميل — هذه الحقول تُحسب تلقائيًا
    // (subtotal = sum of item totals, total = subtotal + shippingCost - discount)

    // تتبّع الحقول المتغيرة لسجل الطلب (دون تقييد صلاحيات المدير)
    const fieldLabels: Record<string, string> = {
      paymentStatus: "حالة الدفع", trackingNumber: "رقم التتبع",
      shippingCost: "الشحن", discount: "الخصم",
      customerName: "اسم العميل", customerPhone: "هاتف العميل", customerAddress: "العنوان", customerCity: "المدينة",
      notes: "ملاحظات", internalNotes: "ملاحظات داخلية",
    }
    const changedFields = Object.keys(fieldLabels).filter((k) => {
      if (!(k in body)) return false
      return String((existing as any)[k] ?? "") !== String(body[k] ?? "")
    }).map((k) => ({ field: k, label: fieldLabels[k] }))

    // الحالة وتواريخها تُدار حصريًا عبر OrderService — لا تُلمس هنا.
    const data: any = {}
    if (paymentStatus) data.paymentStatus = paymentStatus
    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber
    if (shippingCost !== undefined) data.shippingCost = parseFloat(shippingCost)
    if (discount !== undefined) data.discount = parseFloat(discount)
    if (notes !== undefined) data.notes = notes
    if (internalNotes !== undefined) data.internalNotes = internalNotes
    if (customerName !== undefined) data.customerName = customerName
    if (customerPhone !== undefined) data.customerPhone = customerPhone
    if (customerAddress !== undefined) data.customerAddress = customerAddress
    if (customerCity !== undefined) data.customerCity = customerCity

    if (Object.keys(data).length > 0) {
      await prisma.order.update({
        where: { id }, data,
        include: {
          items: { include: { product: { select: { nameAr: true, image: true } } } },
          affiliate: { select: { name: true } },
          comments: { include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "desc" } },
          images: true,
        },
      })
    }

    let transition: Awaited<ReturnType<typeof applyOrderTransition>> | null = null

    if (items && Array.isArray(items)) {
      // C-01: even admins cannot set arbitrary prices — the product floor
      // (minPrice) is enforced; fixed-price products stay at their DB price.
      // Phase 2: quantities are validated and stock is adjusted atomically.
      const oldItems = await prisma.orderItem.findMany({
        where: { orderId: id },
        select: { id: true, productId: true, quantity: true },
      })
      const itemUpdates: { id: string; unitPrice: number; quantity: number; note?: string | null }[] = []
      for (const item of items) {
        if (!item.id || item.unitPrice === undefined) continue
        const orderItem = await prisma.orderItem.findUnique({
          where: { id: item.id },
          select: { orderId: true, quantity: true, note: true, product: { select: { price: true, minPrice: true } } },
        })
        if (!orderItem || orderItem.orderId !== id) {
          return NextResponse.json({ error: `عنصر الطلب غير موجود: ${item.id}` }, { status: 400 })
        }
        const price = resolveUnitPrice(orderItem.product, item.unitPrice)
        if (!price.ok) {
          return NextResponse.json({ error: price.error }, { status: 400 })
        }
        const qty = parseQuantity(item.quantity ?? orderItem.quantity)
        if (qty === null) {
          return NextResponse.json({ error: "الكمية غير صالحة" }, { status: 400 })
        }
        itemUpdates.push({
          id: item.id,
          unitPrice: price.unitPrice,
          quantity: qty,
          note: item.note !== undefined ? item.note : orderItem.note ?? undefined,
        })
      }

      try {
        await prisma.$transaction(async (tx) => {
          for (const update of itemUpdates) {
            await tx.orderItem.update({
              where: { id: update.id },
              data: {
                unitPrice: update.unitPrice,
                total: update.unitPrice * update.quantity,
                quantity: update.quantity,
                note: update.note ?? undefined,
              },
            })
            // Phase 2: atomic stock adjustment for the quantity delta.
            const old = oldItems.find((o) => o.id === update.id)
            if (!old) continue
            const delta = update.quantity - old.quantity
            if (delta === 0) continue
            if (delta < 0) {
              await tx.product.update({
                where: { id: old.productId },
                data: { stock: { increment: -delta } },
              })
            } else {
              const res = await tx.product.updateMany({
                where: { id: old.productId, stock: { gte: delta } },
                data: { stock: { decrement: delta } },
              })
              if (res.count === 0) throw new OutOfStockError(old.productId)
            }
          }

          const updatedItems = await tx.orderItem.findMany({
            where: { orderId: id },
            include: { product: { select: { price: true, minPrice: true, affiliateCostPrice: true } } },
          })
          const newSubtotal = updatedItems.reduce((sum, i) => sum + i.total, 0)
          const finalShipping = data.shippingCost !== undefined ? data.shippingCost : existing.shippingCost
          const finalDiscount = data.discount !== undefined ? data.discount : existing.discount
          const newTotal = newSubtotal + finalShipping - finalDiscount
          const newCommission = computeCommission(updatedItems.map((i) => ({ product: i.product, unitPrice: i.unitPrice, quantity: i.quantity })))

          await tx.order.update({ where: { id }, data: { subtotal: newSubtotal, total: newTotal } })
          await tx.commissionLog.deleteMany({ where: { orderId: id } })
          if (newCommission > 0) {
            await tx.commissionLog.create({ data: { amount: newCommission, orderId: id, userId: existing.affiliateId } })
          }
        })
      } catch (e) {
        if (e instanceof OutOfStockError) {
          return NextResponse.json(
            { error: `الكمية المعدّلة تتجاوز المخزون المتاح للمنتج` },
            { status: 400 },
          )
        }
        throw e
      }

      await logActivity(
        actor.id,
        "ORDER_ITEMS_UPDATED",
        "orders",
        JSON.stringify({ orderId: id, items: itemUpdates.map((u) => u.id) }),
        id
      )
    }

    if (status && status !== existing.status) {
      // C-03/Phase 2: single atomic transition path — commission credit/revert,
      // supplier bonuses and webhook events all flow through OrderService.
      try {
        transition = await applyOrderTransition({
          orderId: id,
          to: status,
          source: "admin",
          actorId: actor.id,
          cancelReason: typeof body.reason === "string" ? body.reason : undefined,
        })
      } catch (e) {
        if (e instanceof OrderStateError) {
          return NextResponse.json({ error: e.message }, { status: e.httpStatus })
        }
        throw e
      }

      if (qualifiesForIncentive(status)) {
        evaluateAffiliateRewards(existing.affiliateId).catch((e) => console.error("incentive eval failed", e))
      }

      await logActivity(
        actor.id,
        "ORDER_STATUS_CHANGED",
        "orders",
        JSON.stringify({ orderId: id, from: transition.from, to: transition.to }),
        id
      )

      if (transition.commissionCredited > 0) {
        notify({
          title: "تم تحصيل العمولة",
          message: `تم تحصيل عمولة طلب ${existing.orderNumber} بقيمة ${formatCurrency(transition.commissionCredited)} وأصبحت متاحة للسحب`,
          type: NOTIFICATION_TYPE.EARNINGS,
          userId: existing.affiliateId,
          link: "/dashboard",
          relatedId: existing.id,
        })
      } else {
        notify({
          title: "تم تحديث حالة الطلب",
          message: `تم تحديث حالة طلب ${existing.orderNumber} إلى ${getStatusText(status)}`,
          type: NOTIFICATION_TYPE.ORDER,
          userId: existing.affiliateId,
          link: `/orders/${existing.id}`,
          relatedId: existing.id,
        })
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
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!order) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
    try {
      // Through OrderService so bonuses/webhooks stay consistent with a normal cancel.
      await applyOrderTransition({
        orderId: id,
        to: "CANCELLED",
        source: "admin",
        actorId: guard.actor.id,
        cancelReason: "حذف من الإدارة",
      })
    } catch (e) {
      if (e instanceof OrderStateError) {
        return NextResponse.json({ error: e.message }, { status: e.httpStatus })
      }
      throw e
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
