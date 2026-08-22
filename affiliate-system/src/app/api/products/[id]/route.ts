import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const product = await prisma.product.findUnique({
      where: { id, status: "ACTIVE", isVisible: true, deletedAt: null },
      include: { category: true, variants: { where: { isActive: true } }, galleryImages: { orderBy: { sortOrder: "asc" } } },
    })
    if (!product) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const items = await prisma.orderItem.findMany({ where: { productId: id }, select: { orderId: true } })
    const orderIds = [...new Set(items.map((i) => i.orderId))]
    const statuses =
      orderIds.length > 0
        ? await prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { status: true },
          })
        : []

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
