import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { listAdapterCodes, getAdapter } from "@/lib/shipping/providers"

export async function GET() {
  try {
    const guard = await requireAdminPermission("integrations.view")
    if (guard instanceof NextResponse) return guard

    const providers = await prisma.shippingProvider.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { shipments: true } } },
    })
    return NextResponse.json({ providers, availableCodes: listAdapterCodes() })
  } catch (error) {
    console.error("shipping-providers GET error", error)
    return NextResponse.json({ error: "حدث خطأ في تحميل مزودي الشحن" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("integrations.manage")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const body = await req.json()
    const { name, code, baseUrl, apiKey, apiSecret, enabled, config } = body

    if (!name?.trim() || !code?.trim()) {
      return NextResponse.json({ error: "الاسم والكود مطلوبان" }, { status: 400 })
    }
    if (!getAdapter(code)) {
      return NextResponse.json({ error: "مزود غير معروف" }, { status: 400 })
    }

    const provider = await prisma.shippingProvider.create({
      data: {
        name: name.trim(),
        code: code.trim(),
        baseUrl: baseUrl?.trim() || null,
        apiKey: apiKey?.trim() || null,
        apiSecret: apiSecret?.trim() || null,
        enabled: enabled === true,
        config: typeof config === "object" && config ? JSON.stringify(config) : "{}",
      },
    })

    await logActivity(actor.id, "SHIPPING_PROVIDER_CREATED", "integrations", `إضافة مزود شحن "${provider.name}"`)

    return NextResponse.json({ provider }, { status: 201 })
  } catch (error) {
    console.error("shipping-providers POST error", error)
    return NextResponse.json({ error: "حدث خطأ في إضافة المزود" }, { status: 500 })
  }
}
