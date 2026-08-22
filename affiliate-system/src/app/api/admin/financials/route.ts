import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

const MODULE_LABELS: Record<string, string> = {
  withdrawals: "المعاملات المالية",
  managers: "المديرون",
  confirmation: "فريق التأكيد",
  incentives: "الحوافز والمكافآت",
  orders: "الطلبات",
}

const ACTION_LABELS: Record<string, string> = {
  WITHDRAWAL_APPROVED: "الموافقة على سحب",
  WITHDRAWAL_REJECTED: "رفض سحب",
  WITHDRAWAL_COMPLETED: "تأكيد تحويل سحب",
  ACCOUNT_CREATED: "إنشاء حساب",
  ACCOUNT_UPDATED: "تعديل حساب",
  PASSWORD_CHANGED: "تغيير كلمة مرور",
  AUTO_DISTRIBUTED: "توزيع تلقائي للطلبات",
  ORDER_ASSIGNED: "توزيع طلب",
  INCENTIVE_CAMPAIGN_CREATED: "إنشاء حملة تحفيزية",
  INCENTIVE_CAMPAIGN_UPDATED: "تعديل حملة تحفيزية",
  INCENTIVE_CAMPAIGN_DELETED: "حذف حملة تحفيزية",
  INCENTIVE_REWARD_REVIEWED: "مراجعة مكافأة",
  INCENTIVE_REWARD_PAID: "صرف مكافأة",
}

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("withdrawals.view")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || ""
    const status = searchParams.get("status") || ""
    const search = (searchParams.get("search") || "").trim().toLowerCase()
    const from = searchParams.get("from") ? new Date(searchParams.get("from")! + "T00:00:00") : null
    const to = searchParams.get("to") ? new Date(searchParams.get("to")! + "T23:59:59.999") : null
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "15")))

    const [commissionLogs, withdrawals, incentiveRewards, userAggs, orderAgg, commissionAgg, completedAgg, pendingAgg] = await Promise.all([
      prisma.commissionLog.findMany({
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.withdrawal.findMany({
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.incentiveReward.findMany({
        include: {
          affiliate: { select: { id: true, name: true, email: true, phone: true } },
          campaign: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.aggregate({ where: { role: "AFFILIATE" }, _sum: { balance: true, totalEarnings: true } }),
      prisma.order.aggregate({ _sum: { total: true }, _count: { _all: true } }),
      prisma.commissionLog.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
      prisma.withdrawal.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: "PENDING" }, _sum: { amount: true }, _count: { _all: true } }),
    ])

    const totalRevenue = orderAgg._sum.total || 0
    const totalOrders = orderAgg._count._all || 0
    const totalCommissions = commissionAgg._sum.amount || 0
    const totalWithdrawn = completedAgg._sum.amount || 0
    const pendingWithdrawals = { count: pendingAgg._count._all || 0, amount: pendingAgg._sum.amount || 0 }
    const outstandingBalance = userAggs._sum.balance || 0
    const totalEarnings = userAggs._sum.totalEarnings || 0
    const netRevenue = totalRevenue - totalCommissions
    const rewardsDue = incentiveRewards.filter((r) => r.status !== "PAID").reduce((s, r) => s + r.amount, 0)
    const rewardsPaid = incentiveRewards.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0)

    // order numbers for commission references
    const orderIds = Array.from(new Set(commissionLogs.map((c) => c.orderId)))
    const orders = orderIds.length
      ? await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNumber: true } })
      : []
    const orderNumberById = Object.fromEntries(orders.map((o) => [o.id, o.orderNumber]))

    const transactions: any[] = []
    commissionLogs.forEach((c) => {
      transactions.push({
        id: `c_${c.id}`,
        type: "COMMISSION",
        ref: orderNumberById[c.orderId] || "",
        amount: c.amount,
        status: "COMPLETED",
        method: "",
        user: c.user,
        date: c.createdAt.toISOString(),
        processedAt: null,
        details: "عمولة من طلب — أُضيفت تلقائياً لرصيد المسوق",
      })
    })
    withdrawals.forEach((w) => {
      transactions.push({
        id: `w_${w.id}`,
        type: "WITHDRAWAL",
        ref: `WDR-${w.id.slice(-6).toUpperCase()}`,
        amount: w.amount,
        status: w.status,
        method: w.method,
        user: w.user,
        date: w.createdAt.toISOString(),
        processedAt: w.processedAt ? w.processedAt.toISOString() : null,
        bankName: w.bankName,
        accountName: w.accountName,
        accountNumber: w.accountNumber,
        notes: w.notes,
        proofImage: w.proofImage,
        details: "طلب سحب من رصيد المسوق",
      })
    })
    incentiveRewards.forEach((r) => {
      transactions.push({
        id: `r_${r.id}`,
        type: "REWARD",
        ref: `RWD-${r.id.slice(-6).toUpperCase()}`,
        amount: r.amount,
        status: r.status,
        method: "",
        user: r.affiliate,
        date: r.createdAt.toISOString(),
        processedAt: r.paidAt ? r.paidAt.toISOString() : null,
        notes: r.notes,
        details: `مكافأة حملة "${r.campaign.name}" — تُضاف للرصيد عند الصرف`,
      })
    })

    const q = search.toLowerCase()
    const filtered = transactions.filter((t) => {
      if (type && t.type !== type) return false
      if (status && t.status !== status) return false
      const tDate = new Date(t.date).getTime()
      if (from && tDate < from.getTime()) return false
      if (to && tDate > to.getTime()) return false
      if (!q) return true
      const hay = [t.user?.name, t.user?.email, t.ref, t.id].filter(Boolean).join(" ").toLowerCase()
      return hay.includes(q)
    })

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const total = filtered.length
    const pages = Math.max(1, Math.ceil(total / limit))
    const sliced = filtered.slice((page - 1) * limit, page * limit)

    // Audit trail
    const activities = await prisma.adminActivity.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    })
    const audit = activities.map((a) => ({
      id: a.id,
      user: a.user.name,
      email: a.user.email,
      action: ACTION_LABELS[a.action] || a.action,
      module: MODULE_LABELS[a.module] || a.module,
      details: a.details,
      createdAt: a.createdAt.toISOString(),
    }))

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalOrders,
        totalCommissions,
        netRevenue,
        outstandingBalance,
        totalWithdrawn,
        totalEarnings,
        pendingWithdrawals,
        rewardsDue,
        rewardsPaid,
      },
      transactions: sliced,
      total,
      pages,
      audit,
    })
  } catch (error) {
    console.error("financials API error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
