import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const minPrice = searchParams.get("minPrice") || ""
    const maxPrice = searchParams.get("maxPrice") || ""
    const status = searchParams.get("status") || "ACTIVE"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "12")

    const where: any = { deletedAt: null }

    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameAr: { contains: search } },
        { sku: { contains: search } },
      ]
    }
    if (category) where.categoryId = category
    if (minPrice) where.price = { ...where.price, gte: parseFloat(minPrice) }
    if (maxPrice) where.price = { ...where.price, lte: parseFloat(maxPrice) }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({ products, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
