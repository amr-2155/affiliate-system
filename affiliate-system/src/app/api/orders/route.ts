import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { formatCurrency } from "@/lib/utils"
import { nextOrderNumber } from "@/lib/order-number"
import { notifyMany, NOTIFICATION_TYPE } from "@/lib/notifications"
import { isSettingEnabled } from "@/lib/settings"
import { emitEvent } from "@/lib/events"
import { getConfirmationDeadlineDays } from "@/lib/jobs/auto-cancel"
import { computeCommission } from "@/lib/commission"
import { isAffiliateEditable } from "@/lib/order-state"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const status = searchParams.get("status") || ""
    const search = searchParams.get("search") || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10")))

    if (id) {
      const order = await prisma.order.findFirst({
        where: { id, affiliateId: session.user.id },
        include: { items: { include: { product: true } } },
      })
      if (!order) {
        return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
      }
      const commission = computeCommission(order.items.map((i) => ({ product: i.product, unitPrice: i.unitPrice, quantity: i.quantity })))
      return NextResponse.json({ order, commission, isEditable: isAffiliateEditable(order.status) })
    }

    const where: any = { affiliateId: session.user.id }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
        { customerCity: { contains: search } },
      ]
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: { include: { product: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
    ])

    const ordersWithCommission = orders.map((o) => ({
      ...o,
      commission: computeCommission(o.items.map((i) => ({ product: i.product, unitPrice: i.unitPrice, quantity: i.quantity }))),
      editable: isAffiliateEditable(o.status),
    }))

    return NextResponse.json({ orders: ordersWithCommission, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const rl = checkRateLimit(`orderCreate:${session.user.id}`, RATE_LIMITS.orderCreate)
    if (!rl.allowed) {
      return NextResponse.json({ error: "تم تجاوز الحد المسموح من الطلبات. حاول لاحقًا." }, { status: 429 })
    }

    const body = await req.json()
    const { customerName, customerPhone, customerEmail, customerAddress, customerCity, customerGovernorate, items, notes } = body

    if (!customerName || !customerPhone || !customerAddress || !customerCity || !items?.length) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length > 50) {
      return NextResponse.json({ error: "المنتجات غير صالحة" }, { status: 400 })
    }

    for (const item of items) {
      if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) {
        return NextResponse.json({ error: `كمية غير صالحة للمنتج ${item.productId || "?"}` }, { status: 400 })
      }
    }

    let subtotal = 0
    const orderItems: { productId: string; quantity: number; unitPrice: number; total: number }[] = []
    const commissionInputs: { product: any; unitPrice: number; quantity: number }[] = []

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) {
        return NextResponse.json({ error: `المنتج غير موجود: ${item.productId}` }, { status: 400 })
      }
      const unitPrice = (item.unitPrice && item.unitPrice > 0) ? Number(item.unitPrice) : product.price
      const itemTotal = unitPrice * item.quantity
      subtotal += itemTotal
      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        total: itemTotal,
      })
      commissionInputs.push({ product, unitPrice, quantity: item.quantity })
    }

    // Calculate shipping
    const shippingRate = await prisma.shippingRate.findFirst({
      where: { governorate: customerGovernorate || customerCity, isActive: true }
    })
    const shippingCost = shippingRate ? shippingRate.rate : 50

    const total = subtotal + shippingCost

    const confirmationDeadlineDays = await getConfirmationDeadlineDays()
    const confirmationDeadline = new Date(Date.now() + confirmationDeadlineDays * 24 * 60 * 60 * 1000)

    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await nextOrderNumber(tx)
      const created = await tx.order.create({
        data: {
          orderNumber,
          subtotal,
          shippingCost,
          total,
          customerName,
          customerPhone,
          customerEmail,
          customerAddress,
          customerCity,
          customerGovernorate,
          notes,
          affiliateId: session.user.id,
          confirmationDeadline,
          items: { create: orderItems },
        },
        include: { items: true },
      })

      // Create commission log inside the transaction for consistency
      const totalCommission = computeCommission(commissionInputs)
      if (totalCommission > 0) {
        await tx.commissionLog.create({
          data: {
            amount: totalCommission,
            orderId: created.id,
            userId: session.user.id,
          }
        })
      }

      return created
    })

    // Notify all admins about the new order (respecting notification settings)
    const newOrderNotif = await isSettingEnabled("notif-new-order", true)
    const admins = newOrderNotif ? await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }) : []
    if (admins.length > 0) {
      notifyMany(admins.map((a) => a.id), {
        title: "طلب جديد",
        message: `${order.orderNumber} — ${customerName} — ${customerCity || customerGovernorate} — ${formatCurrency(total)}`,
        type: NOTIFICATION_TYPE.ORDER,
        link: `/admin/orders/${order.id}`,
        relatedId: order.id,
      })
    }

    // Emit order.created webhook event
    await emitEvent("order.created", {
      orderNumber: order.orderNumber,
      status: order.status,
      customerName,
      customerCity,
      total,
      currency: "EGP",
      confirmationDeadline: confirmationDeadline.toISOString(),
    }, order.id)

    return NextResponse.json({ order })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
