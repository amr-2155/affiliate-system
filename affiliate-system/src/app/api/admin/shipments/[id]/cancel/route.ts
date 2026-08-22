import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { getAdapter, parseProviderConfig, type ProviderCredentials } from "@/lib/shipping/providers"

/** إلغاء شحنة عبر مزودها (إن كان يدعم الإلغاء) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("orders.update")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor
    const { id } = await params

    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: { provider: true },
    })
    if (!shipment) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
    if (shipment.status === "CANCELLED") return NextResponse.json({ error: "الشحنة ملغاة بالفعل" }, { status: 400 })

    const adapter = getAdapter(shipment.provider.code)
    let result: { ok: boolean; error?: string } = { ok: false, error: "هذا المزود لا يدعم الإلغاء التلقائي" }
    if (adapter && shipment.providerShipmentId) {
      const creds: ProviderCredentials = {
        baseUrl: shipment.provider.baseUrl,
        apiKey: shipment.provider.apiKey,
        apiSecret: shipment.provider.apiSecret,
        config: parseProviderConfig(shipment.provider.config),
      }
      result = await adapter.cancelShipment(creds, shipment.providerShipmentId)
    }

    await prisma.shipment.update({
      where: { id },
      data: {
        status: result.ok ? "CANCELLED" : "CANCEL_FAILED",
        error: result.ok ? null : result.error,
        lastStatusAt: new Date(),
      },
    })

    if (result.ok) {
      await logActivity(actor.id, "SHIPMENT_CANCELLED", "orders", `إلغاء شحنة ${shipment.trackingNumber || shipment.id}`)
    }

    return NextResponse.json(result.ok ? { ok: true } : { ok: false, error: result.error }, { status: result.ok ? 200 : 400 })
  } catch (error) {
    console.error("shipment cancel POST error", error)
    return NextResponse.json({ error: "حدث خطأ في إلغاء الشحنة" }, { status: 500 })
  }
}
