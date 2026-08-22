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

    const suggestions = await prisma.productSuggestion.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(suggestions)
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
    const { productName, productUrl, description, reason } = body

    if (!productName) {
      return NextResponse.json({ error: "اسم المنتج مطلوب" }, { status: 400 })
    }

    const suggestion = await prisma.productSuggestion.create({
      data: {
        productName,
        productUrl,
        description,
        reason,
        userId: session.user.id,
      }
    })

    return NextResponse.json(suggestion)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
