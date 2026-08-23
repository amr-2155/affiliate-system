import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"
import { zonedStartOfDay, zonedStartOfMonth, zonedStartOfYear } from "@/lib/time"

export async function GET() {
  try {
    const guard = await requireAdminPermission("dashboard.view")
    if (guard instanceof NextResponse) return guard

    const now = new Date()
    // Cairo-time boundaries (see src/lib/time.ts — identical to prior local-time behavior)
    const todayStart = zonedStartOfDay(now)
    const monthStart = zonedStartOfMonth(now)
    const yearStart = zonedStartOfYear(now)

    const [
      totalAffiliates,
      activeAffiliates,
      totalProducts,
      totalOrders,
      todayOrders,
      monthOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
      monthRevenue,
      pendingWithdrawals,
      totalCommission,
      topAffiliates,
      recentOrders,
      monthlyData,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "AFFILIATE" } }),
      prisma.user.count({ where: { role: "AFFILIATE", status: "ACTIVE" } }),
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.count({ where: { status: "DELIVERED" } }),
      prisma.order.count({ where: { status: "CANCELLED" } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { status: { in: ["DELIVERED", "SHIPPED", "CONFIRMED"] } } }),
      prisma.order.aggregate({ _sum: { total: true }, where: { createdAt: { gte: monthStart }, status: { in: ["DELIVERED", "SHIPPED", "CONFIRMED"] } } }),
      prisma.withdrawal.count({ where: { status: "PENDING" } }),
      prisma.commissionLog.aggregate({ _sum: { amount: true } }),
      prisma.user.findMany({
        where: { role: "AFFILIATE" },
        select: {
          id: true, name: true, email: true, totalEarnings: true, balance: true,
          _count: { select: { orders: true } },
        },
        orderBy: { totalEarnings: "desc" },
        take: 5,
      }),
      prisma.order.findMany({
        include: { affiliate: { select: { name: true } }, items: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      (async () => {
        const orders = await prisma.order.findMany({
          where: { createdAt: { gte: yearStart } },
          select: { createdAt: true, total: true },
          orderBy: { createdAt: "asc" },
        })
        const map: Record<string, { orders: number; revenue: number }> = {}
        for (const o of orders) {
          const key = o.createdAt.toISOString().slice(0, 7)
          if (!map[key]) map[key] = { orders: 0, revenue: 0 }
          map[key].orders++
          map[key].revenue += o.total
        }
        return Object.entries(map).map(([month, d]) => ({ month, orders: d.orders, revenue: d.revenue }))
      })(),
    ])

    return NextResponse.json({
      stats: {
        totalAffiliates, activeAffiliates, totalProducts, totalOrders,
        todayOrders, monthOrders, deliveredOrders, cancelledOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        monthRevenue: monthRevenue._sum.total || 0,
        confirmationRate: totalOrders > 0 ? ((totalOrders - cancelledOrders) / totalOrders * 100).toFixed(1) : "0",
        deliveryRate: totalOrders > 0 ? (deliveredOrders / totalOrders * 100).toFixed(1) : "0",
        pendingWithdrawals,
        totalCommission: totalCommission._sum.amount || 0,
      },
      topAffiliates, recentOrders, monthlyData,
    })
  } catch (error: any) {
    console.error("Admin dashboard error:", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
