import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { productMoney } from "@/lib/profit"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const strategies = await prisma.marketingStrategy.findMany({
      where: { userId: session.user.id },
      include: {
        product: { select: { id: true, nameAr: true, name: true, price: true, image: true, category: { select: { nameAr: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json(strategies)
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

    const body = await req.json()
    const { productId, title, content, scenario, productSnapshot } = body

    if (!productId || typeof content !== "string") {
      return NextResponse.json({ error: "بيانات غير مكتملة" }, { status: 400 })
    }

    let contentParsed: unknown
    try {
      contentParsed = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: "محتوى الخطة غير صالح" }, { status: 400 })
    }
    if (!Array.isArray(contentParsed)) {
      return NextResponse.json({ error: "محتوى الخطة غير صالح" }, { status: 400 })
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, status: "ACTIVE", isVisible: true, deletedAt: null },
      include: { category: { select: { nameAr: true } } },
    })
    if (!product) {
      return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 })
    }

    const money = productMoney(product)
    const snapshot = JSON.stringify({
      nameAr: product.nameAr,
      name: product.name,
      price: money.displayPrice,
      commission: money.unitCommission,
      image: product.image,
      categoryNameAr: product.category?.nameAr || "",
    })

    const strategy = await prisma.marketingStrategy.create({
      data: {
        userId: session.user.id,
        productId,
        title: typeof title === "string" && title.trim() ? title.slice(0, 120) : `خطة تسويق ${product.nameAr}`,
        scenario: typeof scenario === "string" ? scenario.slice(0, 30) : "realistic",
        content,
        productSnapshot: typeof productSnapshot === "string" ? productSnapshot : snapshot,
      },
    })

    return NextResponse.json(strategy, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
