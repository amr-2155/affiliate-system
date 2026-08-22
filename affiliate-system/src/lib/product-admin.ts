import { prisma } from "@/lib/prisma"

export interface SafeDeleteResult {
  outcome: "deleted" | "archived"
  reason?: string
}

/**
 * حذف آمن لمنتج مع حماية البيانات التاريخية:
 * - إذا كان المنتج مرتبطًا بطلبات سابقة أو اقتراحات منتجات، لا يُحذف نهائيًا؛
 *   بل يُؤرشف (Soft Delete) بالحفاظ على السجل التاريخي للطلبات والعمولات والتقارير.
 * - إذا لم يُستخدم المنتج إطلاقًا، يُحذف فعليًا مع كل بياناته الفرعية (المتغيرات، الصور، المفضلة، سجل المخزون).
 */
export async function safeDeleteProduct(productId: string): Promise<SafeDeleteResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, nameAr: true, deletedAt: true },
  })
  if (!product) {
    const err = Object.assign(new Error("المنتج غير موجود"), { status: 404 })
    throw err
  }

  const [_orderItems, _suggestions] = await Promise.all([
    prisma.orderItem.count({ where: { productId } }),
    prisma.productSuggestion.count({ where: { productId } }),
  ])

  // المنتج دخل في طلبات/اقتراحات سابقة → أرشفة آمنة بدل الحذف النهائي.
  if (_orderItems > 0 || _suggestions > 0) {
    await prisma.product.update({
      where: { id: productId },
      data: { deletedAt: new Date(), status: "INACTIVE", isVisible: false },
    })
    return {
      outcome: "archived",
      reason: _orderItems > 0 ? "مرتبط بطلبات سابقة" : "مرتبط ببيانات تاريخية",
    }
  }

  // لم يُستخدم المنتج → حذف نهائي مع حذف كل ما يرتبط به (متغيرات، صور، مفضلة، سجل مخزون، طلبات تجديد).
  await prisma.product.delete({ where: { id: productId } })
  return { outcome: "deleted" }
}

/** تعطيل/تفعيل/أرشفة مجموعة منتجات في طلب واحد. */
export async function bulkUpdateStatus(ids: string[], action: "activate" | "deactivate" | "archive" | "restore") {
  const where = { id: { in: ids }, deletedAt: null }

  const settings: Record<string, { status: string; isVisible: boolean }> = {
    activate: { status: "ACTIVE", isVisible: true },
    deactivate: { status: "INACTIVE", isVisible: false },
    archive: { status: "ARCHIVED", isVisible: false },
    restore: { status: "ACTIVE", isVisible: true },
  }

  const result = await prisma.product.updateMany({
    where,
    data: settings[action],
  })
  return result.count
}
