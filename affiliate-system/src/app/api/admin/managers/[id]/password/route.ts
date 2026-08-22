import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("managers.update")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { id } = await params
    const { password } = await req.json()
    if (!password?.trim() || password.length < 6) {
      return NextResponse.json({ error: "كلمة المرور 6 أحرف على الأقل" }, { status: 400 })
    }

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.role !== "ADMIN") {
      return NextResponse.json({ error: "المدير غير موجود" }, { status: 404 })
    }
    if (target.isSuperAdmin && actor.id !== target.id && !actor.isSuperAdmin) {
      return NextResponse.json({ error: "لا يمكن تغيير كلمة مرور مدير عام" }, { status: 403 })
    }

    const hash = await bcrypt.hash(password, 12)
    await prisma.user.update({ where: { id }, data: { password: hash } })
    await logActivity(target.id, "PASSWORD_CHANGED", "managers", `تم تغيير كلمة المرور بواسطة ${actor.name}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
