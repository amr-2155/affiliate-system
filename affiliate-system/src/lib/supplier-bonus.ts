import { prisma } from "@/lib/prisma"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"
import { formatCurrency } from "@/lib/utils"
import { SUPPLIER_STATUS } from "@/lib/supplier-referrals"

/** الحالات النهائية التي يمنح عليها بونص الموردين (تحصيل فعلي/تسليم فعلي فقط). */
export const BONUS_COUNT_STATUSES = ["DELIVERED", "COLLECTED"] as const
export const BONUS_REVOKE_STATUSES = ["CANCELLED", "RETURNED", "REJECTED"] as const
/** الحالات النهائية التي لا يمنح عليها بونص إطلاقًا. */
export const BONUS_NON_EARNING_STATUSES = ["PENDING", "UNDER_REVIEW", "CONFIRMED", "PROCESSING", "SHIPPED"] as const

export interface CampaignSettings {
  enabled: boolean
  bonusPerOrder: number
  includeCollected: boolean
  campaignStart: Date | null
  campaignEnd: Date | null
  maxBonusPerSupplier: number | null
  maxTotalBonus: number | null
  minEligibleOrders: number
  durationDays: number
  durationStartFromActivation: boolean
}

export async function getCampaignSettings(): Promise<CampaignSettings> {
  const row = await prisma.supplierCampaignSettings.findUnique({ where: { id: "supplier-campaign" } })
  return {
    enabled: row?.enabled ?? false,
    bonusPerOrder: row?.bonusPerOrder ?? 5,
    includeCollected: row?.includeCollected ?? true,
    campaignStart: row?.campaignStart ?? null,
    campaignEnd: row?.campaignEnd ?? null,
    maxBonusPerSupplier: row?.maxBonusPerSupplier ?? null,
    maxTotalBonus: row?.maxTotalBonus ?? null,
    minEligibleOrders: row?.minEligibleOrders ?? 0,
    durationDays: row?.durationDays ?? 30,
    durationStartFromActivation: row?.durationStartFromActivation ?? true,
  }
}

/** نافذة حملة المورد: تبدأ من تاريخ التفعيل (أو الترشيح حسب الإعداد) وتنتهي عند تاريخ نهاية الحملة المخزّن. */
export function campaignWindow(
  referral: { activationDate: Date | null; campaignEndDate: Date | null },
  settings: CampaignSettings,
): { start: Date | null; end: Date | null } {
  if (!referral.activationDate) return { start: null, end: null }
  let start = referral.activationDate
  let end = referral.campaignEndDate || new Date(start.getTime() + settings.durationDays * 86400000)
  if (settings.campaignStart && settings.campaignStart > start) start = settings.campaignStart
  if (settings.campaignEnd && settings.campaignEnd < end) end = settings.campaignEnd
  return { start, end }
}

export function referralIsExpired(referral: { campaignEndDate: Date | null; status?: string }): boolean {
  if (!referral.campaignEndDate) return false
  if (referral.status === SUPPLIER_STATUS.EXPIRED) return true
  return referral.campaignEndDate.getTime() < Date.now()
}

/** عدد الأيام المتبقية في حملة المورد (0 إذا انتهت). */
export function daysLeftInCampaign(referral: { campaignEndDate: Date | null }): number {
  if (!referral.campaignEndDate) return 0
  const diff = referral.campaignEndDate.getTime() - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / 86400000)
}

interface QualifyingOrder {
  id: string
  orderNumber: string
  status: string
  deliveredAt: Date | null
  collectedAt: Date | null
}

/** الطلبات المؤهلة لبونص مورد معيّن ضمن نافذة حملته وحسب إعدادات الحملة. */
export async function getQualifyingOrders(referralId: string): Promise<QualifyingOrder[]> {
  const settings = await getCampaignSettings()
  const referral = await prisma.supplierReferral.findUnique({ where: { id: referralId } })
  if (!referral) return []
  const win = campaignWindow(referral, settings)
  if (!win.start || !win.end) return []

  const where: any = {
    affiliateId: referral.affiliateId,
    items: { some: { product: { supplierReferralId: referral.id } } },
  }
  const or: any[] = []
  if (settings.includeCollected) {
    or.push({ status: "DELIVERED", deliveredAt: { gte: win.start, lte: win.end } })
    or.push({ status: "COLLECTED", collectedAt: { gte: win.start, lte: win.end } })
  } else {
    or.push({ status: "DELIVERED", deliveredAt: { gte: win.start, lte: win.end } })
  }
  where.OR = or

  const orders = await prisma.order.findMany({
    where,
    select: { id: true, orderNumber: true, status: true, deliveredAt: true, collectedAt: true },
    orderBy: [{ deliveredAt: "asc" }, { collectedAt: "asc" }],
  })
  return orders
}

