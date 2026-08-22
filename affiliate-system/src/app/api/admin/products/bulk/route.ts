import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { safeDeleteProduct, bulkUpdateStatus } from "@/lib/product-admin"

/**
 * POST /api/admin/products/bulk
 * body: { ids: string[], action: "delete" | "activate" | "deactivate" | "archive" | "restore" }
 * - delete:    حذف آمن جماعي — المنتجات غير المستخدمة تُحذف نهائيًا، والمرتبطة بطلبات تُؤرشف.
 * - activate / deactivate / archive / restore: تحديث حالة جماعي في طلب واحد.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("products.update")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { ids, action } = await req.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "اختر منتجًا واحدًا على الأقل" }, { status: 400 })
    }
    if (ids.length > 500) {
      return NextResponse.json({ error: "لا يمكن معالجة أكثر من 500 منتج في المرة الواحدة" }, { status: 400 })
    }
    const allowed: string[] = ["delete", "activate", "deactivate", "archive", "restore"]
    if (!allowed.includes(action)) {
      return NextResponse.json({ error: "إجراء غير صالح" }, { status: 400 })
    }

    // استبعد المنتجات المؤرشفة من العمليات الجماعية (تُدار من صفحة الأرشفة لو وُجدت).
    const existing = await prisma.product.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    })
    const validIds = existing.map((p) => p.id)
    if (validIds.length === 0) {
      return NextResponse.json({ error: "لا توجد منتجات صالحة للعملية" }, { status: 400 })
    }

    if (action === "delete") {
      const guard2 = await requireAdminPermission("products.delete")
      if (guard2 instanceof NextResponse) return guard2

      let deleted = 0
      let archived = 0
      const archivedIds: string[] = []
      for (const id of validIds) {
        const r = await safeDeleteProduct(id)
        if (r.outcome === "deleted") deleted++
        else {
          archived++
          archivedIds.push(id)
        }
      }

      await logActivity(
        actor.id,
        "PRODUCT_BULK_DELETE",
        "products",
        `${actor.name} حذف ${deleted} منتج وأرشف ${archived} منتج مرتبط بطلبات سابقة`,
        undefined
      )

      return NextResponse.json({
        success: true,
        deleted,
        archived,
        archivedIds,
        message:
          deleted > 0 && archived > 0
            ? `تم حذف ${deleted} منتج نهائيًا، وأُرشف ${archived} منتج مرتبط بطلبات سابقة للحفاظ على البيانات.`
            : deleted > 0
              ? `تم حذف ${deleted} منتج نهائيًا`
              : `لم يُحذف أي منتج نهائيًا؛ ${archived} منتج مرتبط بطلبات سابقة تمت أرشفته بدل الحذف.`,
      })
    }

    const count = await bulkUpdateStatus(validIds, action as "activate" | "deactivate" | "archive" | "restore")

    const labels: Record<string, string> = {
      activate: "تفعيل",
      deactivate: "إيقاف",
      archive: "أرشفة",
      restore: "استعادة",
    }

    await logActivity(
      actor.id,
      "PRODUCT_BULK_STATUS",
      "products",
      `${actor.name} قام بـ${labels[action]} ${count} منتج`,
      undefined
    )

    return NextResponse.json({
      success: true,
      updated: count,
      message: `تم ${labels[action]} ${count} منتج بنجاح`,
    })
  } catch (error) {
    console.error("admin products bulk error", error)
    return NextResponse.json({ error: "تعذر تنفيذ العملية. حاول مرة أخرى." }, { status: 500 })
  }
}
