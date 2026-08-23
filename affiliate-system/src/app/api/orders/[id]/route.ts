import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { computeItemCommission, computeCommission } from "@/lib/commission"
import { isAffiliateEditable, AFFILIATE_EDITABLE_STATUSES } from "@/lib/order-state"
import { resolveUnitPrice, parseQuantity } from "@/lib/pricing"
import { logActivity } from "@/lib/admin-guard"

class OutOfStockError extends Error {
  constructor(public productId: string) {
    super("OUT_OF_STOCK")
  }
}

const ITEM_PRODUCT_SELECT = {
  id: true,
  nameAr: true,
  name: true,
  image: true,
  price: true,
  minPrice: true,
  affiliateCostPrice: true,
} as const

async function loadOrder(id: string, affiliateId: string) {
  return prisma.order.findFirst({
    where: { id, affiliateId },
    include: {
      items: { include: { product: { select: ITEM_PRODUCT_SELECT } } },
      comments: { orderBy: { createdAt: "desc" } },
    },
  })
}

async function loadHistory(orderId: string) {
  return prisma.adminActivity.findMany({
    where: { orderId },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}

async function buildDetail(order: Awaited<ReturnType<typeof loadOrder>>, isAdmin: boolean) {
  const items = (order?.items || []).map((item) => ({
    ...item,
    commission: computeItemCommission(item.product as any, item.unitPrice, item.quantity),
  }))
  const commission = items.reduce((sum, it) => sum + it.commission, 0)
  const confirmedBy = order?.confirmedById
    ? await prisma.user.findUnique({ where: { id: order.confirmedById }, select: { id: true, name: true } })
    : null
  return {
    order,
    items,
    commission,
    isEditable: isAdmin || isAffiliateEditable(order?.status || ""),
    editableStatuses: AFFILIATE_EDITABLE_STATUSES,
    confirmedBy,
    history: await loadHistory(order?.id || ""),
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }
    const { id } = await params
    const order = await loadOrder(id, session.user.id)
    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
    }
    const isAdmin = (session.user as any)?.role === "ADMIN"
    return NextResponse.json(await buildDetail(order, isAdmin))
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }
    const { id } = await params
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, name: true } })
    if (!user) return NextResponse.json({ error: "غير مصرح" }, { status: 403 })

    const existing = await loadOrder(id, user.id)
    if (!existing) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
    }

    // فرض نافذة التعديل: المسوق يعدّل فقط في PENDING أو UNDER_REVIEW — حتى لو استُدعي الـ API مباشرة.
    // المديرون غير مقيدين.
    const isAdmin = user.role === "ADMIN"
    if (!isAdmin && !isAffiliateEditable(existing.status)) {
      return NextResponse.json({
        error: "لا يمكن تعديل هذا الطلب بعد هذه المرحلة. يُسمح بالتعديل فقط في حالة (قيد الانتظار) أو (قيد المراجعة).",
      }, { status: 403 })
    }

    const body = await req.json()
    const {
      customerName, customerPhone, customerEmail, customerAddress,
      customerCity, customerGovernorate, notes, items,
    } = body

    if (!customerName || !customerPhone || !customerAddress || !customerCity || !items?.length) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 })
    }

    let subtotal = 0
    const newItems: { productId: string; quantity: number; unitPrice: number; total: number; note: string | null }[] = []
    const commissionInputs: { product: any; unitPrice: number; quantity: number }[] = []

    for (const item of items) {
      const qty = parseQuantity(item.quantity)
      if (qty === null) {
        return NextResponse.json({ error: "الكمية غير صالحة" }, { status: 400 })
      }
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
      if (!product) {
        return NextResponse.json({ error: `المنتج غير موجود: ${item.productId}` }, { status: 400 })
      }
      // Phase 2: only active, visible, non-deleted products can be ordered.
      if (product.status !== "ACTIVE" || !product.isVisible || product.deletedAt) {
        return NextResponse.json({ error: `المنتج غير متاح للبيع: ${product.nameAr}` }, { status: 400 })
      }
      const price = resolveUnitPrice(product, item.unitPrice)
      if (!price.ok) {
        return NextResponse.json({ error: price.error }, { status: 400 })
      }
      const unitPrice = price.unitPrice
      const itemTotal = unitPrice * qty
      subtotal += itemTotal
      newItems.push({ productId: product.id, quantity: qty, unitPrice, total: itemTotal, note: item.note || null })
      commissionInputs.push({ product, unitPrice, quantity: qty })
    }

    const shippingRate = await prisma.shippingRate.findFirst({
      where: { governorate: customerGovernorate || customerCity, isActive: true },
    })
    const shippingCost = shippingRate ? shippingRate.rate : 50
    const total = subtotal + shippingCost
    const commission = computeCommission(commissionInputs)

    // ملخص التغييرات لسجل الطلب
    const changes: any[] = []
    const labelMap: Record<string, string> = {
      customerName: "اسم العميل", customerPhone: "هاتف العميل", customerEmail: "البريد",
      customerAddress: "العنوان", customerCity: "المدينة", customerGovernorate: "المحافظة",
      notes: "ملاحظات", subtotal: "المجموع الفرعي", shippingCost: "الشحن", total: "الإجمالي",
    }
    for (const key of Object.keys(labelMap)) {
      const oldVal = (existing as any)[key]
      const newVal = (body as any)[key]
      if (String(oldVal ?? "") !== String(newVal ?? "")) {
        changes.push({ field: key, label: labelMap[key], oldValue: oldVal ?? "", newValue: newVal ?? "" })
      }
    }

    // مقارنة المنتجات: محذوف / مضاف / متغير (سعر أو كمية)
    const oldByProduct = new Map(existing.items.map((i) => [i.productId, i]))
    for (const ni of newItems) {
      const oldItem = oldByProduct.get(ni.productId)
      if (!oldItem) {
        changes.push({ field: `item:${ni.productId}`, label: "منتج مضاف", oldValue: "", newValue: `الكمية ${ni.quantity}` })
      } else if (oldItem.quantity !== ni.quantity || oldItem.unitPrice !== ni.unitPrice) {
        changes.push({
          field: `item:${ni.productId}`,
          label: "تعديل منتج",
          oldValue: `${oldItem.quantity} × ${oldItem.unitPrice}`,
          newValue: `${ni.quantity} × ${ni.unitPrice}`,
        })
      }
    }
    for (const oi of existing.items) {
      if (!newItems.find((ni) => ni.productId === oi.productId)) {
        changes.push({ field: `item:${oi.productId}`, label: "منتج محذوف", oldValue: `${oi.quantity} × ${oi.unitPrice}`, newValue: "" })
      }
    }

    const hasRealChanges =
      changes.length > 0 || Math.abs(subtotal - existing.subtotal) > 0.001 ||
      Math.abs(shippingCost - existing.shippingCost) > 0.001

    if (!hasRealChanges) {
      const order = await loadOrder(id, user.id)
      const detail = await buildDetail(order, isAdmin)
      return NextResponse.json({ ...detail, changes: [], commission, message: "no_changes" })
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: {
            subtotal, shippingCost, total,
            customerName, customerPhone, customerEmail, customerAddress,
            customerCity, customerGovernorate, notes,
          },
        })
        // Phase 2: stock reconciliation — return all old quantities, then
        // atomically reserve the new ones (fails whole edit if out of stock).
        for (const oi of existing.items) {
          await tx.product.update({
            where: { id: oi.productId },
            data: { stock: { increment: oi.quantity } },
          })
        }
        for (const ni of newItems) {
          const res = await tx.product.updateMany({
            where: { id: ni.productId, stock: { gte: ni.quantity } },
            data: { stock: { decrement: ni.quantity } },
          })
          if (res.count === 0) throw new OutOfStockError(ni.productId)
        }
        await tx.orderItem.deleteMany({ where: { orderId: id } })
        await tx.orderItem.createMany({ data: newItems.map((ni) => ({ ...ni, orderId: id })) })
        await tx.commissionLog.deleteMany({ where: { orderId: id } })
        if (commission > 0) {
          await tx.commissionLog.create({ data: { amount: commission, orderId: id, userId: user.id } })
        }
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

    await logActivity(
      user.id,
      "ORDER_EDITED",
      "orders",
      JSON.stringify({ orderId: id, changes }),
      id
    )

    const order = await loadOrder(id, user.id)
    const detail = await buildDetail(order, isAdmin)
    return NextResponse.json({ ...detail, changes, commission })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
