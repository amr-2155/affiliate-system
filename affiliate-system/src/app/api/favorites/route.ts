import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId: session.user.id },
      include: { product: { include: { category: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(favorites)
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

    const { productId } = await req.json()

    const existing = await prisma.favorite.findUnique({
      where: { userId_productId: { userId: session.user.id, productId } }
    })

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } })
      return NextResponse.json({ favorited: false })
    } else {
      await prisma.favorite.create({
        data: { userId: session.user.id, productId }
      })
      return NextResponse.json({ favorited: true })
    }
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
