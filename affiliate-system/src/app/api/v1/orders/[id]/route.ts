import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey } from "@/lib/api-keys"
import { formatCurrency } from "@/lib/utils"
import { emitEvent } from "@/lib/events"
import { settleBonusesForOrder, revokeBonusesForOrder, BONUS_COUNT_STATUSES, BONUS_REVOKE_STATUSES, BONUS_NON_EARNING_STATUSES } from "@/lib/supplier-bonus"

/**
 * نقطة وصول عامة لمصادقة API Key — تُستخدم لإرسال أحداث الطلب
 * إلى خدمات خارجية (n8n وغيرها). تُحدَّث حالة الطلب بأمان.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await authenticateApiKey(req, "orders.update")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { status, trackingNumber } = body

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
    }

    const VALID_STATUSES = ["CONFIRMED", "REJECTED", "PROCESSING", "SHIPPED", "DELIVERED", "COLLECTED", "CANCELLED"]
    const data: any = {}
    if (status && VALID_STATUSES.includes(status)) {
      data.status = status
      if (status === "DELIVERED") data.deliveredAt = new Date()
      if (status === "COLLECTED") data.collectedAt = new Date()
      if (status === "CANCELLED") { data.cancelledAt = new Date(); data.cancelReason = body.reason || "إلغاء عبر API" }
    }
    if (trackingNumber !== undefined) data.trackingNumber = String(trackingNumber)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا توجد تغييرات صالحة" }, { status: 400 })
    }

    const updated = await prisma.order.update({ where: { id }, data })

    // بونص حملة الموردين — يُحتسب عند التسليم/التحصيل ويُسحب عند الخروج منهما.
    if ((BONUS_COUNT_STATUSES as readonly string[]).includes(status)) {
      settleBonusesForOrder(id).catch((e) => console.error("supplier bonus settle failed", e))
    }
    if ((BONUS_REVOKE_STATUSES as readonly string[]).includes(status) || (BONUS_NON_EARNING_STATUSES as readonly string[]).includes(status)) {
      revokeBonusesForOrder(id).catch((e) => console.error("supplier bonus revoke failed", e))
    }

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
        orderNumber: updated.orderNumber,
        status: updated.status,
        customerName: updated.customerName,
        total: updated.total,
        currency: updated.currency,
        trackingNumber: updated.trackingNumber || null,
        source: "api",
      }, updated.id)
    }

    return NextResponse.json({ ok: true, order: { orderNumber: updated.orderNumber, status: updated.status } })
  } catch (error) {
    console.error("api/v1 status error", error)
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await authenticateApiKey(req, "orders.read")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        currency: true,
        trackingNumber: true,
        customerName: true,
        customerCity: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      order: {
        ...order,
        totalFormatted: formatCurrency(order.total),
      },
    })
  } catch (error) {
    console.error("api/v1 order GET error", error)
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 })
  }
}
