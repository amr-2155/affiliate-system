import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { textMatch } from "@/lib/text-search"
import { formatCurrency } from "@/lib/utils"
import { nextOrderNumber } from "@/lib/order-number"
import { notifyMany, NOTIFICATION_TYPE } from "@/lib/notifications"
import { isSettingEnabled } from "@/lib/settings"
import { emitEvent } from "@/lib/events"
import { getConfirmationDeadlineDays } from "@/lib/jobs/auto-cancel"
import { computeCommission } from "@/lib/commission"
import type { CommissionProduct } from "@/lib/commission"
import { isAffiliateEditable } from "@/lib/order-state"
import { resolveUnitPrice, parseQuantity } from "@/lib/pricing"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

class OutOfStockError extends Error {
  constructor(public productId: string) {
    super("OUT_OF_STOCK")
  }
}

/** Phase 2: a product must be active, visible and not soft-deleted to be ordered. */
function assertSellable(product: { status: string; isVisible: boolean; deletedAt: Date | null; nameAr: string }): void | { error: string } {
  if (product.status !== "ACTIVE" || !product.isVisible || product.deletedAt) {
    return { error: `المنتج غير متاح للبيع: ${product.nameAr}` }
  }
}

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

    const where: Prisma.OrderWhereInput = { affiliateId: session.user.id }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { orderNumber: textMatch(search) },
        { customerName: textMatch(search) },
        { customerPhone: textMatch(search) },
        { customerCity: textMatch(search) },
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
    const commissionInputs: { product: CommissionProduct; unitPrice: number; quantity: number }[] = []

    for (const item of items) {
      const quantity = parseQuantity(item.quantity)
      if (quantity === null) {
        return NextResponse.json({ error: "الكمية غير صالحة" }, { status: 400 })
      }
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) {
        return NextResponse.json({ error: `المنتج غير موجود: ${item.productId}` }, { status: 400 })
      }
      const notSellable = assertSellable(product)
      if (notSellable) {
        return NextResponse.json({ error: notSellable.error }, { status: 400 })
      }
      const price = resolveUnitPrice(product, item.unitPrice)
      if (!price.ok) {
        return NextResponse.json({ error: price.error }, { status: 400 })
      }
      const unitPrice = price.unitPrice
      const itemTotal = unitPrice * quantity
      subtotal += itemTotal
      orderItems.push({
        productId: product.id,
        quantity,
        unitPrice,
        total: itemTotal,
      })
      commissionInputs.push({ product, unitPrice, quantity })
    }

    // Calculate shipping
    const shippingRate = await prisma.shippingRate.findFirst({
      where: { governorate: customerGovernorate || customerCity, isActive: true },
    })
    const shippingCost = shippingRate ? shippingRate.rate : 50

    const total = subtotal + shippingCost

    const confirmationDeadlineDays = await getConfirmationDeadlineDays()
    const confirmationDeadline = new Date(Date.now() + confirmationDeadlineDays * 24 * 60 * 60 * 1000)

    let order
    try {
      order = await prisma.$transaction(async (tx) => {
        const orderNumber = await nextOrderNumber(tx)

        // Phase 2: atomic stock reservation — fails the whole order (and rolls
        // back the counter) if any item exceeds available stock.
        for (const oi of orderItems) {
          const res = await tx.product.updateMany({
            where: { id: oi.productId, stock: { gte: oi.quantity } },
            data: { stock: { decrement: oi.quantity } },
          })
          if (res.count === 0) throw new OutOfStockError(oi.productId)
        }

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

        // Commission log is created in the SAME transaction as the order, so
        // one cannot exist without the other.
        const totalCommission = computeCommission(commissionInputs)
        if (totalCommission > 0) {
          await tx.commissionLog.create({
            data: {
              amount: totalCommission,
              orderId: created.id,
              userId: session.user.id,
            },
          })
        }

        return created
      })
    } catch (e) {
      if (e instanceof OutOfStockError) {
        return NextResponse.json(
          { error: "الكمية المطلوبة تتجاوز المخزون المتاح لأحد المنتجات" },
          { status: 400 },
        )
      }
      throw e
    }

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
