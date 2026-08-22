import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/generated/prisma/client"

const COUNTER_ID = "order-number"
const PREFIX = "ORD"
const MIN_DIGITS = 6

/**
 * توليد رقم طلب تسلسلي فريد — آمن ضد التكرار حتى مع الطلبات المتزامنة.
 *
 * يعتمد على صف عداد ذري (OrderCounter): القيمة تزيد بمقدار 1 في كل استدعاء.
 * مرِّر كائن المعاملة (tx) عندما يكون الطلب داخل معاملة حتى تتضمن زيادة العداد
 * نفس معاملة إنشاء الطلب — أي فشل في إنشاء الطلب يُلغي زيادة العداد (لا فجوات).
 */
export async function nextOrderNumber(tx?: Prisma.TransactionClient): Promise<string> {
  const client = tx ?? prisma
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const counter = await client.orderCounter.upsert({
        where: { id: COUNTER_ID },
        create: { id: COUNTER_ID, value: 1 },
        update: { value: { increment: 1 } },
      })
      return `${PREFIX}-${String(counter.value).padStart(MIN_DIGITS, "0")}`
    } catch (e) {
      // تصادم في إنشاء صف العداد لأول مرة (طلب متزامن) أو تعارض كتابة → إعادة المحاولة.
      const code = (e as { code?: string }).code
      if (code === "P2002" || code === "P2034") continue
      throw e
    }
  }
  throw new Error("تعذر توليد رقم طلب جديد، حاول مرة أخرى.")
}
