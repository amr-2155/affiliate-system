import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { normalizePhone, SUPPLIER_STATUS } from "@/lib/supplier-referrals"
import { getCampaignSettings, notifyCampaignEndWarnings, getQualifyingOrders, referralIsExpired, daysLeftInCampaign } from "@/lib/supplier-bonus"

const REQUIRED_FIELDS = ["supplierName", "brandName", "phone", "city", "productType", "contactMethod"] as const

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const settings = await getCampaignSettings()
    const referrals = await prisma.supplierReferral.findMany({
      where: { affiliateId: session.user.id },
      include: {
        _count: { select: { bonusLedger: true } },
        bonusLedger: { orderBy: { createdAt: "desc" } },
        products: { select: { id: true, nameAr: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const enriched = await Promise.all(
      referrals.map(async (r) => {
        const qualifyingOrders = await getQualifyingOrders(r.id)
        const earned = r.bonusLedger.filter((b) => b.status === "EARNED").reduce((s, b) => s + b.amount, 0)
        const paid = r.bonusLedger.filter((b) => b.status === "PAID").reduce((s, b) => s + b.amount, 0)
        const displayStatus = referralIsExpired(r) ? SUPPLIER_STATUS.EXPIRED : r.status
        return {
          ...r,
          displayStatus,
          earned,
          paid,
          qualifyingCount: qualifyingOrders.length,
          daysLeft: daysLeftInCampaign(r),
        }
      }),
    )

    // إشعار الاقتراب من نهاية الحملة — مرة واحدة لكل مورد.
    notifyCampaignEndWarnings(session.user.id).catch(() => {})

    return NextResponse.json({
      referrals: enriched,
      settings: {
        enabled: settings.enabled,
        bonusPerOrder: settings.bonusPerOrder,
        includeCollected: settings.includeCollected,
        campaignStart: settings.campaignStart,
        campaignEnd: settings.campaignEnd,
        maxBonusPerSupplier: settings.maxBonusPerSupplier,
        minEligibleOrders: settings.minEligibleOrders,
        durationDays: settings.durationDays,
      },
    })
  } catch (error) {
    console.error("supplier-referrals GET error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const settings = await getCampaignSettings()
    if (!settings.enabled) {
      return NextResponse.json({ error: "حملة إضافة الموردين متوقفة حاليًا" }, { status: 403 })
    }

    const body = await req.json()
    for (const field of REQUIRED_FIELDS) {
      if (!body[field] || !String(body[field]).trim()) {
        return NextResponse.json({ error: `الحقل مطلوب: ${field}` }, { status: 400 })
      }
    }
    // تأكيد مسبق إلزامي — لا نستقبل ترشيحات غير مكتملة أو غير مؤكدة.
    if (body.dataConfirmed !== true) {
      return NextResponse.json({ error: "يجب تأكيد بيانات المورد قبل الإرسال" }, { status: 400 })
    }

    const phoneKey = normalizePhone(body.phone)
    if (!phoneKey) {
      return NextResponse.json({ error: "رقم هاتف غير صالح" }, { status: 400 })
    }

    const duplicate = await prisma.supplierReferral.findFirst({ where: { phoneKey } })
    if (duplicate) {
      // قاعدة أول من رشّح: نفس رقم الهاتف يمنع الترشيح مرة أخرى من أي مسوق.
      return NextResponse.json(
        {
          error: "هذا المورد مرشح بالفعل",
          reason: "أول من رشّح المورد يحصل على الإحالة — لا يمكن الترشيح المكرر لنفس رقم الهاتف",
          existingStatus: duplicate.status,
        },
        { status: 409 },
      )
    }

    const referral = await prisma.supplierReferral.create({
      data: {
        affiliateId: session.user.id,
        supplierName: String(body.supplierName).trim(),
        brandName: String(body.brandName).trim(),
        phone: String(body.phone).trim(),
        phoneKey,
        whatsapp: body.whatsapp ? String(body.whatsapp).trim() : null,
        city: String(body.city).trim(),
        productType: String(body.productType).trim(),
        storeUrl: body.storeUrl ? String(body.storeUrl).trim() : null,
        expectedProducts: Math.max(0, parseInt(body.expectedProducts) || 0),
        notes: body.notes ? String(body.notes).trim() : null,
        contactMethod: String(body.contactMethod).trim(),
        dataConfirmed: true,
        status: SUPPLIER_STATUS.PENDING,
        events: {
          create: {
            actorId: session.user.id,
            actorRole: "AFFILIATE",
            action: "CREATED",
            note: "تم إرسال ترشيح المورد وتأكيد بياناته",
          },
        },
      },
    })

    return NextResponse.json({ referral }, { status: 201 })
  } catch (error) {
    console.error("supplier-referrals POST error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
