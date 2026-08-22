import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("confirmation.reports")
    if (guard instanceof NextResponse) return guard

    const [total, active, pendingOrders, assignedOrders, confirmedOrders, successRateAgg, verifiers] = await Promise.all([
      prisma.user.count({ where: { role: "VERIFIER" } }),
      prisma.user.count({ where: { role: "VERIFIER", status: "ACTIVE" } }),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { reviewerId: { not: null } } }),
      prisma.order.count({ where: { confirmedById: { not: null } } }),
      prisma.order.groupBy({
        by: ["reviewerId"],
        where: { reviewerId: { not: null } },
        _count: { _all: true },
      }),
      prisma.user.findMany({ where: { role: "VERIFIER" }, select: { id: true } }),
    ])

    const totalAssigned = successRateAgg.reduce((s, r: any) => s + r._count._all, 0)
    const avgSuccess = totalAssigned > 0 ? Math.round((confirmedOrders / totalAssigned) * 100) : 0

    return NextResponse.json({
      total,
      active,
      inactive: total - active,
      pendingOrders,
      assignedOrders,
      confirmedOrders,
      avgSuccess,
      autoAssignEligible: verifiers.filter(() => true).length,
    })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
