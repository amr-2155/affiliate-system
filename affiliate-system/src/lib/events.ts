import crypto from "crypto"
import { prisma } from "@/lib/prisma"

export const ORDER_EVENTS = [
  "order.created",
  "order.confirmation_required",
  "order.confirmed",
  "order.rejected",
  "order.shipped",
  "order.delivered",
  "order.cancelled",
  "order.auto_cancelled",
] as const

export type OrderEventName = (typeof ORDER_EVENTS)[number]

export const ORDER_EVENT_LABELS: Record<string, string> = {
  "order.created": "إنشاء طلب",
  "order.confirmation_required": "الطلب بانتظار التأكيد",
  "order.confirmed": "تأكيد الطلب",
  "order.rejected": "رفض الطلب",
  "order.shipped": "شحن الطلب",
  "order.delivered": "تسليم الطلب",
  "order.cancelled": "إلغاء الطلب",
  "order.auto_cancelled": "إلغاء تلقائي (انتهاء مهلة التأكيد)",
}

/** توقيع HMAC-SHA256 لحمولة الـ webhook */
export function signPayload(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex")
}

export function verifySignature(secret: string, payload: string, signature: string): boolean {
  if (!secret || !signature) return false
  const expected = `sha256=${signPayload(secret, payload)}`
  const supplied = signature.startsWith("sha256=") ? signature : `sha256=${signature}`
  const a = Buffer.from(expected)
  const b = Buffer.from(supplied)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export interface EmitResult {
  created: number
  skipped: number
}

/**
 * يبث حدثاً لكل Webhook مفعّل مشترك فيه.
 * Idempotency: مفتاح idempotencyKey فريد = event + relatedId → أي بث مكرر للحدث
 * لنفس الكيان لا يُنشئ تسليمات جديدة (unique constraint على WebhookDelivery).
 */
export async function emitEvent(
  event: string,
  payload: Record<string, unknown>,
  relatedId: string
): Promise<EmitResult> {
  try {
    const webhooks = await prisma.webhook.findMany({ where: { enabled: true } })
    const subscribers = webhooks.filter((w) => {
      try {
        const evts = JSON.parse(w.events)
        return Array.isArray(evts) && evts.includes(event)
      } catch {
        return false
      }
    })

    let created = 0
    let skipped = 0
    for (const w of subscribers) {
      const idempotencyKey = `${event}:${relatedId}:${w.id}`
      const payloadStr = JSON.stringify({
        event,
        id: relatedId,
        data: payload,
        sent_at: new Date().toISOString(),
      })
      try {
        await prisma.webhookDelivery.create({
          data: {
            webhookId: w.id,
            event,
            idempotencyKey,
            payload: payloadStr,
            maxAttempts: Math.max(1, w.maxRetries + 1),
          },
        })
        created++
      } catch (e: any) {
        // قيد فريد مكرر → حدث سبق معالجته (idempotent)
        if (e?.code === "P2002") skipped++
        else throw e
      }
    }

    // تسليم فوري للأحداث الجديدة (بدون حجب الاستجابة)
    if (created > 0) {
      scheduleDeliverySoon(0)
    }

    return { created, skipped }
  } catch (error) {
    console.error("emitEvent error", event, error)
    return { created: 0, skipped: 0 }
  }
}

/** مؤقّت وحيد مضمون لمعالجة التسليمات — يمنع تراكم المؤقتات */
let deliveryTimer: NodeJS.Timeout | null = null
let deliveryQueued = false

function scheduleDeliverySoon(delayMs: number) {
  if (deliveryQueued) return
  deliveryQueued = true
  deliveryTimer = setTimeout(() => {
    deliveryQueued = false
    deliverPendingWebhooks(50).catch(() => {})
  }, delayMs)
  deliveryTimer.unref?.()
}

/** إعادة جدولة محاولة فاشلة بعد المهلة الأسّية */
function scheduleRetry(nextRetryAt: Date) {
  const delay = Math.max(0, nextRetryAt.getTime() - Date.now())
  scheduleDeliverySoon(Math.min(delay, 30 * 60 * 1000))
}

/**
 * يحاول تسليم كل WebhookDelivery معلق أو مستحق إعادة المحاولة.
 * Retry/Backoff: بعد الفشل يُجدوَل nextRetryAt بتزايد أُسّي حسب عدد المحاولات.
 */
export async function deliverPendingWebhooks(limit = 20): Promise<{ delivered: number; failed: number }> {
  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
    },
    include: { webhook: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  })

  let delivered = 0
  let failed = 0
  for (const d of due) {
    if (!d.webhook.enabled) continue
    if (d.attempts >= d.maxAttempts) {
      await prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: "FAILED" } })
      failed++
      continue
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), d.webhook.timeoutMs || 10000)
    try {
      const signature = signPayload(d.webhook.secret || "", d.payload)
      const res = await fetch(d.webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": `sha256=${signature}`,
          "X-Webhook-Event": d.event,
          "X-Webhook-Id": d.webhook.id,
          "X-Webhook-Idempotency-Key": d.idempotencyKey,
          "User-Agent": "Affiliate-System/1.0",
        },
        body: d.payload,
        signal: controller.signal,
      })
      const body = await res.text()
      const nextRetry = res.ok ? null : nextRetryDate(d.attempts + 1, d.maxAttempts)
      await prisma.webhookDelivery.update({
        where: { id: d.id },
        data: {
          status: res.ok ? "DELIVERED" : "FAILED",
          attempts: d.attempts + 1,
          responseStatus: res.status,
          responseBody: body.slice(0, 2000),
          deliveredAt: res.ok ? new Date() : null,
          error: res.ok ? null : `HTTP ${res.status}`,
          nextRetryAt: nextRetry,
        },
      })
      await prisma.webhook.update({
        where: { id: d.webhook.id },
        data: {
          lastDeliveryAt: new Date(),
          lastStatus: res.ok ? "OK" : "ERROR",
          lastStatusText: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} — ${body.slice(0, 120)}`,
        },
      })
      if (res.ok) delivered++
      else {
        failed++
        if (nextRetry) scheduleRetry(nextRetry)
      }
    } catch (e: any) {
      const nextRetry = nextRetryDate(d.attempts + 1, d.maxAttempts)
      await prisma.webhookDelivery.update({
        where: { id: d.id },
        data: {
          status: "FAILED",
          attempts: d.attempts + 1,
          error: e?.name === "AbortError" ? "Timeout" : e?.message || "Network error",
          nextRetryAt: nextRetry,
        },
      })
      await prisma.webhook.update({
        where: { id: d.webhook.id },
        data: { lastDeliveryAt: new Date(), lastStatus: "ERROR", lastStatusText: e?.name === "AbortError" ? "Timeout" : e?.message?.slice(0, 120) || "Network error" },
      })
      failed++
      if (nextRetry) scheduleRetry(nextRetry)
    } finally {
      clearTimeout(timeout)
    }
  }
  return { delivered, failed }
}

function nextRetryDate(attempts: number, maxAttempts: number): Date | null {
  if (attempts >= maxAttempts) return null
  const backoffMs = Math.min(30 * 60 * 1000, 1000 * Math.pow(2, attempts - 1)) // 1s, 2s, 4s...
  return new Date(Date.now() + backoffMs)
}

/** اختبار اتصال حقيقي — يرسل حدث ping ويتحقق من الاستجابة */
export async function testWebhookConnection(url: string, secret: string, timeoutMs = 10000): Promise<{ ok: boolean; status?: number; error?: string; body?: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const payload = JSON.stringify({ event: "ping", data: { ping: true, time: new Date().toISOString() } })
  try {
    const signature = signPayload(secret, payload)
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Event": "ping",
        "User-Agent": "Affiliate-System/1.0",
      },
      body: payload,
      signal: controller.signal,
    })
    const body = await res.text()
    return { ok: res.ok, status: res.status, body: body.slice(0, 500) }
  } catch (e: any) {
    return { ok: false, error: e?.name === "AbortError" ? "Timeout" : e?.message || "Network error" }
  } finally {
    clearTimeout(timeout)
  }
}
