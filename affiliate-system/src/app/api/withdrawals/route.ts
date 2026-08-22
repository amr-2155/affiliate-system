import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { formatCurrency } from "@/lib/utils"
import { getSetting, isSettingEnabled } from "@/lib/settings"
import { notifyMany, NOTIFICATION_TYPE } from "@/lib/notifications"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(withdrawals)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const body = await req.json()
    const { amount, method, accountName, accountNumber, bankName } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 })
    }

    const minSetting = await getSetting("users-affiliate-withdrawal-min", "100")
    const minAmount = Number(minSetting) || 0
    if (minAmount > 0 && amount < minAmount) {
      return NextResponse.json({ error: `الحد الأدنى للسحب ${formatCurrency(minAmount)}` }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || user.balance < amount) {
      return NextResponse.json({ error: "الرصيد غير كافٍ" }, { status: 400 })
    }

    const withdrawal = await prisma.$transaction(async (tx: any) => {
      const w = await tx.withdrawal.create({
        data: {
          amount,
          method,
          accountName,
          accountNumber,
          bankName,
          userId: session.user.id,
        }
      })

      await tx.user.update({
        where: { id: session.user.id },
        data: { balance: { decrement: amount } }
      })

      return w
    })

    // Notify all admins about the new withdrawal request (respecting notification settings)
    const withdrawalNotif = await isSettingEnabled("notif-withdrawal", true)
    const admins = withdrawalNotif ? await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }) : []
    if (admins.length > 0) {
      const methodLabels: Record<string, string> = {
        BANK_TRANSFER: "تحويل بنكي",
        VODAFONE_CASH: "فودافون كاش",
        INSTAPAY: "إنستاباي",
        OTHER: "أخرى",
      }
      notifyMany(admins.map((a) => a.id), {
        title: "طلب سحب جديد",
        message: `${user.name} — ${formatCurrency(amount)} — ${methodLabels[method] || method}`,
        type: NOTIFICATION_TYPE.WITHDRAWAL,
        link: `/admin/withdrawals?highlight=${withdrawal.id}`,
        relatedId: withdrawal.id,
      })
    }

    return NextResponse.json(withdrawal)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
