import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const yearStart = new Date(now.getFullYear(), 0, 1)

    const [
      todayOrders,
      monthOrders,
      yearOrders,
      totalOrders,
      deliveredOrders,
      cancelledOrders,
      todayEarnings,
      monthEarnings,
      yearEarnings,
      totalEarnings,
      topProducts,
      recentOrders,
      monthlyData,
    ] = await Promise.all([
      prisma.order.count({
        where: { affiliateId: userId, createdAt: { gte: todayStart } }
      }),
      prisma.order.count({
        where: { affiliateId: userId, createdAt: { gte: monthStart } }
      }),
      prisma.order.count({
        where: { affiliateId: userId, createdAt: { gte: yearStart } }
      }),
      prisma.order.count({ where: { affiliateId: userId } }),
      prisma.order.count({ where: { affiliateId: userId, status: "DELIVERED" } }),
      prisma.order.count({ where: { affiliateId: userId, status: "CANCELLED" } }),
      prisma.commissionLog.aggregate({
        where: { userId, createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      prisma.commissionLog.aggregate({
        where: { userId, createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.commissionLog.aggregate({
        where: { userId, createdAt: { gte: yearStart } },
        _sum: { amount: true },
      }),
      prisma.commissionLog.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: { affiliateId: userId } },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 5,
      }),
      prisma.order.findMany({
        where: { affiliateId: userId },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      // Monthly data for chart - last 12 months using Prisma (SQLite compatible)
      (async () => {
        const orders = await prisma.order.findMany({
          where: { affiliateId: userId, createdAt: { gte: yearStart } },
          select: { createdAt: true, total: true },
          orderBy: { createdAt: "asc" },
        })
        const monthlyMap: Record<string, { orders: number; revenue: number }> = {}
        for (const o of orders) {
          const key = o.createdAt.toISOString().slice(0, 7)
          if (!monthlyMap[key]) monthlyMap[key] = { orders: 0, revenue: 0 }
          monthlyMap[key].orders++
          monthlyMap[key].revenue += o.total
        }
        return Object.entries(monthlyMap).map(([month, data]) => ({
          month,
          orders: data.orders,
          revenue: data.revenue,
        }))
      })(),
    ])

    // Enrich top products with product details (single query instead of N+1)
    const productIds = topProducts.map((tp: any) => tp.productId)
    const products = productIds.length > 0
      ? await prisma.product.findMany({ where: { id: { in: productIds } } })
      : []
    const productMap = new Map(products.map(p => [p.id, p]))
    const enrichedTopProducts = topProducts.map((tp: any) => ({
      ...tp,
      product: productMap.get(tp.productId) || null,
    }))

    return NextResponse.json({
      stats: {
        todayOrders,
        monthOrders,
        yearOrders,
        totalOrders,
        deliveredOrders,
        cancelledOrders,
        confirmationRate: totalOrders > 0 ? ((totalOrders - cancelledOrders) / totalOrders * 100).toFixed(1) : "0",
        deliveryRate: totalOrders > 0 ? (deliveredOrders / totalOrders * 100).toFixed(1) : "0",
        todayEarnings: todayEarnings._sum.amount || 0,
        monthEarnings: monthEarnings._sum.amount || 0,
        yearEarnings: yearEarnings._sum.amount || 0,
        totalEarnings: totalEarnings._sum.amount || 0,
      },
      topProducts: enrichedTopProducts,
      recentOrders,
      monthlyData,
    })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
