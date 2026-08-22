import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("managers.view")
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    const activities = await prisma.adminActivity.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return NextResponse.json(activities)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
