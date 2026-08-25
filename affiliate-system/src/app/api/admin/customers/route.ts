import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"
import { rawDateToIso, rawNumber } from "@/lib/raw-dates"

/**
 * Customer directory over raw SQL window functions.
 *
 * Portability notes (Phase 15): all queries use Prisma's tagged-template
 * `$queryRaw`, which binds every interpolated value as a real parameter with
 * the correct placeholder syntax per provider (`?` on SQLite, `$n` on
 * PostgreSQL). No `?` placeholders, no string interpolation of user input,
 * and datetime cutoffs are bound as JS Date objects instead of epoch-ms
 * numbers so they compare correctly against timestamp columns on both
 * databases. LOWER(...) preserves SQLite's case-insensitive LIKE semantics
 * on PostgreSQL without touching Arabic text.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("customers.view")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const search = (searchParams.get("search") || "").trim()
    const segment = searchParams.get("segment") || ""
    const sort = searchParams.get("sort") || "recent"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "12")))

    const like = `%${search}%`
    const searchFilter =
      search === ""
        ? Prisma.empty
        : Prisma.sql` AND (LOWER("customerPhone") LIKE LOWER(${like}) OR LOWER("customerName") LIKE LOWER(${like}))`

    const newCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    let segmentWhere = Prisma.empty
    if (segment === "NEW") segmentWhere = Prisma.sql` AND "firstOrderAt" >= ${newCutoff}`
    else if (segment === "DELIVERED") segmentWhere = Prisma.sql` AND "deliveredCnt" > 0`
    else if (segment === "CANCELLED") segmentWhere = Prisma.sql` AND "cancelledCnt" > 0`
    else if (segment === "PENDING") segmentWhere = Prisma.sql` AND "pendingCnt" > 0`

    const orderBySql =
      sort === "name" ? Prisma.sql`ORDER BY name ASC` :
      sort === "name_desc" ? Prisma.sql`ORDER BY name DESC` :
      sort === "orders" ? Prisma.sql`ORDER BY "orderCount" DESC` :
      sort === "orders_asc" ? Prisma.sql`ORDER BY "orderCount" ASC` :
      sort === "value" ? Prisma.sql`ORDER BY "totalValue" DESC` :
      sort === "value_asc" ? Prisma.sql`ORDER BY "totalValue" ASC` :
      Prisma.sql`ORDER BY "lastOrderAt" DESC`

    const offset = (page - 1) * limit
    // Deterministic tiebreaker for equal sort keys (stable pagination across pages).
    const orderByFinal = Prisma.sql`${orderBySql}, phone ASC`

    const windowCols = Prisma.sql`
      "customerPhone" AS phone,
      "customerName" AS name,
      "customerEmail" AS email,
      "customerCity" AS city,
      "customerGovernorate" AS governorate,
      COUNT(*) OVER (PARTITION BY "customerPhone") AS "orderCount",
      SUM(total) OVER (PARTITION BY "customerPhone") AS "totalValue",
      MIN("createdAt") OVER (PARTITION BY "customerPhone") AS "firstOrderAt",
      MAX("createdAt") OVER (PARTITION BY "customerPhone") AS "lastOrderAt",
      SUM(CASE WHEN status IN ('DELIVERED','COLLECTED') THEN 1 ELSE 0 END) OVER (PARTITION BY "customerPhone") AS "deliveredCnt",
      SUM(CASE WHEN status IN ('CANCELLED','RETURNED') THEN 1 ELSE 0 END) OVER (PARTITION BY "customerPhone") AS "cancelledCnt",
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) OVER (PARTITION BY "customerPhone") AS "pendingCnt",
      ROW_NUMBER() OVER (PARTITION BY "customerPhone" ORDER BY "createdAt" DESC) AS rn`

    const listSql = Prisma.sql`
      SELECT phone, name, email, city, governorate, "orderCount", "totalValue", "firstOrderAt", "lastOrderAt"
      FROM (SELECT ${windowCols} FROM "Order" WHERE 1=1${searchFilter}) WHERE rn = 1${segmentWhere}
      ${orderByFinal}
      LIMIT ${limit} OFFSET ${offset}`

    const countWindowCols = Prisma.sql`
      MIN("createdAt") OVER (PARTITION BY "customerPhone") AS "firstOrderAt",
      SUM(CASE WHEN status IN ('DELIVERED','COLLECTED') THEN 1 ELSE 0 END) OVER (PARTITION BY "customerPhone") AS "deliveredCnt",
      SUM(CASE WHEN status IN ('CANCELLED','RETURNED') THEN 1 ELSE 0 END) OVER (PARTITION BY "customerPhone") AS "cancelledCnt",
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) OVER (PARTITION BY "customerPhone") AS "pendingCnt",
      ROW_NUMBER() OVER (PARTITION BY "customerPhone" ORDER BY "createdAt" DESC) AS rn`

    const countSql = Prisma.sql`
      SELECT COUNT(*) AS total
      FROM (
        SELECT ${countWindowCols}
        FROM "Order" WHERE 1=1${searchFilter}
      ) WHERE rn = 1${segmentWhere}`

    const [list, totalRows, breakdown, affiliateMap, segmentsRow] = await Promise.all([
      prisma.$queryRaw<Record<string, unknown>[]>(listSql),
      prisma.$queryRaw<{ total: unknown }[]>(countSql),
      prisma.$queryRaw<{ phone: string; status: string; cnt: unknown }[]>`SELECT "customerPhone" AS phone, status, COUNT(*) AS cnt FROM "Order" GROUP BY "customerPhone", status`,
      prisma.$queryRaw<{ phone: string; affiliateId: string; cnt: unknown }[]>`SELECT "customerPhone" AS phone, "affiliateId", COUNT(*) AS cnt FROM "Order" GROUP BY "customerPhone", "affiliateId"`,
      prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT
          COUNT(*) AS "allCnt",
          SUM(CASE WHEN "firstOrderAt" >= ${newCutoff} THEN 1 ELSE 0 END) AS "newCnt",
          SUM(CASE WHEN "deliveredCnt" > 0 THEN 1 ELSE 0 END) AS "deliveredCnt",
          SUM(CASE WHEN "cancelledCnt" > 0 THEN 1 ELSE 0 END) AS "cancelledCnt",
          SUM(CASE WHEN "pendingCnt" > 0 THEN 1 ELSE 0 END) AS "pendingCnt"
        FROM (
          SELECT ${countWindowCols}
          FROM "Order" WHERE 1=1${searchFilter}
        ) WHERE rn = 1
      `,
    ])

    const total = rawNumber(totalRows[0]?.total)
    const pages = Math.max(1, Math.ceil(total / limit))

    const breakdownByPhone: Record<string, Record<string, number>> = {}
    for (const row of breakdown) {
      if (!breakdownByPhone[row.phone]) breakdownByPhone[row.phone] = {}
      breakdownByPhone[row.phone][row.status] = rawNumber(row.cnt)
    }

    const topAffiliateByPhone: Record<string, string> = {}
    const topAffiliateCnt: Record<string, number> = {}
    for (const row of affiliateMap) {
      const cnt = rawNumber(row.cnt)
      if (!topAffiliateByPhone[row.phone] || cnt > (topAffiliateCnt[row.phone] || 0)) {
        topAffiliateByPhone[row.phone] = row.affiliateId
        topAffiliateCnt[row.phone] = cnt
      }
    }

    const affiliateIds = Array.from(new Set(Object.values(topAffiliateByPhone))).filter(Boolean)
    const affiliates = affiliateIds.length
      ? await prisma.user.findMany({ where: { id: { in: affiliateIds } }, select: { id: true, name: true, email: true } })
      : []
    const affiliateById = Object.fromEntries(affiliates.map((a) => [a.id, a]))

    const customers = list.map((row) => ({
      id: `cust_${row.phone}`,
      phone: String(row.phone),
      name: (row.name as string) || "عميل",
      email: (row.email as string) || null,
      city: (row.city as string) || null,
      governorate: (row.governorate as string) || null,
      orderCount: rawNumber(row.orderCount),
      totalValue: rawNumber(row.totalValue),
      firstOrderAt: rawDateToIso(row.firstOrderAt),
      lastOrderAt: rawDateToIso(row.lastOrderAt),
      statusBreakdown: breakdownByPhone[String(row.phone)] || {},
      affiliate: topAffiliateByPhone[String(row.phone)] ? affiliateById[topAffiliateByPhone[String(row.phone)]] || null : null,
    }))

    const segRow = segmentsRow[0] || {}
    const segments = {
      all: rawNumber(segRow.allCnt),
      NEW: rawNumber(segRow.newCnt),
      DELIVERED: rawNumber(segRow.deliveredCnt),
      CANCELLED: rawNumber(segRow.cancelledCnt),
      PENDING: rawNumber(segRow.pendingCnt),
    }

    const [totals, repeat] = await Promise.all([
      prisma.$queryRaw<{ totalCustomers: unknown; totalOrders: unknown; totalRevenue: unknown }[]>`SELECT COUNT(DISTINCT "customerPhone") AS totalCustomers, COUNT(*) AS totalOrders, SUM(total) AS totalRevenue FROM "Order"`,
      prisma.$queryRaw<{ cnt: unknown }[]>`SELECT COUNT(*) AS cnt FROM (SELECT "customerPhone" FROM "Order" GROUP BY "customerPhone" HAVING COUNT(*) > 1)`,
    ])

    return NextResponse.json({
      customers,
      total,
      pages,
      summary: {
        totalCustomers: rawNumber(totals[0]?.totalCustomers),
        totalOrders: rawNumber(totals[0]?.totalOrders),
        totalRevenue: rawNumber(totals[0]?.totalRevenue),
        repeatCustomers: rawNumber(repeat[0]?.cnt),
      },
      segments,
    })
  } catch (error) {
    console.error("customers API error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
