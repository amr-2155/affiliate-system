import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authenticateApiKey } from "@/lib/api-keys"
import { formatCurrency } from "@/lib/utils"
import { applyOrderTransition, OrderStateError } from "@/lib/order-service"

/**
 * نقطة وصول عامة لمصادقة API Key — تُستخدم لإرسال أحداث الطلب
 * إلى خدمات خارجية (n8n وغيرها).
 *
 * كل تحديثات الحالة تمر عبر OrderService: تحقق الانتقالات، قفل
 * الحالات النهائية، وذرّية العمولة/البونص/الأحداث — نفس المسار
 * المستخدم في لوحة الأدمن والـ webhooks (لا منطق مكرر ولا انحراف).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await authenticateApiKey(req, "orders.update")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { status, trackingNumber, reason } = body

    if (status === undefined && trackingNumber === undefined) {
      return NextResponse.json({ error: "لا توجد تغييرات صالحة" }, { status: 400 })
    }

    // Non-status fields update directly; status goes through OrderService.
    if (trackingNumber !== undefined) {
      const res = await prisma.order.updateMany({
        where: { id },
        data: { trackingNumber: String(trackingNumber) },
      })
      if (res.count === 0) {
        return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
      }
    }

    if (status !== undefined) {
      try {
        await applyOrderTransition({
          orderId: id,
          to: String(status),
          source: "api",
          cancelReason: typeof reason === "string" ? reason : "إلغاء عبر API",
        })
      } catch (e) {
        if (e instanceof OrderStateError) {
          return NextResponse.json({ error: e.message }, { status: e.httpStatus })
        }
        throw e
      }
    }

    const updated = await prisma.order.findUnique({
      where: { id },
      select: { orderNumber: true, status: true },
    })
    if (!updated) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, order: updated })
  } catch (error) {
    console.error("api/v1 status error", error)
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await authenticateApiKey(req, "orders.read")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        currency: true,
        trackingNumber: true,
        customerName: true,
        customerCity: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!order) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      order: {
        ...order,
        totalFormatted: formatCurrency(order.total),
      },
    })
  } catch (error) {
    console.error("api/v1 order GET error", error)
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 })
  }
}
