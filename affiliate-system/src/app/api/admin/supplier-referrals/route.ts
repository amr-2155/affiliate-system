import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"
import { SUPPLIER_STATUS, SUPPLIER_STATUS_META } from "@/lib/supplier-referrals"
import { getCampaignSettings, getQualifyingOrders, referralIsExpired } from "@/lib/supplier-bonus"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("suppliers.view")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "ALL"
    const view = searchParams.get("view") || "list"

    const settings = await getCampaignSettings()

    // قائمة الموردين المرشحين مع ملخص الحالة والإجمالي.
    const where: any = {}
    if (status !== "ALL") where.status = status

    const referrals = await prisma.supplierReferral.findMany({
      where,
      include: {
        affiliate: { select: { id: true, name: true, email: true } },
        _count: { select: { bonusLedger: true } },
        bonusLedger: { select: { amount: true, status: true, createdAt: true } },
        products: { select: { id: true, nameAr: true, name: true, sku: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const withStats = await Promise.all(
      referrals.map(async (r) => {
        const qualifyingOrders = await getQualifyingOrders(r.id)
        const earned = r.bonusLedger.filter((b) => b.status === "EARNED").reduce((s, b) => s + b.amount, 0)
        const paid = r.bonusLedger.filter((b) => b.status === "PAID").reduce((s, b) => s + b.amount, 0)
        return {
          ...r,
          displayStatus: referralIsExpired(r) ? SUPPLIER_STATUS.EXPIRED : r.status,
          qualifyingCount: qualifyingOrders.length,
          earned,
          paid,
        }
      }),
    )

    if (view === "dashboard") {
      const allReferrals = await prisma.supplierReferral.findMany({
        select: { status: true, bonusLedger: { select: { amount: true, status: true } } },
      })
      const activeReferrals = await prisma.supplierReferral.findMany({
        where: { status: SUPPLIER_STATUS.ACTIVE },
        select: { id: true },
      })
      let qualifyingTotal = 0
      for (const r of activeReferrals) {
        qualifyingTotal += (await getQualifyingOrders(r.id)).length
      }
      const bonusAgg = await prisma.bonusLedger.aggregate({ _sum: { amount: true }, _count: true })
      const dueAgg = await prisma.bonusLedger.aggregate({ where: { status: "EARNED" }, _sum: { amount: true }, _count: true })
      const paidAgg = await prisma.bonusLedger.aggregate({ where: { status: "PAID" }, _sum: { amount: true } })

      const counts: Record<string, number> = { total: allReferrals.length }
      for (const r of allReferrals) counts[r.status] = (counts[r.status] || 0) + 1

      const summary = {
        counts,
        active: counts[SUPPLIER_STATUS.ACTIVE] || 0,
        pending: counts[SUPPLIER_STATUS.PENDING] || 0,
        underReview: counts[SUPPLIER_STATUS.UNDER_REVIEW] || 0,
        approved: (counts[SUPPLIER_STATUS.APPROVED] || 0) + (counts[SUPPLIER_STATUS.CONTACTED] || 0) + (counts[SUPPLIER_STATUS.ONBOARDING] || 0),
        rejected: counts[SUPPLIER_STATUS.REJECTED] || 0,
        expired: counts[SUPPLIER_STATUS.EXPIRED] || 0,
        qualifyingOrders: qualifyingTotal,
        totalBonus: bonusAgg._sum.amount || 0,
        bonusCount: bonusAgg._count || 0,
        dueBonus: dueAgg._sum.amount || 0,
        dueCount: dueAgg._count || 0,
        paidBonus: paidAgg._sum.amount || 0,
      }

      const topAffiliates = await prisma.supplierReferral.groupBy({
        by: ["affiliateId"],
        _count: true,
        orderBy: { _count: { affiliateId: "desc" } },
        take: 5,
      })
      const affiliateNames = await prisma.user.findMany({
        where: { id: { in: topAffiliates.map((a) => a.affiliateId) } },
        select: { id: true, name: true, email: true },
      })
      const nameMap = new Map(affiliateNames.map((u) => [u.id, u]))
      const topAffiliatesList = topAffiliates.map((a) => ({
        ...nameMap.get(a.affiliateId),
        referrals: a._count,
      }))

      const activeWithCounts: { id: string; supplierName: string; brandName: string; affiliateName: string; count: number; earned: number }[] = []
      for (const r of withStats) {
        if (r.displayStatus !== SUPPLIER_STATUS.ACTIVE) continue
        activeWithCounts.push({
          id: r.id,
          supplierName: r.supplierName,
          brandName: r.brandName,
          affiliateName: r.affiliate?.name || r.affiliate?.email || "—",
          count: r.qualifyingCount,
          earned: r.earned + r.paid,
        })
      }
      activeWithCounts.sort((a, b) => b.count - a.count)

      return NextResponse.json({
        view: "dashboard",
        summary,
        topAffiliates: topAffiliatesList,
        topSuppliers: activeWithCounts.slice(0, 5),
        statusMeta: SUPPLIER_STATUS_META,
        settings,
      })
    }

    return NextResponse.json({
      referrals: withStats,
      statusMeta: SUPPLIER_STATUS_META,
      settings,
    })
  } catch (error) {
    console.error("admin supplier-referrals GET error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
