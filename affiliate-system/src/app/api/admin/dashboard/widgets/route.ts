import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"
import {
  zonedStartOfDay,
  zonedWeekStart,
  zonedDateKey,
  zonedCivilParts,
  addDays,
} from "@/lib/time"

const EARN_STATUSES = ["DELIVERED", "SHIPPED", "CONFIRMED"]

// Cairo-time day key + label (see src/lib/time.ts — identical to prior local behavior)
const localKey = (d: Date) => zonedDateKey(d)
const dayLabel = (d: Date) => {
  const p = zonedCivilParts(d)
  return `${p.day}/${p.month}`
}

const relDay = (base: Date, delta: number) => zonedStartOfDay(addDays(base, delta))

function fillDays(count: number) {
  const arr: { key: string; label: string; revenue: number; orders: number }[] = []
  const today = zonedStartOfDay(new Date())
  for (let i = count - 1; i >= 0; i--) {
    const d = relDay(today, -i)
    arr.push({ key: localKey(d), label: dayLabel(d), revenue: 0, orders: 0 })
  }
  return arr
}

function fillWeeks(count: number) {
  const arr: { key: string; label: string; revenue: number; orders: number }[] = []
  const monday = zonedWeekStart(new Date())
  for (let i = count - 1; i >= 0; i--) {
    const m = zonedWeekStart(relDay(monday, -7 * i))
    arr.push({ key: localKey(m), label: dayLabel(m), revenue: 0, orders: 0 })
  }
  return arr
}

export async function GET() {
  try {
    const guard = await requireAdminPermission("dashboard.view")
    if (guard instanceof NextResponse) return guard

    const daysAgo = relDay(new Date(), -13)
    const weeksAgo = zonedWeekStart(addDays(new Date(), -7 * 7))

    const [statusGroups, itemGroups, latestAffiliates, recentNotifications, dayOrders, weekOrders] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.orderItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true, total: true },
        // Deterministic tiebreak for equal quantities
        orderBy: [{ _sum: { quantity: "desc" } }, { productId: "asc" }],
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
      const monday = zonedWeekStart(new Date(o.createdAt))
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
