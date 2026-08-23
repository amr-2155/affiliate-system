import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, requireAdminActor, logActivity } from "@/lib/admin-guard"
import { canTransitionWithdrawal, isValidWithdrawalStatus } from "@/lib/withdrawal-state"
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
    const actor = await requireAdminActor()
    if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 403 })

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

    // C-02: strict state machine — PENDING→APPROVED→COMPLETED, PENDING→REJECTED.
    // Same-state updates and backward/terminal moves are rejected outright, so a
    // REJECTED withdrawal can never be refunded twice and COMPLETED can never
    // be reopened.
    if (!isValidWithdrawalStatus(status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 })
    }
    if (!canTransitionWithdrawal(withdrawal.status, status)) {
      return NextResponse.json(
        { error: `لا يمكن تغيير حالة السحب من ${withdrawal.status} إلى ${status}` },
        { status: 400 },
      )
    }

    // Conditional update (status must still match what we read) + refund in ONE
    // transaction. Under concurrency exactly one request wins; the loser gets
    // count=0 and is rejected instead of double-refunding.
    let updated
    try {
      updated = await prisma.$transaction(async (tx) => {
        const result = await tx.withdrawal.updateMany({
          where: { id, status: withdrawal.status },
          data: {
            status,
            notes: notes ?? undefined,
            proofImage: proofImage ?? undefined,
            processedAt: new Date(),
          },
        })
        if (result.count === 0) {
          throw new Error("WITHDRAWAL_STATE_CHANGED")
        }
        if (status === "REJECTED") {
          // Refund happens exactly once, atomically with the status flip.
          await tx.user.update({
            where: { id: withdrawal.userId },
            data: { balance: { increment: withdrawal.amount } },
          })
        }
        return tx.withdrawal.findUnique({ where: { id } })
      })
    } catch (e) {
      if (e instanceof Error && e.message === "WITHDRAWAL_STATE_CHANGED") {
        return NextResponse.json(
          { error: "تغيّرت حالة طلب السحب للتو، أعد المحاولة" },
          { status: 409 },
        )
      }
      throw e
    }

    await logActivity(
      withdrawal.userId,
      status === "APPROVED" ? "WITHDRAWAL_APPROVED" : status === "REJECTED" ? "WITHDRAWAL_REJECTED" : "WITHDRAWAL_COMPLETED",
      "withdrawals",
      `${guard.actor.name} غيّر حالة طلب السحب ${withdrawal.amount} ج.م إلى ${status}`
    )

    notify({
      title: status === "APPROVED" ? "تم الموافقة على سحبك" : status === "REJECTED" ? "تم رفض طلب السحب" : status === "COMPLETED" ? "تم تحويل مبلغ السحب" : "طلب السحب قيد المراجعة",
      message: `طلب سحب بقيمة ${withdrawal.amount} ج.م - ${status === "APPROVED" ? "تمت الموافقة" : status === "REJECTED" ? "تم الرفض" : status === "COMPLETED" ? "تم التحويل بنجاح — راجع صورة الإثبات من صفحة السحوبات" : "قيد المراجعة"}`,
      type: NOTIFICATION_TYPE.WITHDRAWAL,
      userId: withdrawal.userId,
      link: `/withdrawals?highlight=${withdrawal.id}`,
      relatedId: withdrawal.id,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("withdrawals PUT error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
