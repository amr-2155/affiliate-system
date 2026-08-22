import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function GET() {
  try {
    const guard = await requireAdminPermission("affiliates.view")
    if (guard instanceof NextResponse) return guard

    const [affiliates, commissionRows, withdrawnRows] = await Promise.all([
      prisma.user.findMany({
        where: { role: "AFFILIATE" },
        select: { id: true, status: true, _count: { select: { orders: true } } },
      }),
      prisma.commissionLog.groupBy({ by: ["userId"], _sum: { amount: true } }),
      prisma.withdrawal.groupBy({
        by: ["userId"],
        where: { status: "COMPLETED" },
        _sum: { amount: true },
      }),
    ])

    const commissions: Record<string, number> = {}
    for (const row of commissionRows) commissions[row.userId] = row._sum.amount || 0

    const withdrawn: Record<string, number> = {}
    for (const row of withdrawnRows) withdrawn[row.userId] = row._sum.amount || 0

    const perUser: Record<string, { commissions: number; withdrawn: number; owed: number }> = {}
    for (const a of affiliates) {
      const c = commissions[a.id] || 0
      const w = withdrawn[a.id] || 0
      perUser[a.id] = { commissions: c, withdrawn: w, owed: Math.max(0, c - w) }
    }

    const totals = {
      total: affiliates.length,
      active: affiliates.filter(a => a.status === "ACTIVE").length,
      totalOrders: affiliates.reduce((s, a) => s + a._count.orders, 0),
      totalCommissions: Object.values(perUser).reduce((s, u) => s + u.commissions, 0),
      totalWithdrawn: Object.values(perUser).reduce((s, u) => s + u.withdrawn, 0),
      totalOwed: Object.values(perUser).reduce((s, u) => s + u.owed, 0),
    }

    return NextResponse.json({ perUser, totals })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
