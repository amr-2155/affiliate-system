import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, requireAdminActor, actorCan, logActivity } from "@/lib/admin-guard"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"
import { formatCurrency } from "@/lib/utils"
import { SUPPLIER_STATUS, SUPPLIER_STATUS_META } from "@/lib/supplier-referrals"
import { getCampaignSettings, getQualifyingOrders, referralIsExpired } from "@/lib/supplier-bonus"

const ALLOWED_STATUSES: string[] = [
  SUPPLIER_STATUS.PENDING,
  SUPPLIER_STATUS.UNDER_REVIEW,
  SUPPLIER_STATUS.APPROVED,
  SUPPLIER_STATUS.CONTACTED,
  SUPPLIER_STATUS.ONBOARDING,
  SUPPLIER_STATUS.ACTIVE,
  SUPPLIER_STATUS.REJECTED,
  SUPPLIER_STATUS.EXPIRED,
]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("suppliers.view")
    if (guard instanceof NextResponse) return guard
    const { id } = await params

    const referral = await prisma.supplierReferral.findUnique({
      where: { id },
      include: {
        affiliate: { select: { id: true, name: true, email: true } },
        events: { orderBy: { createdAt: "desc" } },
        bonusLedger: { orderBy: { createdAt: "desc" } },
        products: { select: { id: true, nameAr: true, name: true, sku: true, price: true } },
      },
    })
    if (!referral) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const qualifyingOrders = await getQualifyingOrders(id)
    const earned = referral.bonusLedger.filter((b) => b.status === "EARNED").reduce((s, b) => s + b.amount, 0)
    const paid = referral.bonusLedger.filter((b) => b.status === "PAID").reduce((s, b) => s + b.amount, 0)

    return NextResponse.json({
      ...referral,
      displayStatus: referralIsExpired(referral) ? SUPPLIER_STATUS.EXPIRED : referral.status,
      qualifyingCount: qualifyingOrders.length,
      earned,
      paid,
      statusMeta: SUPPLIER_STATUS_META,
    })
  } catch (error) {
    console.error("admin supplier-referral GET error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminActor()
    if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
    if (!actorCan(actor, "suppliers.manage")) {
      return NextResponse.json({ error: "ليس لديك صلاحية لهذا الإجراء" }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { action } = body

    const referral = await prisma.supplierReferral.findUnique({ where: { id } })
    if (!referral) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    switch (action) {
      case "status": {
        const target = String(body.status || "")
        if (!ALLOWED_STATUSES.includes(target)) {
          return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 })
        }
        if (target === SUPPLIER_STATUS.REJECTED && !body.rejectReason) {
          return NextResponse.json({ error: "سبب الرفض مطلوب" }, { status: 400 })
        }

        const data: any = { status: target }
        if (target === SUPPLIER_STATUS.REJECTED) {
          data.rejectReason = String(body.rejectReason).trim()
        } else {
          data.rejectReason = null
        }

        if (target === SUPPLIER_STATUS.ACTIVE) {
          const settings = await getCampaignSettings()
          const activationDate = referral.activationDate || new Date()
          const campaignEndDate =
            referral.campaignEndDate ||
            new Date(activationDate.getTime() + settings.durationDays * 86400000)
          data.activationDate = activationDate
          data.campaignEndDate = campaignEndDate
        }

        await prisma.supplierReferral.update({ where: { id }, data })
        await prisma.supplierReferralEvent.create({
          data: {
            referralId: id,
            actorId: actor.id,
            actorRole: actor.role,
            action: "STATUS_CHANGED",
            fromStatus: referral.status,
            toStatus: target,
            note: target === SUPPLIER_STATUS.REJECTED ? String(body.rejectReason).trim() : undefined,
          },
        })
        await logActivity(actor.id, "SUPPLIER_REFERRAL_STATUS", "suppliers", `تغيير حالة «${referral.supplierName}» من ${referral.status} إلى ${target}`, id)

        // إشعارات المسوق حسب الحدث.
        const notifyMap: Record<string, { title: string; message: string }> = {
          [SUPPLIER_STATUS.APPROVED]: {
            title: "تم قبول موردك ✅",
            message: `تم اعتماد ترشيح «${referral.supplierName}» — سيتواصل معك الفريق لتجهيزه.`,
          },
          [SUPPLIER_STATUS.ACTIVE]: {
            title: "موردك أصبح نشطًا 🎉",
            message: `بدأت حملة «${referral.supplierName}» — كل طلب تسليم/تحصيل عبره يضيف بونصًا لمحفظتك.`,
          },
          [SUPPLIER_STATUS.REJECTED]: {
            title: "تم رفض ترشيح موردك",
            message: `عذرًا، لم يُقبل ترشيح «${referral.supplierName}»${body.rejectReason ? `: ${body.rejectReason}` : ""}.`,
          },
        }
        const n = notifyMap[target]
        if (n) {
          notify({
            title: n.title,
            message: n.message,
            type: NOTIFICATION_TYPE.REWARD,
            userId: referral.affiliateId,
            link: "/referrals",
            relatedId: referral.id,
          })
        }
        return NextResponse.json({ success: true })
      }

      case "notes": {
        const note = String(body.note || "").trim()
        if (!note) return NextResponse.json({ error: "الملاحظة مطلوبة" }, { status: 400 })
        const appended = referral.internalNotes ? `${referral.internalNotes}\n[${new Date().toLocaleString("ar-EG")}] ${actor.name}: ${note}` : `[${new Date().toLocaleString("ar-EG")}] ${actor.name}: ${note}`
        await prisma.supplierReferral.update({ where: { id }, data: { internalNotes: appended } })
        await prisma.supplierReferralEvent.create({
          data: { referralId: id, actorId: actor.id, actorRole: actor.role, action: "NOTE_ADDED", note },
        })
        await logActivity(actor.id, "SUPPLIER_REFERRAL_NOTE", "suppliers", `إضافة ملاحظة على «${referral.supplierName}»`, id)
        return NextResponse.json({ success: true, internalNotes: appended })
      }

      case "link": {
        const productIds = Array.isArray(body.productIds) ? body.productIds.filter((p: any) => typeof p === "string") : []
        if (!productIds.length && (body.productIds as any[] | undefined)?.length) {
          return NextResponse.json({ error: "معرّفات المنتجات غير صالحة" }, { status: 400 })
        }
        // فك ربط المنتجات الحالية ثم ربط المحددة — عملية حتمية.
        await prisma.product.updateMany({ where: { supplierReferralId: id }, data: { supplierReferralId: null } })
        if (productIds.length > 0) {
          const existing = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })
          const validIds = existing.map((p) => p.id)
          if (validIds.length !== productIds.length) {
            return NextResponse.json({ error: "بعض المنتجات غير موجودة" }, { status: 400 })
          }
          await prisma.product.updateMany({ where: { id: { in: validIds } }, data: { supplierReferralId: id } })
        }
        await prisma.supplierReferralEvent.create({
          data: {
            referralId: id,
            actorId: actor.id,
            actorRole: actor.role,
            action: "PRODUCTS_LINKED",
            note: `ربط ${productIds.length} منتج`,
          },
        })
        await logActivity(actor.id, "SUPPLIER_REFERRAL_PRODUCTS", "suppliers", `ربط ${productIds.length} منتج بـ«${referral.supplierName}»`, id)
        return NextResponse.json({ success: true, linked: productIds.length })
      }

      case "pay": {
        const pending = await prisma.bonusLedger.findMany({
          where: { referralId: id, status: "EARNED" },
          select: { id: true, amount: true },
        })
        if (pending.length === 0) {
          return NextResponse.json({ error: "لا يوجد بونص مستحق للصرف" }, { status: 400 })
        }
        const total = pending.reduce((s, p) => s + p.amount, 0)
        await prisma.$transaction([
          prisma.user.update({
            where: { id: referral.affiliateId },
            data: { balance: { increment: total }, totalEarnings: { increment: total } },
          }),
          prisma.bonusLedger.updateMany({
            where: { referralId: id, status: "EARNED" },
            data: { status: "PAID", paidAt: new Date() },
          }),
        ])
        await prisma.supplierReferralEvent.create({
          data: {
            referralId: id,
            actorId: actor.id,
            actorRole: actor.role,
            action: "BONUS_PAID",
            note: `صرف ${formatCurrency(total)} لـ ${pending.length} بونص`,
          },
        })
        await logActivity(actor.id, "SUPPLIER_BONUS_PAID", "suppliers", `صرف بونص «${referral.supplierName}» = ${formatCurrency(total)}`, id)
        notify({
          title: "تم صرف بونص موردك 💰",
          message: `تم صرف ${formatCurrency(total)} من بونصات «${referral.supplierName}» إلى رصيدك وأصبحت متاحة للسحب.`,
          type: NOTIFICATION_TYPE.EARNINGS,
          userId: referral.affiliateId,
          link: "/referrals",
          relatedId: referral.id,
        })
        return NextResponse.json({ success: true, paid: total, count: pending.length })
      }

      default:
        return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 })
    }
  } catch (error) {
    console.error("admin supplier-referral PUT error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
