import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("orders.batch")
    if (guard instanceof NextResponse) return guard

    const { ids, content } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0 || !content?.trim()) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 })
    }

    const result = await prisma.orderComment.createMany({
      data: ids.map((orderId: string) => ({
        content: content.trim(),
        orderId,
        userId: guard.actor.id,
      })),
    })

    return NextResponse.json({ created: result.count })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
