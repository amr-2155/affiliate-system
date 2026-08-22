import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { ORDER_EVENTS } from "@/lib/events"

export async function GET() {
  try {
    const guard = await requireAdminPermission("webhooks.view")
    if (guard instanceof NextResponse) return guard

    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { deliveries: true } } },
    })
    return NextResponse.json({ webhooks, events: ORDER_EVENTS })
  } catch (error) {
    console.error("webhooks GET error", error)
    return NextResponse.json({ error: "حدث خطأ في تحميل الويب هوكس" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("webhooks.manage")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const body = await req.json()
    const { name, url, secret, enabled, events, timeoutMs, maxRetries } = body

    if (!name?.trim() || !url?.trim()) {
      return NextResponse.json({ error: "الاسم والرابط مطلوبان" }, { status: 400 })
    }
    let parsedEvents: string[] = []
    try {
      parsedEvents = Array.isArray(events) ? events.filter((e: string) => ORDER_EVENTS.includes(e as any)) : []
    } catch {
      parsedEvents = []
    }
    if (parsedEvents.length === 0) {
      return NextResponse.json({ error: "اختر حدثاً واحداً على الأقل" }, { status: 400 })
    }

    const webhook = await prisma.webhook.create({
      data: {
        name: name.trim(),
        url: url.trim(),
        secret: secret?.trim() || null,
        enabled: enabled !== false,
        events: JSON.stringify(parsedEvents),
        timeoutMs: Math.min(60000, Math.max(1000, parseInt(timeoutMs) || 10000)),
        maxRetries: Math.min(10, Math.max(0, parseInt(maxRetries) || 3)),
      },
    })

    await logActivity(actor.id, "WEBHOOK_CREATED", "integrations", `إنشاء Webhook "${webhook.name}"`)

    return NextResponse.json({ webhook }, { status: 201 })
  } catch (error) {
    console.error("webhooks POST error", error)
    return NextResponse.json({ error: "حدث خطأ في إنشاء الويب هوك" }, { status: 500 })
  }
}
