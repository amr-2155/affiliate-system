import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"
import { NOTIFICATION_TYPE } from "@/lib/notifications"

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("notifications.send")
    if (guard instanceof NextResponse) return guard

    const { title, message, type, targetIds, link } = await req.json()

    const safeType = (Object.values(NOTIFICATION_TYPE) as string[]).includes(type) ? type : "INFO"

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "العنوان والرسالة مطلوبان" }, { status: 400 })
    }

    let userIds: string[]

    if (Array.isArray(targetIds) && targetIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: targetIds }, role: "AFFILIATE" },
        select: { id: true },
      })
      userIds = users.map(u => u.id)
    } else {
      const users = await prisma.user.findMany({
        where: { role: "AFFILIATE", status: "ACTIVE" },
        select: { id: true },
      })
      userIds = users.map(u => u.id)
    }

    if (userIds.length === 0) {
      return NextResponse.json({ error: "لا يوجد مسوقين لإرسال الرسالة إليهم" }, { status: 400 })
    }

    await prisma.notification.createMany({
      data: userIds.map(userId => ({
        title: title.trim(),
        message: message.trim(),
        type: safeType,
        link: typeof link === "string" && link.trim() ? link.trim() : undefined,
        userId,
      })),
    })

    return NextResponse.json({ success: true, count: userIds.length })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
