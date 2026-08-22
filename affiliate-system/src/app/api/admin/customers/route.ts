import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

const toDate = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(v)
  if (Number.isNaN(n)) return null
  return new Date(n).toISOString()
}

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

    const whereClause = `(? = '' OR customerPhone LIKE ? OR customerName LIKE ?)`
    const whereParams: any[] = [search, `%${search}%`, `%${search}%`]

    let segmentWhere = ""
    const segmentParams: any[] = []
    const newCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    if (segment === "NEW") {
      segmentWhere = " AND firstOrderAt >= ?"
      segmentParams.push(newCutoff)
    } else if (segment === "DELIVERED") segmentWhere = " AND deliveredCnt > 0"
    else if (segment === "CANCELLED") segmentWhere = " AND cancelledCnt > 0"
    else if (segment === "PENDING") segmentWhere = " AND pendingCnt > 0"

    const orderBySql =
      sort === "name" ? "ORDER BY name ASC" :
      sort === "name_desc" ? "ORDER BY name DESC" :
      sort === "orders" ? "ORDER BY orderCount DESC" :
      sort === "orders_asc" ? "ORDER BY orderCount ASC" :
      sort === "value" ? "ORDER BY totalValue DESC" :
      sort === "value_asc" ? "ORDER BY totalValue ASC" :
      "ORDER BY lastOrderAt DESC"

    const offset = (page - 1) * limit
    const allParams = [...whereParams, ...segmentParams]

    const windowCols = `
      customerPhone AS phone,
      customerName AS name,
      customerEmail AS email,
      customerCity AS city,
      customerGovernorate AS governorate,
      COUNT(*) OVER (PARTITION BY customerPhone) AS orderCount,
      SUM(total) OVER (PARTITION BY customerPhone) AS totalValue,
      MIN(createdAt) OVER (PARTITION BY customerPhone) AS firstOrderAt,
      MAX(createdAt) OVER (PARTITION BY customerPhone) AS lastOrderAt,
      SUM(CASE WHEN status IN ('DELIVERED','COLLECTED') THEN 1 ELSE 0 END) OVER (PARTITION BY customerPhone) AS deliveredCnt,
      SUM(CASE WHEN status IN ('CANCELLED','RETURNED') THEN 1 ELSE 0 END) OVER (PARTITION BY customerPhone) AS cancelledCnt,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) OVER (PARTITION BY customerPhone) AS pendingCnt,
      ROW_NUMBER() OVER (PARTITION BY customerPhone ORDER BY createdAt DESC) AS rn`

    const listSql = `
      SELECT phone, name, email, city, governorate, orderCount, totalValue, firstOrderAt, lastOrderAt
      FROM (SELECT ${windowCols} FROM "Order" WHERE ${whereClause}) WHERE rn = 1${segmentWhere}
      ${orderBySql}
      LIMIT ? OFFSET ?`

    const countSql = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT MIN(createdAt) OVER (PARTITION BY customerPhone) AS firstOrderAt,
          SUM(CASE WHEN status IN ('DELIVERED','COLLECTED') THEN 1 ELSE 0 END) OVER (PARTITION BY customerPhone) AS deliveredCnt,
          SUM(CASE WHEN status IN ('CANCELLED','RETURNED') THEN 1 ELSE 0 END) OVER (PARTITION BY customerPhone) AS cancelledCnt,
          SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) OVER (PARTITION BY customerPhone) AS pendingCnt,
          ROW_NUMBER() OVER (PARTITION BY customerPhone ORDER BY createdAt DESC) AS rn
        FROM "Order" WHERE ${whereClause}
      ) WHERE rn = 1${segmentWhere}`

    const [list, totalRows, breakdown, affiliateMap, segmentsRow] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(listSql, ...allParams, limit, offset),
      prisma.$queryRawUnsafe<any[]>(countSql, ...allParams),
      prisma.$queryRawUnsafe<any[]>(`SELECT customerPhone AS phone, status, COUNT(*) AS cnt FROM "Order" GROUP BY customerPhone, status`),
      prisma.$queryRawUnsafe<any[]>(`SELECT customerPhone AS phone, affiliateId, COUNT(*) AS cnt FROM "Order" GROUP BY customerPhone, affiliateId`),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*) AS allCnt,
          SUM(CASE WHEN firstOrderAt >= ${newCutoff} THEN 1 ELSE 0 END) AS newCnt,
          SUM(CASE WHEN deliveredCnt > 0 THEN 1 ELSE 0 END) AS deliveredCnt,
          SUM(CASE WHEN cancelledCnt > 0 THEN 1 ELSE 0 END) AS cancelledCnt,
          SUM(CASE WHEN pendingCnt > 0 THEN 1 ELSE 0 END) AS pendingCnt
        FROM (
          SELECT MIN(createdAt) OVER (PARTITION BY customerPhone) AS firstOrderAt,
            SUM(CASE WHEN status IN ('DELIVERED','COLLECTED') THEN 1 ELSE 0 END) OVER (PARTITION BY customerPhone) AS deliveredCnt,
            SUM(CASE WHEN status IN ('CANCELLED','RETURNED') THEN 1 ELSE 0 END) OVER (PARTITION BY customerPhone) AS cancelledCnt,
            SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) OVER (PARTITION BY customerPhone) AS pendingCnt,
            ROW_NUMBER() OVER (PARTITION BY customerPhone ORDER BY createdAt DESC) AS rn
          FROM "Order" WHERE ${whereClause}
        ) WHERE rn = 1
      `, ...whereParams),
    ])

    const total = Number(totalRows[0]?.total || 0)
    const pages = Math.max(1, Math.ceil(total / limit))

    const breakdownByPhone: Record<string, Record<string, number>> = {}
    for (const row of breakdown) {
      const phone = row.phone
      if (!breakdownByPhone[phone]) breakdownByPhone[phone] = {}
      breakdownByPhone[phone][row.status] = Number(row.cnt)
    }

    const topAffiliateByPhone: Record<string, string> = {}
    const topAffiliateCnt: Record<string, number> = {}
    for (const row of affiliateMap) {
      const phone = row.phone
      const cnt = Number(row.cnt)
      if (!topAffiliateByPhone[phone] || cnt > (topAffiliateCnt[phone] || 0)) {
        topAffiliateByPhone[phone] = row.affiliateId
        topAffiliateCnt[phone] = cnt
      }
    }

    const affiliateIds = Array.from(new Set(Object.values(topAffiliateByPhone))).filter(Boolean)
    const affiliates = affiliateIds.length
      ? await prisma.user.findMany({ where: { id: { in: affiliateIds } }, select: { id: true, name: true, email: true } })
      : []
    const affiliateById = Object.fromEntries(affiliates.map((a) => [a.id, a]))

    const customers = list.map((row) => ({
      id: `cust_${row.phone}`,
      phone: row.phone,
      name: row.name || "عميل",
      email: row.email || null,
      city: row.city || null,
      governorate: row.governorate || null,
      orderCount: Number(row.orderCount),
      totalValue: Number(row.totalValue || 0),
      firstOrderAt: toDate(row.firstOrderAt),
      lastOrderAt: toDate(row.lastOrderAt),
      statusBreakdown: breakdownByPhone[row.phone] || {},
      affiliate: topAffiliateByPhone[row.phone] ? affiliateById[topAffiliateByPhone[row.phone]] || null : null,
    }))

    const segRow = segmentsRow[0] || {}
    const segments = {
      all: Number(segRow.allCnt || 0),
      NEW: Number(segRow.newCnt || 0),
      DELIVERED: Number(segRow.deliveredCnt || 0),
      CANCELLED: Number(segRow.cancelledCnt || 0),
      PENDING: Number(segRow.pendingCnt || 0),
    }

    const [totals, repeat] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(DISTINCT customerPhone) AS totalCustomers, COUNT(*) AS totalOrders, SUM(total) AS totalRevenue FROM "Order"`),
      prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) AS cnt FROM (SELECT customerPhone FROM "Order" GROUP BY customerPhone HAVING COUNT(*) > 1)`),
    ])

    return NextResponse.json({
      customers,
      total,
      pages,
      summary: {
        totalCustomers: Number(totals[0]?.totalCustomers || 0),
        totalOrders: Number(totals[0]?.totalOrders || 0),
        totalRevenue: Number(totals[0]?.totalRevenue || 0),
        repeatCustomers: Number(repeat[0]?.cnt || 0),
      },
      segments,
    })
  } catch (error) {
    console.error("customers API error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
