import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { notify, NOTIFICATION_TYPE } from "@/lib/notifications"

/**
 * PUT /api/admin/stock-refill/[id]
 * body: { action: "approve" | "reject", quantity?: number, reason?: string }
 * - approve: يزيد المخزون فعليًا + يسجل في سجل المخزون + إشعار للمسوق
 * - reject:  يغلق الطلب مع سبب اختياري + إشعار للمسوق
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("products.update")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { id } = await params
    const { action, quantity, reason } = await req.json()

    const request = await prisma.stockRefillRequest.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, nameAr: true, stock: true } },
        affiliate: { select: { id: true, name: true } },
      },
    })
    if (!request) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 })
    }
    if (request.status !== "PENDING") {
      return NextResponse.json({ error: "تمت معالجة هذا الطلب بالفعل" }, { status: 409 })
    }

    if (action === "approve") {
      const qty = Math.max(1, parseInt(quantity as any) || request.requestedQty || 1)

      const updated = await prisma.$transaction(async (tx) => {
        const product = await tx.product.update({
          where: { id: request.productId },
          data: { stock: { increment: qty } },
        })
        const done = await tx.stockRefillRequest.update({
          where: { id },
          data: {
            status: "RESTOCKED",
            processedById: actor.id,
            processedAt: new Date(),
            reason: reason || null,
          },
        })
        await tx.stockLog.create({
          data: {
            productId: request.productId,
            type: "REFILL",
            quantityChange: qty,
            stockAfter: product.stock,
            note: `تجديد مخزون — طلب #${request.id}`,
            actorId: actor.id,
            requestId: id,
          },
        })
        return { product, done }
      })

      await logActivity(
        actor.id,
        "STOCK_RESTOCKED",
        "stock",
        `${actor.name} جدّد مخزون ${request.product.nameAr} بكمية ${qty} (المخزون الآن ${updated.product.stock})`,
        undefined
      )

      notify({
        title: `تم تجديد مخزون منتج ${request.product.nameAr} ✅`,
        message: `تمت إضافة ${qty} قطعة للمخزون. المخزون الحالي: ${updated.product.stock} قطعة.`,
        type: NOTIFICATION_TYPE.STOCK,
        userId: request.affiliateId,
        link: `/products/${request.productId}`,
        relatedId: request.productId,
      })

      return NextResponse.json(updated.done)
    }

    if (action === "reject") {
      const done = await prisma.stockRefillRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          processedById: actor.id,
          processedAt: new Date(),
          reason: reason || null,
        },
      })

      await logActivity(
        actor.id,
        "STOCK_REJECTED",
        "stock",
        `${actor.name} رفض طلب تجديد مخزون ${request.product.nameAr}${reason ? ` — السبب: ${reason}` : ""}`,
        undefined
      )

      notify({
        title: `تم رفض طلب تجديد مخزون ${request.product.nameAr}.`,
        message: reason ? `السبب: ${reason}` : "يمكنك إعادة طلب تجديد المخزون في أي وقت.",
        type: NOTIFICATION_TYPE.STOCK,
        userId: request.affiliateId,
        link: `/products/${request.productId}`,
        relatedId: request.productId,
      })

      return NextResponse.json(done)
    }

    return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 })
  } catch (error) {
    console.error("admin stock-refill PUT error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
