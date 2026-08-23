import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { testWebhookConnection } from "@/lib/events"
import { assertPublicWebhookUrl } from "@/lib/api/ssrf"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("webhooks.manage")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor
    const { id } = await params

    const existing = await prisma.webhook.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const body = await req.json()
    // Phase 3: SSRF guard — webhook targets must be public http(s) URLs.
    if (body.url !== undefined) {
      const check = assertPublicWebhookUrl(body.url)
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 })
      }
    }
    const data: any = {}
    if (body.name !== undefined) data.name = body.name.trim()
    if (body.url !== undefined) data.url = body.url.trim()
    if (body.secret !== undefined) data.secret = body.secret ? body.secret.trim() : null
    if (body.enabled !== undefined) data.enabled = !!body.enabled
    if (body.events !== undefined) {
      try {
        const evts = Array.isArray(body.events) ? body.events : JSON.parse(body.events)
        if (Array.isArray(evts)) data.events = JSON.stringify(evts)
      } catch {}
    }
    if (body.timeoutMs !== undefined) data.timeoutMs = Math.min(60000, Math.max(1000, parseInt(body.timeoutMs) || 10000))
    if (body.maxRetries !== undefined) data.maxRetries = Math.min(10, Math.max(0, parseInt(body.maxRetries) || 3))

    const webhook = await prisma.webhook.update({ where: { id }, data })
    await logActivity(actor.id, "WEBHOOK_UPDATED", "integrations", `تحديث Webhook "${webhook.name}"`)
    return NextResponse.json({ webhook })
  } catch (error) {
    console.error("webhooks PUT error", error)
    return NextResponse.json({ error: "حدث خطأ في تحديث الويب هوك" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("webhooks.manage")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor
    const { id } = await params

    const existing = await prisma.webhook.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    await prisma.webhook.delete({ where: { id } })
    await logActivity(actor.id, "WEBHOOK_DELETED", "integrations", `حذف Webhook "${existing.name}"`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("webhooks DELETE error", error)
    return NextResponse.json({ error: "حدث خطأ في حذف الويب هوك" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("webhooks.manage")
    if (guard instanceof NextResponse) return guard
    const { id } = await params

    const webhook = await prisma.webhook.findUnique({ where: { id } })
    if (!webhook) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const result = await testWebhookConnection(webhook.url, webhook.secret || "", webhook.timeoutMs || 10000)

    await prisma.webhook.update({
      where: { id },
      data: {
        lastDeliveryAt: new Date(),
        lastStatus: result.ok ? "OK" : "ERROR",
        lastStatusText: result.ok ? `Test HTTP ${result.status}` : result.error || `HTTP ${result.status}`,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("webhooks test POST error", error)
    return NextResponse.json({ error: "حدث خطأ في اختبار الاتصال" }, { status: 500 })
  }
}
