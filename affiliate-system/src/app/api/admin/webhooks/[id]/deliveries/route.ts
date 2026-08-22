import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("integrations.logs")
    if (guard instanceof NextResponse) return guard
    const { id } = await params

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))
    const status = searchParams.get("status") || ""

    const where: any = { webhookId: id }
    if (status) where.status = status

    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.webhookDelivery.count({ where }),
    ])

    return NextResponse.json({ deliveries, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("webhook deliveries GET error", error)
    return NextResponse.json({ error: "حدث خطأ في تحميل السجلات" }, { status: 500 })
  }
}
