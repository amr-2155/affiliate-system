import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { generateApiKey } from "@/lib/api-keys"
import { ALL_PERMISSIONS } from "@/lib/permissions"

export async function GET() {
  try {
    const guard = await requireAdminPermission("api_keys.view")
    if (guard instanceof NextResponse) return guard

    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        enabled: true,
        lastUsedAt: true,
        createdAt: true,
        revokedAt: true,
        permissions: true,
      },
    })
    return NextResponse.json({ keys, availablePermissions: ALL_PERMISSIONS })
  } catch (error) {
    console.error("api-keys GET error", error)
    return NextResponse.json({ error: "حدث خطأ في تحميل مفاتيح API" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("api_keys.manage")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const body = await req.json()
    const { name, permissions } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "اسم المفتاح مطلوب" }, { status: 400 })
    }

    const allowed = Array.isArray(permissions) ? permissions.filter((p) => ALL_PERMISSIONS.includes(p)) : []

    const { key, prefix, hash } = generateApiKey(name.trim())

    const record = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        keyPrefix: prefix,
        keyHash: hash,
        permissions: JSON.stringify(allowed),
      },
      select: { id: true, name: true, keyPrefix: true, enabled: true, createdAt: true },
    })

    await logActivity(actor.id, "API_KEY_CREATED", "integrations", `إنشاء مفتاح API "${record.name}"`)

    // المفتاح الكامل يُعرض مرة واحدة فقط
    return NextResponse.json({ ...record, key }, { status: 201 })
  } catch (error) {
    console.error("api-keys POST error", error)
    return NextResponse.json({ error: "حدث خطأ في إنشاء المفتاح" }, { status: 500 })
  }
}
