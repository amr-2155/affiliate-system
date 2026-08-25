import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, actorCan } from "@/lib/admin-guard"
import { textMatch } from "@/lib/text-search"
import { rawDateToIso } from "@/lib/raw-dates"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("products.view")
    if (guard instanceof NextResponse) return guard

    const actor = guard.actor
    const canProducts = actorCan(actor, "products.view")
    const canOrders = actorCan(actor, "orders.view")
    const canAffiliates = actorCan(actor, "affiliates.view")
    const canCustomers = actorCan(actor, "customers.view")
    if (!canProducts && !canOrders && !canAffiliates && !canCustomers) {
      return NextResponse.json({ error: "ليس لديك صلاحية لهذا الإجراء" }, { status: 403 })
    }

    const q = new URL(req.url).searchParams.get("q") || ""
    if (!q.trim()) {
      return NextResponse.json({ products: [], orders: [], affiliates: [], customers: [] })
    }

    // Portable raw SQL: the tagged template lets Prisma pick the correct
    // placeholder syntax per provider (? on SQLite, $n on PostgreSQL) and
    // binds every value as a parameter — no string interpolation of user input.
    // LOWER(...) keeps LIKE case-insensitivity identical on both databases
    // while leaving Arabic text untouched.
    const like = `%${q}%`
    const [products, orders, affiliates, customers] = await Promise.all([
      canProducts
        ? prisma.product.findMany({
            where: {
              OR: [
                { name: textMatch(q) },
                { nameAr: textMatch(q) },
                { sku: textMatch(q) },
              ],
            },
            take: 5,
            select: { id: true, nameAr: true, name: true, image: true, price: true, sku: true },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      canOrders
        ? prisma.order.findMany({
            where: {
              OR: [
                { orderNumber: textMatch(q) },
                { customerName: textMatch(q) },
                { customerPhone: textMatch(q) },
              ],
            },
            take: 5,
            select: { id: true, orderNumber: true, customerName: true, total: true, status: true },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      canAffiliates
        ? prisma.user.findMany({
            where: {
              role: "AFFILIATE",
              OR: [
                { name: textMatch(q) },
                { email: textMatch(q) },
                { referralCode: textMatch(q) },
              ],
            },
            take: 5,
            select: { id: true, name: true, email: true, referralCode: true },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      canCustomers
        ? prisma.$queryRaw<{ phone: string; name: string; orderCount: unknown; totalValue: unknown; lastOrderAt: unknown }[]>`
            SELECT phone, name, "orderCount", "totalValue", "lastOrderAt" FROM (
              SELECT
                "customerPhone" AS phone,
                "customerName" AS name,
                COUNT(*) OVER (PARTITION BY "customerPhone") AS "orderCount",
                SUM(total) OVER (PARTITION BY "customerPhone") AS "totalValue",
                MAX("createdAt") OVER (PARTITION BY "customerPhone") AS "lastOrderAt",
                ROW_NUMBER() OVER (PARTITION BY "customerPhone" ORDER BY "createdAt" DESC) AS rn
              FROM "Order"
              WHERE LOWER("customerPhone") LIKE LOWER(${like}) OR LOWER("customerName") LIKE LOWER(${like})
            ) WHERE rn = 1
            ORDER BY "lastOrderAt" DESC
            LIMIT 5
          `
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      products,
      orders,
      affiliates,
      customers: customers.map((row) => ({
        id: `cust_${row.phone}`,
        name: row.name,
        phone: row.phone,
        orderCount: Number(row.orderCount),
        totalValue: Number(row.totalValue || 0),
        lastOrderAt: rawDateToIso(row.lastOrderAt),
      })),
    })
  } catch (error) {
    console.error("search API error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
