import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const { id } = await params
    const strategy = await prisma.marketingStrategy.findFirst({
      where: { id, userId: session.user.id },
      include: {
        product: { select: { id: true, nameAr: true, name: true, price: true, image: true, category: { select: { nameAr: true } } } },
      },
    })
    if (!strategy) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    return NextResponse.json(strategy)
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
    const existing = await prisma.marketingStrategy.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const body = await req.json()
    const { title, content, scenario, productSnapshot } = body

    if (content !== undefined && typeof content !== "string") {
      return NextResponse.json({ error: "محتوى الخطة غير صالح" }, { status: 400 })
    }

    const strategy = await prisma.marketingStrategy.update({
      where: { id },
      data: {
        ...(typeof title === "string" && title.trim() ? { title: title.slice(0, 120) } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(typeof scenario === "string" ? { scenario } : {}),
        ...(typeof productSnapshot === "string" ? { productSnapshot } : {}),
      },
    })

    return NextResponse.json(strategy)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.marketingStrategy.findFirst({ where: { id, userId: session.user.id } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    await prisma.marketingStrategy.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