export interface SettleResult {
  awarded: number
  skipped: number
}

/**
 * احتساب بونصات مورد واحد — آمن للتكرار:
 * - قيد فريد (referralId, orderId) يمنع تكرار البونص لنفس الطلب.
 * - المعاملات تُحتسب داخل حلقة مع التقاط أخطاء القيد الفريد فقط.
 * - حدود الحد الأقصى (لكل مورد / إجمالي الحملة) تُفحص قبل كل إضافة.
 * - عتبة "الحد الأدنى من الطلبات المؤهلة" تُطبق على مستوى المورد.
 */
export async function settleBonusesForReferral(referralId: string): Promise<SettleResult> {
  const settings = await getCampaignSettings()
  if (!settings.enabled || settings.bonusPerOrder <= 0) return { awarded: 0, skipped: 0 }

  const referral = await prisma.supplierReferral.findUnique({ where: { id: referralId } })
  if (!referral || referral.status !== SUPPLIER_STATUS.ACTIVE) return { awarded: 0, skipped: 0 }

  const win = campaignWindow(referral, settings)
  if (!win.start || !win.end) return { awarded: 0, skipped: 0 }

  // انتهت الحملة → ننتقل تلقائيًا إلى EXPIRED ونُخطِر المورد (مرة واحدة).
  if (win.end.getTime() < Date.now()) {
    await prisma.supplierReferral.update({ where: { id: referral.id }, data: { status: SUPPLIER_STATUS.EXPIRED } }).catch(() => {})
    notify({
      title: "انتهت حملة موردك",
      message: `انتهت حملة «${referral.supplierName}» — بونصاتك المحتسبة لا تزال متاحة في صفحة موردوك.`,
      type: NOTIFICATION_TYPE.REWARD,
      userId: referral.affiliateId,
      link: "/referrals",
      relatedId: referral.id,
    })
    return { awarded: 0, skipped: 0 }
  }

  const orders = await getQualifyingOrders(referralId)
  if (settings.minEligibleOrders > 0 && orders.length < settings.minEligibleOrders) return { awarded: 0, skipped: 0 }

  if (!referral.firstQualifiedNotified && orders.length > 0) {
    await prisma.supplierReferral
      .update({ where: { id: referral.id }, data: { firstQualifiedNotified: true } })
      .catch(() => {})
    notify({
      title: "أول طلب مؤهل من موردك 🎯",
      message: `أول طلب من «${referral.supplierName}» أصبح مؤهلًا — كل طلب تسليم/تحصيل خلال الحملة يضيف بونص ${formatCurrency(settings.bonusPerOrder)}.`,
      type: NOTIFICATION_TYPE.REWARD,
      userId: referral.affiliateId,
      link: "/referrals",
      relatedId: referral.id,
    })
  }

  const [perSupplierAgg, totalAgg] = await Promise.all([
    prisma.bonusLedger.aggregate({ where: { referralId }, _sum: { amount: true } }),
    prisma.bonusLedger.aggregate({ _sum: { amount: true } }),
  ])
  let perSupplierTotal = perSupplierAgg._sum.amount || 0
  let globalTotal = totalAgg._sum.amount || 0

  let awarded = 0
  let skipped = 0
  for (const o of orders) {
    if (settings.maxBonusPerSupplier != null && perSupplierTotal >= settings.maxBonusPerSupplier) {
      skipped++
      continue
    }
    if (settings.maxTotalBonus != null && globalTotal >= settings.maxTotalBonus) {
      skipped++
      continue
    }
    const amount = settings.bonusPerOrder
    if (settings.maxBonusPerSupplier != null && perSupplierTotal + amount > settings.maxBonusPerSupplier) {
      skipped++
      continue
    }
    if (settings.maxTotalBonus != null && globalTotal + amount > settings.maxTotalBonus) {
      skipped++
      continue
    }
    try {
      await prisma.bonusLedger.create({
        data: {
          referralId: referral.id,
          affiliateId: referral.affiliateId,
          orderId: o.id,
          orderNumber: o.orderNumber,
          amount,
          status: "EARNED",
        },
      })
      perSupplierTotal += amount
      globalTotal += amount
      awarded++

      if (!referral.firstBonusNotified) {
        await prisma.supplierReferral
          .update({ where: { id: referral.id }, data: { firstBonusNotified: true } })
          .catch(() => {})
        notify({
          title: "حقق أول بونص من موردك 🎉",
          message: `تم احتساب أول بونص من «${referral.supplierName}» بقيمة ${formatCurrency(amount)} — يمكنك متابعة التفاصيل في صفحة موردوك.`,
          type: NOTIFICATION_TYPE.REWARD,
          userId: referral.affiliateId,
          link: "/referrals",
          relatedId: referral.id,
        })
      }
    } catch (e: any) {
      // P2002 = هذا الطلب سبق أن حصل على بونص — نتجاهل بأمان (حماية ضد التكرار).
      if (e?.code === "P2002") {
        skipped++
        continue
      }
      throw e
    }
  }

  return { awarded, skipped }
}

