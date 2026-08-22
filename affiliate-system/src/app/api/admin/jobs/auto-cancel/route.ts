import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin-guard"
import { prisma } from "@/lib/prisma"
import { autoCancelOrders, isAutoCancelEnabled, getConfirmationDeadlineDays } from "@/lib/jobs/auto-cancel"

/** تشغيل يدوي لوظيفة الإلغاء التلقائي مع دعم وضع المحاكاة */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("orders.update")
    if (guard instanceof NextResponse) return guard

    const body = await req.json().catch(() => ({}))
    const dryRun = body?.dryRun === true

    const result = await autoCancelOrders(new Date(), dryRun)

    return NextResponse.json({
      ...result,
      enabled: await isAutoCancelEnabled(),
      deadlineDays: await getConfirmationDeadlineDays(),
      dryRun,
    })
  } catch (error) {
    console.error("auto-cancel run error", error)
    return NextResponse.json({ error: "حدث خطأ في تشغيل الإلغاء التلقائي" }, { status: 500 })
  }
}

/** حالة وظيفة الإلغاء التلقائي */
export async function GET() {
  try {
    const guard = await requireAdminPermission("orders.view")
    if (guard instanceof NextResponse) return guard

    const [enabled, days, overdueCount] = await Promise.all([
      isAutoCancelEnabled(),
      getConfirmationDeadlineDays(),
      prisma.order.count({
        where: {
          status: { in: ["PENDING", "PROCESSING"] },
          confirmationDeadline: { lte: new Date() },
        },
      }),
    ])

    return NextResponse.json({ enabled, deadlineDays: days, overdueCount })
  } catch (error) {
    console.error("auto-cancel status error", error)
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 })
  }
}
