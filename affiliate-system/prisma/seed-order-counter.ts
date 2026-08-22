/**
 * تهيئة عداد أرقام الطلبات (OrderCounter) بما يضمن أن الأرقام التسلسلية الجديدة
 * لا تتعارض مع أي رقم طلب موجود. يُشغَّل مرة واحدة بعد الترقية:
 *   npx tsx prisma/seed-order-counter.ts
 */
import path from "path"
import { PrismaClient } from "../src/generated/prisma/client"

process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(__dirname, "dev.db")}`

const prisma = new PrismaClient()
const COUNTER_ID = "order-number"

async function main() {
  const [orderCount, counters] = await Promise.all([
    prisma.order.count(),
    prisma.orderCounter.findMany(),
  ])

  let maxNumeric = 0
  const orders = await prisma.order.findMany({
    select: { orderNumber: true },
  })
  for (const o of orders) {
    const m = /^ORD-(\d+)$/.exec(o.orderNumber)
    if (m) maxNumeric = Math.max(maxNumeric, parseInt(m[1], 10))
  }

  const seedValue = Math.max(orderCount, maxNumeric)
  const current = counters.find((c) => c.id === COUNTER_ID)

  if (!current) {
    await prisma.orderCounter.create({ data: { id: COUNTER_ID, value: seedValue } })
    console.log(`تم إنشاء العداد بقيمة ${seedValue} (عدد الطلبات: ${orderCount})`)
  } else if (seedValue > current.value) {
    await prisma.orderCounter.update({
      where: { id: COUNTER_ID },
      data: { value: seedValue },
    })
    console.log(`تم رفع العداد من ${current.value} إلى ${seedValue}`)
  } else {
    console.log(`العداد الحالي (${current.value}) أكبر أو يساوي القيمة المستهدفة (${seedValue}) — لا تغيير`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
