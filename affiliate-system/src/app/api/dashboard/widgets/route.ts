import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import {
  zonedStartOfDay,
  zonedWeekStart,
  zonedStartOfRelativeMonth,
  zonedMonthKeyOffset,
  addDays,
} from "@/lib/time"

const startOfDay = (d: Date) => zonedStartOfDay(d)

const startOfWeek = (d: Date) => zonedWeekStart(d)

// Exact Cairo-midnight boundary N days from a boundary instant (DST-safe)
const relDay = (base: Date, delta: number) => zonedStartOfDay(addDays(base, delta))

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()
    const todayStart = startOfDay(now)
    const yesterdayStart = relDay(todayStart, -1)
    const weekStart = startOfWeek(now)
    const lastWeekStart = zonedWeekStart(addDays(weekStart, -7))
    // Cairo-time month boundaries (see src/lib/time.ts — identical to prior local-time behavior)
    const monthStart = zonedStartOfRelativeMonth(now, 0)
    const lastMonthStart = zonedStartOfRelativeMonth(now, -1)
    const twelveMonthsAgo = zonedStartOfRelativeMonth(now, -11)

    const commissionSum = (gte: Date, lt?: Date) => prisma.commissionLog.aggregate({
      where: { userId, createdAt: lt ? { gte, lt } : { gte } },
      _sum: { amount: true },
    })

    const orderCount = (gte: Date, lt?: Date) => prisma.order.count({
      where: { affiliateId: userId, createdAt: lt ? { gte, lt } : { gte } },
    })

    const [
      user,
      pendingWithdrawals,
      todayE, yesterdayE, weekE, lastWeekE, monthE, lastMonthE,
      todayO, yesterdayO, weekO, lastWeekO, monthO, lastMonthO,
      statusGroups, logs, recentNotifications,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { balance: true, totalEarnings: true } }),
      prisma.withdrawal.count({ where: { userId, status: "PENDING" } }),
      commissionSum(todayStart), commissionSum(yesterdayStart, todayStart),
      commissionSum(weekStart), commissionSum(lastWeekStart, weekStart),
      commissionSum(monthStart), commissionSum(lastMonthStart, monthStart),
      orderCount(todayStart), orderCount(yesterdayStart, todayStart),
      orderCount(weekStart), orderCount(lastWeekStart, weekStart),
      orderCount(monthStart), orderCount(lastMonthStart, monthStart),
      prisma.order.groupBy({ by: ["status"], where: { affiliateId: userId }, _count: { _all: true } }),
      prisma.commissionLog.findMany({
        where: { userId, createdAt: { gte: twelveMonthsAgo } },
        select: { createdAt: true, amount: true },
      }),
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ])

    const months: { month: string; commission: number }[] = []
    for (let i = 11; i >= 0; i--) {
      months.push({ month: zonedMonthKeyOffset(now, -i), commission: 0 })
    }
    const monthMap = Object.fromEntries(months.map((m) => [m.month, m]))
    for (const l of logs) {
      const key = l.createdAt.toISOString().slice(0, 7)
      if (monthMap[key]) monthMap[key].commission += l.amount
    }

    return NextResponse.json({
      balance: user?.balance || 0,
      totalCommissions: user?.totalEarnings || 0,
      pendingWithdrawals,
      comparison: {
        todayEarnings: todayE._sum.amount || 0,
        yesterdayEarnings: yesterdayE._sum.amount || 0,
        weekEarnings: weekE._sum.amount || 0,
        lastWeekEarnings: lastWeekE._sum.amount || 0,
        monthEarnings: monthE._sum.amount || 0,
        lastMonthEarnings: lastMonthE._sum.amount || 0,
        todayOrders: todayO,
        yesterdayOrders: yesterdayO,
        weekOrders: weekO,
        lastWeekOrders: lastWeekO,
        monthOrders: monthO,
        lastMonthOrders: lastMonthO,
      },
      ordersByStatus: statusGroups.map((g: { status: string | null; _count: { _all: number } }) => ({ status: g.status, count: g._count._all })),
      commissionMonthly: months,
      recentNotifications,
    })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
