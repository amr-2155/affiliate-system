import { PrismaClient } from "./src/generated/prisma/client"

process.env.DATABASE_URL = process.env.DATABASE_URL || "file:C:/Users/A/Documents/New folder/affiliate-system/prisma/dev.db"

const prisma = new PrismaClient()

async function main() {
  const id = process.argv[2]
  const daysAgo = parseFloat(process.argv[3])
  if (!id || !daysAgo) {
    console.log("usage: npx tsx backdate.mts <orderId> <daysAgo>")
    process.exit(1)
  }
  const past = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
  const result = await prisma.order.update({ where: { id }, data: { confirmationDeadline: past } })
  console.log("backdated:", result.orderNumber, result.confirmationDeadline)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
