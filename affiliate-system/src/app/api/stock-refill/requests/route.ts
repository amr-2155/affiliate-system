import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hasPendingRefillRequest, getLastRestock } from "@/lib/stock"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }
    const userId = session.user.id
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get("productId")

    // متابعة منتج واحد: بيانات المخزون + حالة آخر طلب تجديد + آخر تجديد ناجح
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true, nameAr: true, name: true, image: true,
          stock: true, lowStockThreshold: true, status: true, updatedAt: true,
        },
      })
      if (!product) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

      const [requests, lastRefill] = await Promise.all([
        prisma.stockRefillRequest.findMany({
          where: { productId, affiliateId: userId },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, requestedQty: true, currentStock: true, status: true, reason: true, createdAt: true, processedAt: true },
        }),
        getLastRestock(productId),
      ])

      return NextResponse.json({
        product,
        requests,
        lastRefill,
        lowStock: product.stock <= product.lowStockThreshold,
        pendingRequest: requests.some((r) => r.status === "PENDING"),
      })
    }

    // كل طلبات المسوق الحالية (تُستخدم لتحديد حالة أزرار "تم طلب التجديد" في صفحة المنتجات)
    const requests = await prisma.stockRefillRequest.findMany({
      where: { affiliateId: userId },
      include: { product: { select: { id: true, nameAr: true, image: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error("stock-refill GET error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }
    const userId = session.user.id
    const { productId, quantity } = await req.json()

    if (!productId) {
      return NextResponse.json({ error: "المنتج مطلوب" }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, nameAr: true, stock: true, status: true, isVisible: true, lowStockThreshold: true },
    })
    if (!product || product.status !== "ACTIVE") {
      return NextResponse.json({ error: "المنتج غير موجود أو غير متاح" }, { status: 404 })
    }

    // منع تكرار الطلبات: لا يمكن طلب تجديد لمنتج لديه طلب مفتوح بالفعل
    const pending = await hasPendingRefillRequest(productId, userId)
    if (pending) {
      return NextResponse.json({ error: "يوجد طلب تجديد مفتوح لهذا المنتج بالفعل", existing: true }, { status: 409 })
    }

    const requestedQty = Math.max(0, parseInt(quantity) || 0)

    const request = await prisma.stockRefillRequest.create({
      data: {
        productId,
        affiliateId: userId,
        requestedQty,
        currentStock: product.stock,
        status: "PENDING",
      },
    })

    return NextResponse.json(request, { status: 201 })
  } catch (error) {
    console.error("stock-refill POST error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
