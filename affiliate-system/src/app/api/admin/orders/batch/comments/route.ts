import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
    }

    const { ids, content } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0 || !content?.trim()) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 })
    }

    const comments = await prisma.orderComment.createMany({
      data: ids.map((orderId: string) => ({
        content: content.trim(),
        orderId,
        userId: session.user.id,
      })),
    })

    return NextResponse.json({ created: comments.count })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
