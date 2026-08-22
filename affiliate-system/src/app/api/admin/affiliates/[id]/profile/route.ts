import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("affiliates.update")
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    const body = await req.json()
    const { name, phone, status } = body

    const data: any = {}
    if (name !== undefined) {
      if (!String(name).trim()) {
        return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 })
      }
      data.name = String(name).trim()
    }
    if (phone !== undefined) data.phone = phone ? String(phone).trim() : null
    if (status) data.status = status

    const user = await prisma.user.update({ where: { id }, data })
    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
