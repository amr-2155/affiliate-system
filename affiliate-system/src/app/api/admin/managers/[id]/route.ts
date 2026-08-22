import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { parsePermissions } from "@/lib/permissions"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("managers.update")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { id } = await params
    const body = await req.json()
    const { name, phone, status, permissions } = body

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.role !== "ADMIN") {
      return NextResponse.json({ error: "المدير غير موجود" }, { status: 404 })
    }
    if (target.isSuperAdmin && actor.id !== target.id && !actor.isSuperAdmin) {
      return NextResponse.json({ error: "لا يمكن تعديل مدير عام" }, { status: 403 })
    }

    const data: any = {}
    if (name?.trim()) data.name = name.trim()
    if (phone !== undefined) data.phone = phone?.trim() || null
    if (status) {
      if (target.isSuperAdmin && status !== "ACTIVE" && actor.id !== target.id) {
        return NextResponse.json({ error: "لا يمكن تعطيل مدير عام" }, { status: 403 })
      }
      data.status = status
    }

    // تغيير الصلاحيات يتطلب صلاحية إدارة الصلاحيات
    if (permissions !== undefined) {
      const permGuard = await requireAdminPermission("managers.permissions")
      if (permGuard instanceof NextResponse) return permGuard
      if (target.isSuperAdmin && actor.id !== target.id) {
        return NextResponse.json({ error: "لا يمكن تعديل صلاحيات مدير عام" }, { status: 403 })
      }
      data.permissions = JSON.stringify(parsePermissions(permissions))
    }

    await prisma.user.update({ where: { id }, data })
    await logActivity(target.id, "ACCOUNT_UPDATED", "managers", `تم تعديل بيانات المدير بواسطة ${actor.name}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("managers.delete")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { id } = await params
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.role !== "ADMIN") {
      return NextResponse.json({ error: "المدير غير موجود" }, { status: 404 })
    }
    if (target.isSuperAdmin) {
      return NextResponse.json({ error: "لا يمكن حذف مدير عام" }, { status: 403 })
    }
    if (actor.id === target.id) {
      return NextResponse.json({ error: "لا يمكن حذف حسابك الحالي" }, { status: 403 })
    }

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
