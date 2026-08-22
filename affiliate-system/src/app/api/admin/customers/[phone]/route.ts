import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  try {
    const guard = await requireAdminPermission("customers.view")
    if (guard instanceof NextResponse) return guard

    const { phone } = await params
    const orders = await prisma.order.findMany({
      where: { customerPhone: phone },
      include: {
        affiliate: { select: { id: true, name: true, email: true, referralCode: true } },
        items: { select: { id: true, quantity: true, unitPrice: true, total: true, product: { select: { id: true, name: true, nameAr: true, image: true } } } },
        comments: { take: 2, orderBy: { createdAt: "desc" }, select: { content: true, createdAt: true, user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error("customer 360 API error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
