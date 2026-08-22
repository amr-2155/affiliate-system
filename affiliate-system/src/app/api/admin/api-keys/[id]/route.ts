import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { ALL_PERMISSIONS } from "@/lib/permissions"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("api_keys.manage")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor
    const { id } = await params

    const existing = await prisma.apiKey.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const body = await req.json()
    const data: any = {}
    if (body.name !== undefined) data.name = body.name.trim()
    if (body.enabled !== undefined) data.enabled = !!body.enabled
    if (body.permissions !== undefined) {
      data.permissions = JSON.stringify(Array.isArray(body.permissions) ? body.permissions.filter((p: string) => ALL_PERMISSIONS.includes(p)) : [])
    }

    const record = await prisma.apiKey.update({
      where: { id },
      data,
      select: { id: true, name: true, keyPrefix: true, enabled: true, permissions: true, revokedAt: true, lastUsedAt: true },
    })

    await logActivity(actor.id, "API_KEY_UPDATED", "integrations", `تحديث مفتاح API "${record.name}"`)
    return NextResponse.json(record)
  } catch (error) {
    console.error("api-keys PUT error", error)
    return NextResponse.json({ error: "حدث خطأ في تحديث المفتاح" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("api_keys.manage")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor
    const { id } = await params

    const existing = await prisma.apiKey.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    await prisma.apiKey.delete({ where: { id } })
    await logActivity(actor.id, "API_KEY_DELETED", "integrations", `حذف مفتاح API "${existing.name}"`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("api-keys DELETE error", error)
    return NextResponse.json({ error: "حدث خطأ في حذف المفتاح" }, { status: 500 })
  }
}
