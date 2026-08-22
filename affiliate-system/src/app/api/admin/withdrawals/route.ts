import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"

export async function GET() {
  try {
    const guard = await requireAdminPermission("withdrawals.view")
    if (guard instanceof NextResponse) return guard

    const withdrawals = await prisma.withdrawal.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(withdrawals)
  } catch (error) {
    console.error("withdrawals GET error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, status, notes, proofImage } = await req.json()

    // فصل صلاحيات حالة السحب: الموافقة / الرفض / تأكيد التحويل صلاحيات مستقلة
    const PERM_BY_STATUS: Record<string, string> = {
      APPROVED: "withdrawals.approve",
      REJECTED: "withdrawals.reject",
      COMPLETED: "withdrawals.complete",
    }
    const required = PERM_BY_STATUS[status]
    if (!required) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 })
    }
    const guard = await requireAdminPermission(required)
    if (guard instanceof NextResponse) return guard

    const withdrawal = await prisma.withdrawal.findUnique({ where: { id } })
    if (!withdrawal) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const updateData: any = { status, notes, processedAt: new Date() }
    if (proofImage) updateData.proofImage = proofImage
    const w = await prisma.withdrawal.update({ where: { id }, data: updateData })

    await logActivity(
      withdrawal.userId,
      status === "APPROVED" ? "WITHDRAWAL_APPROVED" : status === "REJECTED" ? "WITHDRAWAL_REJECTED" : "WITHDRAWAL_COMPLETED",
      "withdrawals",
      `${guard.actor.name} غيّر حالة طلب السحب ${withdrawal.amount} ج.م إلى ${status}`
    )

    if (status === "REJECTED") {
      await prisma.user.update({
        where: { id: withdrawal.userId },
        data: { balance: { increment: withdrawal.amount } },
      })
    }

    notify({
      title: status === "APPROVED" ? "تم الموافقة على سحبك" : status === "REJECTED" ? "تم رفض طلب السحب" : status === "COMPLETED" ? "تم تحويل مبلغ السحب" : "طلب السحب قيد المراجعة",
      message: `طلب سحب بقيمة ${withdrawal.amount} ج.م - ${status === "APPROVED" ? "تمت الموافقة" : status === "REJECTED" ? "تم الرفض" : status === "COMPLETED" ? "تم التحويل بنجاح — راجع صورة الإثبات من صفحة السحوبات" : "قيد المراجعة"}`,
      type: NOTIFICATION_TYPE.WITHDRAWAL,
      userId: withdrawal.userId,
      link: `/withdrawals?highlight=${withdrawal.id}`,
      relatedId: withdrawal.id,
    })

    return NextResponse.json(w)
  } catch (error) {
    console.error("withdrawals PUT error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
