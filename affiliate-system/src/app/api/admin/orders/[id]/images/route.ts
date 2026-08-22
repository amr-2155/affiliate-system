import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("orders.images")
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    const { url, alt } = await req.json()
    if (!url) return NextResponse.json({ error: "الصورة مطلوبة" }, { status: 400 })

    const image = await prisma.orderImage.create({
      data: { url, alt: alt || null, orderId: id },
    })

    return NextResponse.json(image)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("orders.images")
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    const { searchParams } = new URL(req.url)
    const imageId = searchParams.get("imageId")
    if (!imageId) return NextResponse.json({ error: "imageId مطلوب" }, { status: 400 })

    await prisma.orderImage.delete({ where: { id: imageId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
