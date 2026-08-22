import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { getSetting } from "@/lib/settings"

/** حالة تكامل n8n — يعرض الإعدادات بلا أسرار */
export async function GET() {
  try {
    const guard = await requireAdminPermission("integrations.view")
    if (guard instanceof NextResponse) return guard

    const [enabled, url] = await Promise.all([
      getSetting("integrations-n8n-enabled", "false"),
      getSetting("integrations-n8n-url", ""),
    ])

    return NextResponse.json({
      enabled: enabled === "true",
      url,
      hasApiKey: (await getSetting("integrations-n8n-api-key", "")) !== "",
    })
  } catch (error) {
    console.error("n8n GET error", error)
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 })
  }
}

/** حفظ إعدادات n8n (تُخزَّن في SystemSetting) */
export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("integrations.manage")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const body = await req.json()
    const updates: [string, string][] = []

    if (body.enabled !== undefined) updates.push(["integrations-n8n-enabled", body.enabled ? "true" : "false"])
    if (body.url !== undefined) updates.push(["integrations-n8n-url", String(body.url || "")])
    if (body.apiKey !== undefined) updates.push(["integrations-n8n-api-key", String(body.apiKey || "")])

    for (const [key, value] of updates) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }

    if (updates.length > 0) {
      await logActivity(actor.id, "N8N_UPDATED", "integrations", `تحديث إعدادات n8n: ${updates.map(([k]) => k).join("، ")}`)
    }

    return NextResponse.json({ message: "تم الحفظ", updated: updates.length })
  } catch (error) {
    console.error("n8n PUT error", error)
    return NextResponse.json({ error: "حدث خطأ في الحفظ" }, { status: 500 })
  }
}
