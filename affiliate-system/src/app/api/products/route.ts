import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { textMatch } from "@/lib/text-search"

/**
 * Public product catalog. Phase 3: explicit select whitelist — cost prices,
 * supplier links and internal flags must never leave the server.
 */
const PUBLIC_PRODUCT_SELECT = {
  id: true,
  name: true,
  nameAr: true,
  slug: true,
  description: true,
  descriptionAr: true,
  price: true,
  comparePrice: true,
  minPrice: true,
  image: true,
  images: true,
  stock: true,
  status: true,
  isVisible: true,
  category: { select: { id: true, name: true, nameAr: true, slug: true, icon: true, image: true } },
  createdAt: true,
} as const

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const minPrice = searchParams.get("minPrice") || ""
    const maxPrice = searchParams.get("maxPrice") || ""
    const status = searchParams.get("status") || "ACTIVE"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1)
    const limit = Math.min(60, Math.max(1, parseInt(searchParams.get("limit") || "12") || 12))

    const where: Prisma.ProductWhereInput = { deletedAt: null }

    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: textMatch(search) },
        { nameAr: textMatch(search) },
        { sku: textMatch(search) },
      ]
    }
    if (category) where.categoryId = category
    if (minPrice || maxPrice) {
      const priceFilter: Prisma.FloatFilter = {}
      if (minPrice) priceFilter.gte = parseFloat(minPrice)
      if (maxPrice) priceFilter.lte = parseFloat(maxPrice)
      where.price = priceFilter
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: PUBLIC_PRODUCT_SELECT,
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