/**
 * احتساب بونصات كل الموردين النشطين دفعة واحدة (وظيفة المجدول).
 * تُشغَّل كل 5 دقائق كشبكة أمان إضافية فوق استدعاءات لحظة التسليم.
 */
export async function settleAllBonuses(): Promise<{ awarded: number; expired: number }> {
  const settings = await getCampaignSettings()
  if (!settings.enabled) return { awarded: 0, expired: 0 }
  const actives = await prisma.supplierReferral.findMany({
    where: { status: SUPPLIER_STATUS.ACTIVE },
    select: { id: true, campaignEndDate: true },
  })
  let expired = 0
  let awarded = 0
  for (const r of actives) {
    if (r.campaignEndDate && r.campaignEndDate.getTime() < Date.now()) {
      await prisma.supplierReferral.update({ where: { id: r.id }, data: { status: SUPPLIER_STATUS.EXPIRED } }).catch(() => {})
      expired++
      continue
    }
    const res = await settleBonusesForReferral(r.id)
    awarded += res.awarded
  }
  return { awarded, expired }
}

/** احتساب بونصات كل الموردين المرتبطين بطلب — يُستدعى عند وصول الطلب للتسليم/التحصيل. */
export async function settleBonusesForOrder(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, affiliateId: true },
  })
  if (!order || !(BONUS_COUNT_STATUSES as readonly string[]).includes(order.status)) return 0

  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { product: { select: { supplierReferralId: true } } },
  })
  const referralIds = [...new Set(items.map((i) => i.product?.supplierReferralId).filter(Boolean))] as string[]
  let total = 0
  for (const rid of referralIds) {
    const r = await prisma.supplierReferral.findUnique({
      where: { id: rid },
      select: { id: true, affiliateId: true, status: true },
    })
    // المورد يجب أن يكون تابعًا لنفس المسوق صاحب الطلب ونشطًا.
    if (!r || r.status !== SUPPLIER_STATUS.ACTIVE || r.affiliateId !== order.affiliateId) continue
    const res = await settleBonusesForReferral(r.id)
    total += res.awarded
  }
  return total
}

/** إبطال بونصات طلب خرج من حالة التسليم/التحصيل (مرتجع/ملغي) — لا يُمسّ إلا غير المصروف. */
export async function revokeBonusesForOrder(orderId: string): Promise<number> {
  const res = await prisma.bonusLedger.deleteMany({
    where: { orderId, status: "EARNED" },
  })
  return res.count
}

/** هل يستحق الطلب بونصًا حسب حالته الحالية؟ */
export function orderCanEarnBonus(status: string): boolean {
  return (BONUS_COUNT_STATUSES as readonly string[]).includes(status)
}

/** إشعار الاقتراب من نهاية الحملة (≤3 أيام) — مرة واحدة لكل مورد. */
export async function notifyCampaignEndWarnings(affiliateId: string): Promise<void> {
  const actives = await prisma.supplierReferral.findMany({
    where: { affiliateId, status: SUPPLIER_STATUS.ACTIVE, endWarningNotified: false },
    select: { id: true, supplierName: true, campaignEndDate: true, endWarningNotified: true },
  })
  for (const r of actives) {
    if (!r.campaignEndDate) continue
    const days = Math.ceil((r.campaignEndDate.getTime() - Date.now()) / 86400000)
    if (days > 0 && days <= 3) {
      await prisma.supplierReferral
        .update({ where: { id: r.id }, data: { endWarningNotified: true } })
        .catch(() => {})
      notify({
        title: "اقترب نهاية حملة موردك ⏳",
        message: `تنتهي حملة «${r.supplierName}» خلال ${days} يوم — حافزك لتسريع تسليم الطلبات المعلقة.`,
        type: NOTIFICATION_TYPE.REWARD,
        userId: affiliateId,
        link: "/referrals",
        relatedId: r.id,
      })
    }
  }
}
