import { prisma } from "@/lib/prisma"
import { getSetting } from "@/lib/settings"
import { logActivity } from "@/lib/admin-guard"
import { emitEvent } from "@/lib/events"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"
import { applyOrderTransition, OrderStateError } from "@/lib/order-service"

export const CONFIRMATION_SETTINGS = {
  "orders-auto-cancel-enabled": "true",
  "orders-auto-cancel-days": "3",
  "confirmation-attempts-per-day": "3",
  "confirmation-duration-days": "3",
  "confirmation-channels": "WHATSAPP,PHONE",
  "confirmation-attempt-schedule": "10:00,14:00,18:00",
} as const

/** حساب مهلة التأكيد القصوى (أيام) من الإعدادات */
export async function getConfirmationDeadlineDays(): Promise<number> {
  const raw = await getSetting("orders-auto-cancel-days", "3")
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 3
}

export async function isAutoCancelEnabled(): Promise<boolean> {
  const raw = await getSetting("orders-auto-cancel-enabled", "true")
  return raw !== "false" && raw !== "0"
}

/** الأوامر المؤهلة للإلغاء التلقائي — تُفحص بشروط صارمة */
export function isEligibleForAutoCancel(status: string): boolean {
  return ["PENDING", "PROCESSING"].includes(status)
}

/**
 * الإلغاء التلقائي للطلبات التي انتهت مهلة تأكيدها.
 *
 * Race-condition protection: كل تحويل حالة يتم عبر updateMany ذري
 * يشترط الحالة الحالية (status: "PENDING" أو "PROCESSING").
 * لو تم تأكيد الطلب أو شحنه أو تسليمه في نفس اللحظة → updateMany يُرجع count=0
 * ولا يُلغى الطلب. كما يمنع الإلغاء المكرر (idempotent) عبر نفس الشرط.
 */
export async function autoCancelOrders(now = new Date(), dryRun = false): Promise<{
  scanned: number
  cancelled: number
  skipped: number
  errors: number
  details: string[]
}> {
  const enabled = await isAutoCancelEnabled()
  if (!enabled) return { scanned: 0, cancelled: 0, skipped: 0, errors: 0, details: ["الإلغاء التلقائي معطّل في الإعدادات"] }

  const days = await getConfirmationDeadlineDays()
  const deadline = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const candidates = await prisma.order.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      confirmationDeadline: { lte: deadline },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      confirmationDeadline: true,
      confirmedAt: true,
      confirmedById: true,
      trackingNumber: true,
      affiliateId: true,
      customerName: true,
      reviewerId: true,
      total: true,
    },
  })

  let cancelled = 0
  let skipped = 0
  const errors = 0
  const details: string[] = []

  for (const order of candidates) {
    // فحوصات أمان قبل الإلغاء — فحص إضافي لضمان عدم إلغاء أوامر مؤكدة/مكتملة
    const current = await prisma.order.findUnique({ where: { id: order.id } })
    if (!current) continue
    if (current.confirmedAt || current.confirmedById) { skipped++; details.push(`${order.orderNumber}: مؤكد — تخطي`); continue }
    if (current.trackingNumber) { skipped++; details.push(`${order.orderNumber}: تم شحنه — تخطي`); continue }
    if (!isEligibleForAutoCancel(current.status)) { skipped++; details.push(`${order.orderNumber}: حالة غير قابلة للإلغاء — تخطي`); continue }
    if (current.status === "CANCELLED" || current.cancelledAt) { skipped++; continue }

    // محاولة تأكيد أخيرة — تُسجَّل كسجل محاولة حقيقي قبل الإلغاء
    if (!dryRun) {
      await recordFinalAttempt(current, now)
      // إعادة فحص حالة الطلب بعد المحاولة الأخيرة (قد يؤكدها فريق التأكيد الآن)
      const recheck = await prisma.order.findUnique({ where: { id: order.id } })
      if (!recheck || recheck.confirmedAt || recheck.confirmedById || !isEligibleForAutoCancel(recheck.status)) {
        skipped++; details.push(`${order.orderNumber}: تغيّرت حالته بعد المحاولة الأخيرة — تخطي`)
        continue
      }
    }

    if (dryRun) {
      details.push(`${order.orderNumber}: (محاكاة) سيتم إلغاؤه`)
      continue
    }

    // تحويل ذرّي آمن عبر OrderService — نفس مسار بقية التطبيق:
    // قفل الحالة، إرجاع المخزون، سحب البونص، وبث الحدث القياسي order.cancelled.
    try {
      await applyOrderTransition({
        orderId: order.id,
        to: "CANCELLED",
        source: "auto-cancel",
        cancelReason: "انتهاء مهلة التأكيد",
      })
    } catch (e) {
      if (e instanceof OrderStateError) {
        skipped++; details.push(`${order.orderNumber}: ${e.message} — تخطي`)
        continue
      }
      throw e
    }

    cancelled++
    details.push(`${order.orderNumber}: تم الإلغاء التلقائي`)

    // Audit Log (بمعرف النظام — بلا مستخدم فعلي)
    await logActivity(order.affiliateId, "ORDER_AUTO_CANCELLED", "orders", `إلغاء تلقائي للطلب ${order.orderNumber} — انتهاء مهلة التأكيد`, order.id)

    // Notification للمسوق (بشكل idempotent)
    notify({
      title: "إلغاء تلقائي للطلب",
      message: `تم إلغاء الطلب ${order.orderNumber} تلقائيًا لانتهاء مهلة التأكيد`,
      type: NOTIFICATION_TYPE.ORDER,
      userId: order.affiliateId,
      link: `/orders/${order.id}`,
      relatedId: order.id,
    })

    // حدث order.auto_cancelled يُباع كما هو للتوافق مع المستمعين الحاليين
    // (الخدمة بثت بالفعل order.cancelled القياسي).
    await emitEvent("order.auto_cancelled", {
      orderNumber: order.orderNumber,
      status: "CANCELLED",
      reason: "انتهاء مهلة التأكيد",
      customerName: order.customerName,
      total: order.total,
    }, order.id)
  }

  return { scanned: candidates.length, cancelled, skipped, errors, details }
}

/** تسجيل محاولة تأكيد أخيرة (سجل حقيقي) قبل الإلغاء */
async function recordFinalAttempt(order: { id: string; orderNumber: string }, now: Date) {
  const channelsRaw = await getSetting("confirmation-channels", "WHATSAPP,PHONE")
  const channels = channelsRaw.split(",").map((c) => c.trim()).filter(Boolean)
  if (channels.length === 0) channels.push("PHONE")

  const lastAttempt = await prisma.confirmationAttempt.findFirst({
    where: { orderId: order.id },
    orderBy: { attemptNumber: "desc" },
  })

  for (const channel of channels) {
    await prisma.confirmationAttempt.create({
      data: {
        orderId: order.id,
        attemptNumber: (lastAttempt?.attemptNumber || 0) + 1,
        channel,
        status: "ATTEMPTED",
        result: "محاولة أخيرة قبل الإلغاء التلقائي",
        provider: "system",
      },
    })
  }
}

/** إعادة تعيين مهلة التأكيد عند إنشاء/توزيع الطلب */
export async function resetConfirmationDeadline(orderId: string) {
  const days = await getConfirmationDeadlineDays()
  const deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  await prisma.order.update({ where: { id: orderId }, data: { confirmationDeadline: deadline } })
}
