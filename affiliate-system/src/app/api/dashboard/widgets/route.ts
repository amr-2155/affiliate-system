import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const startOfWeek = (d: Date) => {
  const x = startOfDay(d)
  const dow = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dow)
  return x
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()
    const todayStart = startOfDay(now)
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(todayStart.getDate() + 1)
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(todayStart.getDate() - 1)
    const weekStart = startOfWeek(now)
    const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)

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
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, commission: 0 })
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
      ordersByStatus: statusGroups.map((g: any) => ({ status: g.status, count: g._count._all })),
      commissionMonthly: months,
      recentNotifications,
    })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
