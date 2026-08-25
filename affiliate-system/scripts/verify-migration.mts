/**
 * Phase 16 verification — SQLite vs PostgreSQL staging.
 *
 * 1. PER-ROW FINANCIAL EQUALITY: every financial field of every row compared
 *    with strict === (both engines store IEEE754 binary64 → must be identical).
 * 2. ORPHAN FK CHECK: every declared relation verified on PostgreSQL.
 * 3. TIMESTAMP SPOT CHECKS: every row's DateTime fields equal within ms.
 */
import "dotenv/config"
import { DatabaseSync } from "node:sqlite"
import path from "path"

const SQLITE_PATH = process.env.SQLITE_SOURCE ?? path.join(import.meta.dirname, "..", "prisma", "dev.db")
const PG_URL = process.env.STAGING_DATABASE_URL
if (!PG_URL?.startsWith("postgresql://")) {
  console.error("STAGING_DATABASE_URL required"); process.exit(1)
}
const { PrismaClient } = await import("../src/generated/prisma/client")
const pg = new PrismaClient({ datasources: { db: { url: PG_URL } } })
const lite = new DatabaseSync(`file:${SQLITE_PATH}?mode=ro`, { open: true })

let mismatches = 0

function fail(msg: string) { mismatches++; console.error("MISMATCH: " + msg) }

/** Compare one financial column across ALL rows, keyed by id, exact ===. */

async function fetchPg(table: string, fields: string[], key = "id") {
  const rows = await pg.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT "${key}", ${fields.map((f) => `"${f}"`).join(",")} FROM "${table}"`)
  const map = new Map<string, Record<string, unknown>>()
  for (const r of rows) map.set(String(r[key]), r)
  return map
}

async function compareTable(table: string, fields: string[], dateFields: string[] = []) {
  const src = lite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]
  const dstMap = await fetchPg(table, [...fields, ...dateFields])
  let checked = 0
  for (const s of src) {
    const key = String(s.id ?? s.key)
    const d = dstMap.get(key)
    if (!d) { fail(`${table}[${key}] missing in PG`); continue }
    for (const f of fields) {
      if (s[f] !== d[f]) fail(`${table}[${key}].${f}: sqlite=${String(s[f])} pg=${String(d[f])}`)
    }
    for (const f of dateFields) {
      const sv = s[f] === null ? null : toDate(s[f])
      const dv = d[f] instanceof Date ? d[f].getTime() : d[f]
      const svMs = sv === null ? null : sv.getTime()
      if (svMs !== dv) fail(`${table}[${key}].${f}(datetime): sqlite=${sv?.toISOString()} pg=${String(d[f])}`)
    }
    checked++
  }
  console.log(`compare ${table}: ${checked} rows OK`)
}

function toDate(v: unknown): Date {
  if (typeof v === "number") return new Date(v)
  if (typeof v === "bigint") return new Date(Number(v))
  const s = String(v).trim()
  const n = Number(s)
  if (s !== "" && Number.isFinite(n)) return new Date(n)
  const normalized = s.includes("T") ? s : s.replace(" ", "T")
  return new Date(normalized.endsWith("Z") ? normalized : normalized + "Z")
}

const FINANCIAL: [string, string[], string[]][] = [
  ["User", ["balance", "totalEarnings", "commissionRate"], ["lastLogin"]],
  ["Order", ["subtotal", "shippingCost", "discount", "total"], ["createdAt", "deliveredAt", "cancelledAt", "collectedAt", "confirmationDeadline", "confirmedAt"]],
  ["OrderItem", ["unitPrice", "total"], []],
  ["CommissionLog", ["amount"], ["createdAt"]],
  ["Withdrawal", ["amount"], ["processedAt"]],
  ["BonusLedger", ["amount"], ["paidAt"]],
  ["IncentiveReward", ["amount", "threshold"], []],
]

const ORPHANS: [string, string, string][] = [
  ["Order", "affiliateId", "User"],
  ["Order", "reviewerId", "User"],
  ["Order", "confirmedById", "User"],
  ["OrderItem", "orderId", "Order"],
  ["OrderItem", "productId", "Product"],
  ["CommissionLog", "userId", "User"],
  ["Withdrawal", "userId", "User"],
  ["Notification", "userId", "User"],
  ["Favorite", "userId", "User"],
  ["Favorite", "productId", "Product"],
  ["BonusLedger", "referralId", "SupplierReferral"],
  ["BonusLedger", "affiliateId", "User"],
  ["IncentiveTarget", "campaignId", "IncentiveCampaign"],
  ["IncentiveTarget", "affiliateId", "User"],
  ["IncentiveReward", "campaignId", "IncentiveCampaign"],
  ["IncentiveReward", "affiliateId", "User"],
  ["WebhookDelivery", "webhookId", "Webhook"],
  ["Product", "categoryId", "Category"],
  ["Product", "supplierReferralId", "SupplierReferral"],
  ["Shipment", "orderId", "Order"],
  ["Shipment", "providerId", "ShippingProvider"],
  ["StockRefillRequest", "productId", "Product"],
  ["StockRefillRequest", "affiliateId", "User"],
  ["StockLog", "productId", "Product"],
  ["StockLog", "requestId", "StockRefillRequest"],
  ["ConfirmationAttempt", "orderId", "Order"],
  ["OrderComment", "orderId", "Order"],
  ["OrderComment", "userId", "User"],
  ["OrderImage", "orderId", "Order"],
  ["MarketingStrategy", "userId", "User"],
  ["MarketingStrategy", "productId", "Product"],
  ["ProductSuggestion", "userId", "User"],
  ["AdminActivity", "userId", "User"],
  ["SupplierReferralEvent", "referralId", "SupplierReferral"],
  ["Category", "parentId", "Category"],
]

async function main() {
  console.log("── Financial per-row comparison ──")
  for (const [t, f, df] of FINANCIAL) await compareTable(t, f, df)

  console.log("\n── Orphan foreign keys (PostgreSQL) ──")
  let orphanTotal = 0
  for (const [child, fk, parent] of ORPHANS) {
    const res = await pg.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*)::bigint AS n FROM "${child}" c LEFT JOIN "${parent}" p ON c."${fk}" = p."id" WHERE c."${fk}" IS NOT NULL AND p."id" IS NULL`,
    )
    const n = Number(res[0]?.n ?? 0)
    if (n > 0) { orphanTotal += n; fail(`orphan ${child}.${fk} → ${parent}: ${n}`) }
  }
  console.log(`orphan total: ${orphanTotal}`)

  console.log("\n── JSON-as-String integrity spot check ──")
  await compareTable("User", ["permissions"])
  await compareTable("Product", ["images", "lockedToAffiliates"])

  console.log(mismatches === 0 ? "\nVERIFICATION PASSED — zero mismatches" : `\nFAILED with ${mismatches} mismatch(es)`)
  await pg.$disconnect()
  process.exit(mismatches === 0 ? 0 : 1)
}

main().catch(async (e) => { console.error(e); await pg.$disconnect(); process.exit(1) })
