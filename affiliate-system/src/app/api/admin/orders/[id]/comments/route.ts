import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("orders.comments")
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    const { content } = await req.json()
    if (!content?.trim()) return NextResponse.json({ error: "النص مطلوب" }, { status: 400 })

    const comment = await prisma.orderComment.create({
      data: { content, orderId: id, userId: guard.actor.id },
      include: { user: { select: { id: true, name: true, role: true } } },
    })

    return NextResponse.json(comment)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("orders.comments")
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const commentId = searchParams.get("commentId")
    if (!commentId) return NextResponse.json({ error: "commentId مطلوب" }, { status: 400 })

    await prisma.orderComment.delete({ where: { id: commentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
