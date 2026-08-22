import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

function periodRange(period: string): Date {
  const now = new Date()
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === "week") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const period = req.nextUrl.searchParams.get("period") || "week"
    const start = periodRange(period)

    const [orders, commissionLogs] = await Promise.all([
      prisma.order.findMany({
        where: { affiliateId: session.user.id, createdAt: { gte: start } },
        select: { id: true, total: true, status: true, createdAt: true },
      }),
      prisma.commissionLog.findMany({
        where: { userId: session.user.id, createdAt: { gte: start } },
        select: { amount: true, createdAt: true },
      }),
    ])

    const orderIds = orders.map((o) => o.id)
    const itemGroups =
      orderIds.length > 0
        ? await prisma.orderItem.groupBy({
            by: ["productId"],
            where: { orderId: { in: orderIds } },
            _sum: { quantity: true, total: true },
            orderBy: { _sum: { total: "desc" } },
          })
        : []

    let bestProduct: {
      productId: string
      quantity: number
      sales: number
      nameAr: string
      name: string
      image: string | null
    } | null = null
    if (itemGroups.length > 0) {
      const top = itemGroups[0]
      const product = await prisma.product.findUnique({
        where: { id: top.productId },
        select: { id: true, nameAr: true, name: true, image: true },
      })
      bestProduct = {
        productId: top.productId,
        quantity: top._sum.quantity || 0,
        sales: top._sum.total || 0,
        nameAr: product?.nameAr || "",
        name: product?.name || "",
        image: product?.image || null,
      }
    }

    const dayMap: Record<string, { date: string; orders: number; sales: number; commission: number }> = {}
    const dayKey = (d: Date) => d.toISOString().slice(0, 10)
    for (const o of orders) {
      const k = dayKey(o.createdAt)
      if (!dayMap[k]) dayMap[k] = { date: k, orders: 0, sales: 0, commission: 0 }
      dayMap[k].orders++
      dayMap[k].sales += o.total
    }
    for (const c of commissionLogs) {
      const k = dayKey(c.createdAt)
      if (!dayMap[k]) dayMap[k] = { date: k, orders: 0, sales: 0, commission: 0 }
      dayMap[k].commission += c.amount
    }
    const series = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))

    const delivered = orders.filter((o) => o.status === "DELIVERED" || o.status === "COLLECTED").length
    const cancelled = orders.filter((o) => o.status === "CANCELLED" || o.status === "RETURNED").length
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0)
    const totalCommission = commissionLogs.reduce((sum, c) => sum + c.amount, 0)

    let bestDay: { date: string; orders: number; sales: number; commission: number } | null = null
    if (series.length > 0) {
      bestDay = series.reduce((a, b) => (b.orders > a.orders ? b : a))
    }
    return NextResponse.json({
      period,
      totals: {
        orders: orders.length,
        delivered,
        cancelled,
        sales: totalSales,
        commission: totalCommission,
        estNetProfit: totalCommission,
        deliveryRate: orders.length > 0 ? (delivered / orders.length) * 100 : 0,
      },
      bestProduct,
      bestDay,
      series,
    })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
