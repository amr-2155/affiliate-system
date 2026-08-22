import { prisma } from "@/lib/prisma"
import { notifyMany, NOTIFICATION_TYPE } from "@/lib/notifications"

export const STOCK_REQUEST_STATUSES = ["PENDING", "RESTOCKED", "REJECTED"] as const

export type StockRequestStatus = (typeof STOCK_REQUEST_STATUSES)[number]

/** هل يوجد طلب تجديد مفتوح لنفس المنتج من نفس المسوق؟ */
export async function hasPendingRefillRequest(productId: string, affiliateId: string): Promise<boolean> {
  const existing = await prisma.stockRefillRequest.findFirst({
    where: { productId, affiliateId, status: "PENDING" },
    select: { id: true },
  })
  return !!existing
}

/** آخر تجديد ناجح للمنتج (لأي مسوق) — لتحديد "تاريخ آخر تجديد". */
export async function getLastRestock(productId: string) {
  return prisma.stockRefillRequest.findFirst({
    where: { productId, status: "RESTOCKED" },
    orderBy: { processedAt: "desc" },
    select: { id: true, processedAt: true, processedById: true, requestedQty: true },
  })
}

/**
 * إشعار تلقائي لكل المسوقين النشطين عندما ينخفض مخزون منتج إلى حد التنبيه أو أقل.
 * يُمنع التكرار: لا يُرسل إشعار جديد ما دام المخزون ما زال منخفضًا —
 * وعندما ينتعش فوق الحد ثم ينخفض مجددًا يُرسل إشعار جديد (حدث انخفاض جديد).
 */
export async function notifyLowStock(
  product: { id: string; nameAr: string; stock: number; lowStockThreshold: number },
  prevStock?: number,
): Promise<boolean> {
  if (product.stock > product.lowStockThreshold) return false

  const lastLog = await prisma.stockLog.findFirst({
    where: { productId: product.id, type: "LOW_STOCK" },
    orderBy: { createdAt: "desc" },
    select: { stockAfter: true },
  })
  // ما زلنا في حالة الانخفاض نفسها (آخر انخفاض لم يُحسم وما زال المخزون منخفضًا) — لا نرسل إشعارًا مكررًا.
  // أما إذا انتعش المخزون فوق الحد ثم انخفض مجددًا (prevStock أعلى من الحد) فهو انخفاض جديد يُرسل له إشعار.
  const wasLow = prevStock !== undefined ? prevStock <= product.lowStockThreshold : true
  if (lastLog && lastLog.stockAfter <= product.lowStockThreshold && wasLow) return false

  const affiliates = await prisma.user.findMany({
    where: { role: "AFFILIATE", status: "ACTIVE" },
    select: { id: true },
  })
  if (affiliates.length === 0) return false

  const title = `مخزون منخفض: ${product.nameAr}`
  const message = `بقي ${product.stock} قطع فقط من المنتج — الأقل من حد التنبيه (${product.lowStockThreshold}). اطلب تجديد المخزون الآن.`

  notifyMany(affiliates.map((u) => u.id), {
    title,
    message,
    type: NOTIFICATION_TYPE.STOCK,
    link: `/products/${product.id}`,
    relatedId: product.id,
  })
  await prisma.stockLog.create({
    data: {
      productId: product.id,
      type: "LOW_STOCK",
      quantityChange: 0,
      stockAfter: product.stock,
      note: `إشعار تلقائي: المخزون وصل لحد التنبيه (${product.lowStockThreshold})`,
    },
  })

  return true
}
