import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { getSetting } from "@/lib/settings"
import { logActivity } from "@/lib/admin-guard"
import { formatCurrency } from "@/lib/utils"
import { emitEvent } from "@/lib/events"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"
import { canTransitionOrder, TERMINAL_STATUSES } from "@/lib/order-state"
import { settleBonusesForOrder, revokeBonusesForOrder, BONUS_COUNT_STATUSES, BONUS_REVOKE_STATUSES, BONUS_NON_EARNING_STATUSES } from "@/lib/supplier-bonus"

/**
 * نقطة وصول خارجية (n8n / خدمة خارجية) لتحديث حالة الطلب.
 * تُوقَّع الطلبات عبر X-Signature (HMAC-SHA256) بمفتاح n8n المُخزَّن.
 * لا يعمل إلا إذا كان تكامل n8n مفعلاً.
 */
export async function POST(req: NextRequest) {
  try {
    const enabled = await getSetting("integrations-n8n-enabled", "false")
    if (enabled !== "true") {
      return NextResponse.json({ error: "التكامل معطل" }, { status: 403 })
    }

    const secret = await getSetting("integrations-n8n-api-key", "")
    const rawBody = await req.text()

    const signature = req.headers.get("x-signature") || ""
    if (!secret || !signature) {
      return NextResponse.json({ error: "التوقيع مطلوب" }, { status: 401 })
    }

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
    const a = Buffer.from(expected)
    const b = Buffer.from(signature.replace(/^sha256=/, ""))
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b)
    if (!valid) {
      return NextResponse.json({ error: "توقيع غير صالح" }, { status: 401 })
    }

    const body = JSON.parse(rawBody)
    const { orderNumber, status, trackingNumber } = body

    const order = orderNumber
      ? await prisma.order.findUnique({ where: { orderNumber: String(orderNumber) } })
      : null
    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
    }

    const VALID_STATUSES = ["CONFIRMED", "REJECTED", "PROCESSING", "SHIPPED", "DELIVERED", "COLLECTED", "CANCELLED"]
    const data: any = {}
    if (status && VALID_STATUSES.includes(status)) {
      // منع تحديث أوامر نهائية
      if ((TERMINAL_STATUSES as readonly string[]).includes(order.status)) {
        return NextResponse.json({ error: "الطلب في حالة نهائية ولا يمكن تحديثه" }, { status: 400 })
      }
      // التحقق من صلاحية الانتقال
      if (!canTransitionOrder(order.status, status)) {
        return NextResponse.json({ error: `لا يمكن الانتقال من ${order.status} إلى ${status}` }, { status: 400 })
      }
      data.status = status
      if (status === "DELIVERED") data.deliveredAt = new Date()
      if (status === "COLLECTED") data.collectedAt = new Date()
      if (status === "CANCELLED") { data.cancelledAt = new Date(); data.cancelReason = body.reason || "إلغاء عبر تكامل خارجي" }
      if (status === "CONFIRMED" && !order.confirmedAt) { data.confirmedAt = new Date(); data.confirmedById = null }
    }
    if (trackingNumber !== undefined) data.trackingNumber = String(trackingNumber)

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا توجد تغييرات صالحة" }, { status: 400 })
    }

    const updated = await prisma.order.update({ where: { id: order.id }, data })

    // Handle commission credit/reversal on COLLECTED transition
    if (status) {
      const prevCollected = order.status === "COLLECTED"
      const newCollected = status === "COLLECTED"

      if ((newCollected && !prevCollected) || (!newCollected && prevCollected)) {
        const agg = await prisma.commissionLog.aggregate({ where: { orderId: order.id }, _sum: { amount: true } })
        const commission = agg._sum.amount || 0
        if (commission > 0) {
          if (newCollected && !prevCollected) {
            await prisma.user.update({
              where: { id: order.affiliateId },
              data: { balance: { increment: commission }, totalEarnings: { increment: commission } },
            })
          } else if (!newCollected && prevCollected) {
            await prisma.user.update({
              where: { id: order.affiliateId },
              data: { balance: { decrement: commission }, totalEarnings: { decrement: commission } },
            })
          }
        }
      }

      // Emit webhook event
      const eventMap: Record<string, string> = {
        CONFIRMED: "order.confirmed", REJECTED: "order.rejected",
        PROCESSING: "order.processing", SHIPPED: "order.shipped",
        DELIVERED: "order.delivered", COLLECTED: "order.collected",
        CANCELLED: "order.cancelled",
      }
      if (eventMap[status]) {
        await emitEvent(eventMap[status], {
          orderNumber: order.orderNumber, status,
          total: updated.total, currency: updated.currency,
        }, order.id).catch(() => {})
      }
    }

    // بونص حملة الموردين — نفس منطق بقية نقاط تحديث الحالة (آمن ضد التكرار).
    if (status && (BONUS_COUNT_STATUSES as readonly string[]).includes(status)) {
      settleBonusesForOrder(order.id).catch((e) => console.error("supplier bonus settle failed", e))
    }
    if (status && ((BONUS_REVOKE_STATUSES as readonly string[]).includes(status) || (BONUS_NON_EARNING_STATUSES as readonly string[]).includes(status))) {
      revokeBonusesForOrder(order.id).catch((e) => console.error("supplier bonus revoke failed", e))
    }

    await logActivity(order.affiliateId, "ORDER_EXTERNAL_UPDATE", "orders", `تحديث خارجي (n8n) للطلب ${order.orderNumber} → ${data.status || "بيانات"}`,)
      .catch(() => {})

    return NextResponse.json({ ok: true, orderNumber: updated.orderNumber, status: updated.status })
  } catch (error: any) {
    if (error?.name === "SyntaxError") {
      return NextResponse.json({ error: "JSON غير صالح" }, { status: 400 })
    }
    console.error("inbound webhook error", error)
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 })
  }
}
