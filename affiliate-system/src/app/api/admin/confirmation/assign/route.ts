import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { textMatch } from "@/lib/text-search"

// قائمة الطلبات المعلقة غير الموزعة (لنافذة التوزيع اليدوي)
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("confirmation.assign")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || "PENDING"

    const where: Prisma.OrderWhereInput = { reviewerId: null }
    if (status) where.status = status
    if (search) {
      where.OR = [
        { orderNumber: textMatch(search) },
        { customerName: textMatch(search) },
        { customerPhone: textMatch(search) },
      ]
    }

    const orders = await prisma.order.findMany({
      where,
      select: {
        id: true, orderNumber: true, status: true, total: true,
        customerName: true, customerPhone: true, createdAt: true,
        affiliate: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    })

    return NextResponse.json({ orders })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

// توزيع يدوي: إسناد طلبات محددة لموظف معين
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("confirmation.assign")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { orderIds, verifierId } = await req.json()
    if (!Array.isArray(orderIds) || orderIds.length === 0 || !verifierId) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 })
    }

    const verifier = await prisma.user.findUnique({ where: { id: verifierId } })
    if (!verifier || verifier.role !== "VERIFIER" || verifier.status !== "ACTIVE") {
      return NextResponse.json({ error: "موظف التأكيد غير موجود أو غير نشط" }, { status: 400 })
    }

    const now = new Date()
    const result = await prisma.order.updateMany({
      where: { id: { in: orderIds }, reviewerId: null },
      data: { reviewerId: verifier.id, assignedAt: now },
    })

    if (result.count > 0) {
      await logActivity(
        verifier.id,
        "ORDERS_ASSIGNED",
        "confirmation",
        `تم إسناد ${result.count} طلب إلى ${verifier.name} بواسطة ${actor.name}`
      )
    }

    return NextResponse.json({ success: true, assigned: result.count })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

// توزيع تلقائي: توزيع الطلبات المعلقة بالتساوي على الموظفين النشطين
export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("confirmation.assign")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const verifiers = await prisma.user.findMany({
      where: { role: "VERIFIER", status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    })
    if (verifiers.length === 0) {
      return NextResponse.json({ error: "لا يوجد موظفون نشطون للتوزيع" }, { status: 400 })
    }

    const pending = await prisma.order.findMany({
      where: { reviewerId: null, status: "PENDING" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })

    if (pending.length === 0) {
      return NextResponse.json({ success: true, assigned: 0, verifiers: verifiers.length })
    }

    const now = new Date()
    let assigned = 0
    // توزيع بالتناوب لتحقيق التوازن
    for (let i = 0; i < pending.length; i++) {
      const verifier = verifiers[i % verifiers.length]
      await prisma.order.update({
        where: { id: pending[i].id },
        data: { reviewerId: verifier.id, assignedAt: now },
      })
      assigned++
    }

    for (const v of verifiers) {
      await logActivity(v.id, "AUTO_DISTRIBUTED", "confirmation", `تم توزيع الطلبات تلقائياً بواسطة ${actor.name}`)
    }

    return NextResponse.json({ success: true, assigned, verifiers: verifiers.length })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
