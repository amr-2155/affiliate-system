import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { productMoney } from "@/lib/profit"
import { analyzeProduct } from "@/lib/analysis"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "غير مصرح" }, { status: 401 })

    const { id } = await params
    const product = await prisma.product.findUnique({
      where: { id, status: "ACTIVE", isVisible: true, deletedAt: null },
      select: {
        id: true,
        nameAr: true,
        name: true,
        price: true,
        minPrice: true,
        affiliateCostPrice: true,
        commissionRate: true,
        stock: true,
        image: true,
        descriptionAr: true,
        description: true,
        category: { select: { nameAr: true, name: true } },
      },
    })
    if (!product) return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 })

    const items = await prisma.orderItem.findMany({ where: { productId: id }, select: { orderId: true } })
    const orderIds = [...new Set(items.map((i) => i.orderId))]
    const statuses =
      orderIds.length > 0
        ? await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { status: true } })
        : []

    const totalOrders = statuses.length
    const deliveredOrders = statuses.filter((o) => o.status === "DELIVERED").length
    const collectedOrders = statuses.filter((o) => o.status === "COLLECTED").length
    const cancelledOrders = statuses.filter((o) => o.status === "CANCELLED" || o.status === "RETURNED").length
    const deliveryRate = totalOrders > 0 ? ((deliveredOrders + collectedOrders) / totalOrders) * 100 : null

    const affiliateOrders = await prisma.order.findMany({
      where: { affiliateId: session.user.id },
      select: { status: true },
    })
    const affDelivered = affiliateOrders.filter((o) => o.status === "DELIVERED" || o.status === "COLLECTED").length
    const affDeliveryRate = affiliateOrders.length > 0 ? (affDelivered / affiliateOrders.length) * 100 : null

    const money = productMoney(product)
    const analysis = analyzeProduct({
      product: {
        id: product.id,
        nameAr: product.nameAr,
        name: product.name,
        price: money.displayPrice,
        commission: money.unitCommission,
        stock: product.stock ?? 0,
        categoryNameAr: product.category?.nameAr || product.category?.name || "",
        descriptionAr: product.descriptionAr,
        description: product.description,
      },
      orderStats: { totalOrders, deliveryRate },
      affiliate: { totalOrders: affiliateOrders.length, deliveryRate: affDeliveryRate },
    })

    return NextResponse.json({
      product: {
        id: product.id,
        nameAr: product.nameAr,
        name: product.name,
        price: money.displayPrice,
        commission: money.unitCommission,
        stock: product.stock ?? 0,
        image: product.image,
        categoryNameAr: product.category?.nameAr || product.category?.name || "",
      },
      stats: { totalOrders, deliveredOrders, collectedOrders, cancelledOrders, deliveryRate },
      affiliate: { totalOrders: affiliateOrders.length, deliveryRate: affDeliveryRate },
      analysis,
    })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
