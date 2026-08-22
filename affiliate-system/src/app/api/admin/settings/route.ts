import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"

const ALLOWED_KEYS = new Set([
  "site-name",
  "site-name-ar",
  "logo-url",
  "support-whatsapp",
  "facebook-page-url",
  "facebook-group-url",
  "brand-primary",
  "brand-primary-light",
  "brand-primary-dark",
  "brand-accent",
  "brand-accent-light",
  "brand-bg",
  "brand-surface",
  "brand-text",
  "brand-text-secondary",
  "brand-success",
  "brand-danger",
  "notif-new-order",
  "notif-new-affiliate",
  "notif-withdrawal",
  "users-affiliate-withdrawal-min",
  "orders-auto-cancel-enabled",
  "orders-auto-cancel-days",
  "confirmation-attempts-per-day",
  "confirmation-duration-days",
  "confirmation-channels",
  "confirmation-attempt-schedule",
  "confirmation-max-pending-hours",
  "integrations-n8n-url",
  "integrations-n8n-api-key",
  "integrations-n8n-enabled",
])

export async function GET() {
  try {
    const guard = await requireAdminPermission("settings.view")
    if (guard instanceof NextResponse) return guard

    const settings = await prisma.systemSetting.findMany()
    const map: Record<string, string> = {}
    settings.forEach((s) => { map[s.key] = s.value })
    return NextResponse.json(map)
  } catch (error) {
    console.error("admin settings GET error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("settings.update")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const body = await req.json()
    const updates = Object.entries(body).filter(([key]) => ALLOWED_KEYS.has(key)) as [string, string][]

    for (const [key, value] of updates) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }

    if (updates.length > 0) {
      await logActivity(actor.id, "SETTINGS_UPDATED", "settings", `تم تحديث ${updates.length} إعداد: ${updates.map(([k]) => k).join("، ")}`)
    }

    return NextResponse.json({ message: "تم الحفظ", updated: updates.length })
  } catch (error) {
    console.error("admin settings PUT error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
