import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("orders.view")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || ""
    const search = searchParams.get("search") || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { customerEmail: { contains: search } },
        { customerCity: { contains: search } },
      ]
    }

    const [orders, total, totalAgg] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: { include: { product: true } },
          affiliate: { select: { name: true, email: true } },
          comments: { take: 1, orderBy: { createdAt: "desc" }, select: { createdAt: true, content: true } },
        },
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
      prisma.order.aggregate({ where, _sum: { total: true } }),
    ])

    return NextResponse.json({ orders, total, totalRevenue: totalAgg._sum.total || 0, pages: Math.ceil(total / limit) })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
