import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { getAdapter, parseProviderConfig, type ProviderCredentials } from "@/lib/shipping/providers"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("integrations.manage")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor
    const { id } = await params

    const existing = await prisma.shippingProvider.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const body = await req.json()
    const data: any = {}
    if (body.name !== undefined) data.name = body.name.trim()
    if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl ? body.baseUrl.trim() : null
    if (body.apiKey !== undefined) data.apiKey = body.apiKey ? body.apiKey.trim() : null
    if (body.apiSecret !== undefined) data.apiSecret = body.apiSecret ? body.apiSecret.trim() : null
    if (body.enabled !== undefined) data.enabled = !!body.enabled
    if (body.config !== undefined && typeof body.config === "object") data.config = JSON.stringify(body.config)

    const provider = await prisma.shippingProvider.update({ where: { id }, data })
    await logActivity(actor.id, "SHIPPING_PROVIDER_UPDATED", "integrations", `تحديث مزود الشحن "${provider.name}"`)
    return NextResponse.json({ provider })
  } catch (error) {
    console.error("shipping-providers PUT error", error)
    return NextResponse.json({ error: "حدث خطأ في تحديث المزود" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("integrations.manage")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor
    const { id } = await params

    const existing = await prisma.shippingProvider.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const shipments = await prisma.shipment.count({ where: { providerId: id } })
    if (shipments > 0) {
      return NextResponse.json({ error: "لا يمكن حذف مزود لديه شحنات مسجلة" }, { status: 400 })
    }

    await prisma.shippingProvider.delete({ where: { id } })
    await logActivity(actor.id, "SHIPPING_PROVIDER_DELETED", "integrations", `حذف مزود الشحن "${existing.name}"`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("shipping-providers DELETE error", error)
    return NextResponse.json({ error: "حدث خطأ في حذف المزود" }, { status: 500 })
  }
}

/** اختبار اتصال حقيقي بالمزود عبر معطياته الحالية */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("integrations.manage")
    if (guard instanceof NextResponse) return guard
    const { id } = await params

    const provider = await prisma.shippingProvider.findUnique({ where: { id } })
    if (!provider) return NextResponse.json({ error: "غير موجود" }, { status: 404 })

    const adapter = getAdapter(provider.code)
    if (!adapter) return NextResponse.json({ error: "مزود غير معروف" }, { status: 400 })

    const creds: ProviderCredentials = {
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      apiSecret: provider.apiSecret,
      config: parseProviderConfig(provider.config),
    }

    const result = await adapter.testConnection(creds)

    await prisma.shippingProvider.update({
      where: { id },
      data: {
        testStatus: result.ok ? "OK" : "ERROR",
        testStatusText: result.error || (result.status ? `HTTP ${result.status}` : "متصل"),
        lastTestAt: new Date(),
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("shipping-providers test POST error", error)
    return NextResponse.json({ error: "حدث خطأ في اختبار الاتصال" }, { status: 500 })
  }
}
