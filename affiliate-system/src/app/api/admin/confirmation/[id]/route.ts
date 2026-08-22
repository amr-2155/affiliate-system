import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("confirmation.view")
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    const member = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, avatar: true,
        role: true, status: true, lastLogin: true, createdAt: true,
      },
    })
    if (!member || member.role !== "VERIFIER") {
      return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 })
    }

    const [assignedOrders, confirmedOrders, activities] = await Promise.all([
      prisma.order.findMany({
        where: { reviewerId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, orderNumber: true, status: true, total: true,
          customerName: true, createdAt: true, assignedAt: true,
          confirmedAt: true, confirmedById: true,
          affiliate: { select: { name: true } },
        },
      }),
      prisma.order.findMany({
        where: { confirmedById: id },
        orderBy: { confirmedAt: "desc" },
        take: 20,
        select: {
          id: true, orderNumber: true, status: true, total: true,
          customerName: true, createdAt: true, confirmedAt: true,
          affiliate: { select: { name: true } },
        },
      }),
      prisma.adminActivity.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ])

    return NextResponse.json({ member, assignedOrders, confirmedOrders, activities })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("confirmation.update")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { id } = await params
    const { name, phone, status } = await req.json()

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.role !== "VERIFIER") {
      return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 })
    }

    const data: any = {}
    if (name?.trim()) data.name = name.trim()
    if (phone !== undefined) data.phone = phone?.trim() || null
    if (status) data.status = status

    await prisma.user.update({ where: { id }, data })
    await logActivity(target.id, "ACCOUNT_UPDATED", "confirmation", `تم تعديل بيانات موظف التأكيد بواسطة ${actor.name}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("confirmation.delete")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { id } = await params
    const target = await prisma.user.findUnique({ where: { id } })
    if (!target || target.role !== "VERIFIER") {
      return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 })
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
