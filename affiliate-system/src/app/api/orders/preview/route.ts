import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { computeItemCommission, computeCommission } from "@/lib/commission"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const body = await req.json()
    const { items, customerGovernorate, customerCity } = body
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "أضف منتجات أولاً" }, { status: 400 })
    }

    let subtotal = 0
    const itemDetails: any[] = []
    const inputs: { product: any; unitPrice: number; quantity: number }[] = []

    for (const item of items) {
      const qty = Math.floor(Number(item.quantity))
      if (!Number.isFinite(qty) || qty < 1) continue
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) continue
      const unitPrice = item.unitPrice && Number(item.unitPrice) > 0 ? Number(item.unitPrice) : product.price
      subtotal += unitPrice * qty
      itemDetails.push({
        productId: product.id,
        nameAr: product.nameAr,
        unitPrice,
        quantity: qty,
        commission: computeItemCommission(product, unitPrice, qty),
        hasCommission: product.minPrice ? true : product.affiliateCostPrice !== null,
      })
      inputs.push({ product, unitPrice, quantity: qty })
    }

    if (itemDetails.length === 0) {
      return NextResponse.json({ error: "أضف منتجات أولاً" }, { status: 400 })
    }

    const shippingRate = await prisma.shippingRate.findFirst({
      where: { governorate: customerGovernorate || customerCity, isActive: true },
    })
    const shippingCost = shippingRate ? shippingRate.rate : 50

    return NextResponse.json({
      subtotal,
      shippingCost,
      total: subtotal + shippingCost,
      commission: computeCommission(inputs),
      items: itemDetails,
    })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
