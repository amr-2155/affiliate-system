import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Public product detail. Phase 3: explicit select whitelist — cost prices,
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
  variants: {
    where: { isActive: true },
    select: { id: true, name: true, type: true, value: true, price: true, stock: true, sku: true, image: true },
  },
  galleryImages: { select: { url: true, alt: true }, orderBy: { sortOrder: "asc" as const } },
  createdAt: true,
} as const

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const product = await prisma.product.findFirst({
      where: { OR: [{ id }, { slug: id }], status: "ACTIVE", isVisible: true, deletedAt: null },
      select: PUBLIC_PRODUCT_SELECT,
    })
    if (!product) return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 })

    // Single bounded projection instead of scanning every OrderItem row.
    const statuses = await prisma.order.findMany({
      where: { items: { some: { productId: product.id } } },
      select: { status: true },
    })

    const totalOrders = statuses.length
    const deliveredOrders = statuses.filter((o) => o.status === "DELIVERED").length
    const collectedOrders = statuses.filter((o) => o.status === "COLLECTED").length
    const cancelledOrders = statuses.filter((o) => o.status === "CANCELLED" || o.status === "RETURNED").length
    const deliveryRate = totalOrders > 0 ? ((deliveredOrders + collectedOrders) / totalOrders) * 100 : null

    return NextResponse.json({
      ...product,
      deliveryStats: { totalOrders, deliveredOrders, collectedOrders, cancelledOrders, deliveryRate },
    })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
