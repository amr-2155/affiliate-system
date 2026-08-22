import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

const EARN_STATUSES = ["DELIVERED", "SHIPPED", "CONFIRMED"]

const localKey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fillDays(count: number) {
  const arr: { key: string; label: string; revenue: number; orders: number }[] = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    arr.push({ key: localKey(d), label: `${d.getDate()}/${d.getMonth() + 1}`, revenue: 0, orders: 0 })
  }
  return arr
}

function fillWeeks(count: number) {
  const arr: { key: string; label: string; revenue: number; orders: number }[] = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dow = (today.getDay() + 6) % 7
  const monday = new Date(today); monday.setDate(today.getDate() - dow)
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(monday); m.setDate(monday.getDate() - i * 7)
    arr.push({ key: localKey(m), label: `${m.getDate()}/${m.getMonth() + 1}`, revenue: 0, orders: 0 })
  }
  return arr
}

export async function GET() {
  try {
    const guard = await requireAdminPermission("dashboard.view")
    if (guard instanceof NextResponse) return guard

    const daysAgo = new Date(); daysAgo.setDate(daysAgo.getDate() - 13); daysAgo.setHours(0, 0, 0, 0)
    const weeksAgo = new Date(); weeksAgo.setDate(weeksAgo.getDate() - 7 * 7); weeksAgo.setHours(0, 0, 0, 0)

    const [statusGroups, itemGroups, latestAffiliates, recentNotifications, dayOrders, weekOrders] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      prisma.user.findMany({
        where: { role: "AFFILIATE" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: true } } },
      }),
      prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { user: { select: { name: true } } },
      }),
      prisma.order.findMany({ where: { createdAt: { gte: daysAgo }, status: { in: EARN_STATUSES } }, select: { createdAt: true, total: true } }),
      prisma.order.findMany({ where: { createdAt: { gte: weeksAgo }, status: { in: EARN_STATUSES } }, select: { createdAt: true, total: true } }),
    ])

    const daily = fillDays(14)
    const dailyMap = Object.fromEntries(daily.map(d => [d.key, d]))
    for (const o of dayOrders) {
      const b = dailyMap[localKey(new Date(o.createdAt))]
      if (b) { b.revenue += o.total; b.orders += 1 }
    }

    const weekly = fillWeeks(8)
    const weeklyMap = Object.fromEntries(weekly.map(w => [w.key, w]))
    for (const o of weekOrders) {
      const d = new Date(o.createdAt); d.setHours(0, 0, 0, 0)
      const dow = (d.getDay() + 6) % 7
      const monday = new Date(d); monday.setDate(d.getDate() - dow)
      const b = weeklyMap[localKey(monday)]
      if (b) { b.revenue += o.total; b.orders += 1 }
    }

    const products = itemGroups.length
      ? await prisma.product.findMany({
          where: { id: { in: itemGroups.map(g => g.productId) } },
          select: { id: true, nameAr: true, image: true },
        })
      : []
    const productMap = Object.fromEntries(products.map(p => [p.id, p]))
    const topProducts = itemGroups.map(g => ({
      id: g.productId,
      nameAr: productMap[g.productId]?.nameAr || "منتج محذوف",
      image: productMap[g.productId]?.image || null,
      totalQty: g._sum.quantity || 0,
      totalRevenue: g._sum.total || 0,
    }))

    const ordersByStatus = statusGroups.map(g => ({ status: g.status, count: g._count._all }))

    return NextResponse.json({
      ordersByStatus,
      topProducts,
      latestAffiliates,
      recentNotifications,
      dailyEarnings: daily,
      weeklyEarnings: weekly,
    })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
