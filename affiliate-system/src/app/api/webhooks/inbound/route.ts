import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { getSetting } from "@/lib/settings"
import { logActivity } from "@/lib/admin-guard"
import { applyOrderTransition, OrderStateError } from "@/lib/order-service"

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

    // Phase 3: replay protection.
    // Senders MAY include `X-Timestamp` (epoch ms); it is then signed as
    // `${rawBody}:${timestamp}` and must be within ±5 minutes.
    // Setting `integrations-n8n-require-timestamp=true` makes it mandatory
    // (flip after updating the n8n workflow to send it).
    const REPLAY_WINDOW_MS = 5 * 60 * 1000
    const requireTimestamp = (await getSetting("integrations-n8n-require-timestamp", "false")) === "true"
    const timestampHeader = req.headers.get("x-timestamp") || ""

    if (requireTimestamp && !timestampHeader) {
      return NextResponse.json({ error: "X-Timestamp مطلوب" }, { status: 401 })
    }

    let payloadToSign = rawBody
    if (timestampHeader) {
      const ts = Number(timestampHeader)
      if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
        return NextResponse.json({ error: "طابع زمني غير صالح أو منتهي الصلاحية" }, { status: 401 })
      }
      payloadToSign = `${rawBody}:${timestampHeader}`
    }

    const signature = req.headers.get("x-signature") || ""
    if (!secret || !signature) {
      return NextResponse.json({ error: "التوقيع مطلوب" }, { status: 401 })
    }

    const expected = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex")
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

    // Non-status fields (e.g. tracking number) update directly.
    if (trackingNumber !== undefined && trackingNumber !== order.trackingNumber) {
      await prisma.order.update({ where: { id: order.id }, data: { trackingNumber: String(trackingNumber) } })
    }

    if (status) {
      // C-03/Phase 2: single atomic transition path — validation, commission
      // credit/revert, supplier bonuses and webhook events all live in
      // OrderService now.
      try {
        await applyOrderTransition({
          orderId: order.id,
          to: String(status),
          source: "external",
          cancelReason: typeof body.reason === "string" ? body.reason : "إلغاء عبر تكامل خارجي",
        })
      } catch (e) {
        if (e instanceof OrderStateError) {
          return NextResponse.json({ error: e.message }, { status: e.httpStatus })
        }
        throw e
      }
    }

    await logActivity(order.affiliateId, "ORDER_EXTERNAL_UPDATE", "orders", `تحديث خارجي (n8n) للطلب ${order.orderNumber} → ${status || "بيانات"}`)
      .catch(() => {})

    return NextResponse.json({ ok: true, orderNumber: order.orderNumber, status: status || order.status })
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "JSON غير صالح" }, { status: 400 })
    }
    console.error("inbound webhook error", error)
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 })
  }
}
