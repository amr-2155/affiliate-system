import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { createShipmentForOrder } from "@/lib/shipping/providers"

export async function GET() {
  try {
    const guard = await requireAdminPermission("orders.view")
    if (guard instanceof NextResponse) return guard

    const shipments = await prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { id: true, orderNumber: true, customerName: true, customerCity: true } },
        provider: { select: { id: true, name: true, code: true } },
      },
      take: 200,
    })
    return NextResponse.json({ shipments })
  } catch (error) {
    console.error("shipments GET error", error)
    return NextResponse.json({ error: "حدث خطأ في تحميل الشحنات" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("orders.update")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const body = await req.json()
    const { orderId, providerId } = body

    if (!orderId || !providerId) {
      return NextResponse.json({ error: "رقم الطلب والمزود مطلوبان" }, { status: 400 })
    }

    const result = await createShipmentForOrder(orderId, providerId)

    if (!result.ok) {
      return NextResponse.json({ error: result.error, shipment: result.shipment || null }, { status: 400 })
    }

    await logActivity(actor.id, "SHIPMENT_CREATED", "orders", `إنشاء شحنة للطلب ${result.shipment?.orderId || orderId} عبر ${result.shipment?.providerId || providerId}`)
    return NextResponse.json({ shipment: result.shipment }, { status: 201 })
  } catch (error) {
    console.error("shipments POST error", error)
    return NextResponse.json({ error: "حدث خطأ في إنشاء الشحنة" }, { status: 500 })
  }
}
