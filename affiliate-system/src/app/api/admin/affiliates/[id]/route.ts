import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("affiliates.update")
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    const body = await req.json()
    const { status, commissionRate } = body

    const data: any = {}
    if (status) data.status = status
    if (commissionRate !== undefined) data.commissionRate = parseFloat(commissionRate)

    const affiliate = await prisma.user.update({ where: { id }, data })
    return NextResponse.json(affiliate)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
