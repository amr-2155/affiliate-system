import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("confirmation.update")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { id } = await params
    const { password } = await req.json()
    if (!password?.trim() || password.length < 6) {
      return NextResponse.json({ error: "كلمة المرور 6 أحرف على الأقل" }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.role !== "VERIFIER") {
      return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 })
    }

    const hash = await bcrypt.hash(password, 12)
    await prisma.user.update({ where: { id }, data: { password: hash } })
    await logActivity(target.id, "PASSWORD_CHANGED", "confirmation", `تم تغيير كلمة المرور بواسطة ${actor.name}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
