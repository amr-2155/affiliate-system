import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("products.view")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20))

    const where: any = {}
    if (status) where.status = status

    const [requests, total] = await Promise.all([
      prisma.stockRefillRequest.findMany({
        where,
        include: {
          product: { select: { id: true, nameAr: true, name: true, image: true, stock: true, lowStockThreshold: true, updatedAt: true } },
          affiliate: { select: { id: true, name: true, email: true } },
          processedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockRefillRequest.count({ where }),
    ])

    return NextResponse.json({ requests, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("admin stock-refill GET error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
