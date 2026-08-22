import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

const ACTION_LABELS: Record<string, string> = {
  SETTINGS_UPDATED: "تعديل إعدادات النظام",
  SHIPPING_RATES_UPDATED: "تحديث أسعار الشحن",
  PROFILE_UPDATED: "تحديث بيانات الحساب",
  PASSWORD_CHANGED: "تغيير كلمة المرور",
  WITHDRAWAL_APPROVED: "الموافقة على سحب",
  WITHDRAWAL_REJECTED: "رفض سحب",
  WITHDRAWAL_COMPLETED: "تأكيد تحويل سحب",
  ACCOUNT_CREATED: "إنشاء حساب",
  ACCOUNT_UPDATED: "تعديل حساب",
  ACCOUNT_DELETED: "حذف حساب",
  AUTO_DISTRIBUTED: "توزيع تلقائي",
  ORDER_ASSIGNED: "تعيين طلب",
}

export async function GET(req: Request) {
  try {
    const guard = await requireAdminPermission("settings.view")
    if (guard instanceof NextResponse) return guard

    const url = new URL(req.url)
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "40")))
    const module = url.searchParams.get("module") || ""

    const where = module ? { module } : {}

    const activities = await prisma.adminActivity.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    return NextResponse.json({
      activities: activities.map((a) => ({
        id: a.id,
        action: a.action,
        actionLabel: ACTION_LABELS[a.action] || a.action,
        module: a.module,
        details: a.details,
        user: a.user ? a.user.name : "—",
        email: a.user ? a.user.email : null,
        createdAt: a.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("settings activity error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
