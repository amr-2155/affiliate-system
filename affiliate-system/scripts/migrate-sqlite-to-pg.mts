/**
 * Phase 16 — SQLite → PostgreSQL staging data migration.
 *
 * SOURCE: prisma/dev.db read via node:sqlite (DatabaseSync) — opened READ-ONLY,
 * never written. TARGET: PostgreSQL staging via the PG-flavored Prisma client.
 *
 * Guarantees:
 * - IDs, timestamps, statuses, JSON-as-String payloads preserved verbatim
 * - Float financial values pass through as IEEE754 binary64 on both sides (bit-exact)
 * - SQLite storage quirks normalized: BOOLEAN 0/1 → true/false, epoch-ms → Date
 * - Foreign-key-safe insert order, batched createMany (500/batch)
 * - Any row failure logs {model, id, error} and STOPS (exit 1) — no silent skips
 * - Refuses to touch a non-empty target unless explicitly re-running against
 *   the confirmed disposable staging DB (host must be localhost:5433)
 */
import "dotenv/config"
import { DatabaseSync } from "node:sqlite"
import path from "path"

const SQLITE_PATH = process.env.SQLITE_SOURCE ?? path.join(import.meta.dirname, "..", "prisma", "dev.db")
const PG_URL = process.env.STAGING_DATABASE_URL
if (!PG_URL || !PG_URL.startsWith("postgresql://")) {
  console.error("STAGING_DATABASE_URL must be set to a postgresql:// URL")
  process.exit(1)
}
if (!/localhost:5433|127\.0\.0\.1:5433/.test(PG_URL)) {
  console.error("REFUSING: target does not look like the local staging database (:5433)")
  process.exit(1)
}

const { PrismaClient } = await import("../src/generated/prisma/client")
const pg = new PrismaClient({ datasources: { db: { url: PG_URL } } })

const sqlite = new DatabaseSync(`file:${SQLITE_PATH}?mode=ro`, { open: true })

// model → table (identical names), with per-column coercions.
type Col = string
interface ModelSpec {
  table: string
  order?: string // stable ordering for deterministic batches
  bools?: Col[]
  dates?: Col[]
}
const MODELS: ModelSpec[] = [
  { table: "SystemSetting", order: "key", dates: ["updatedAt"] },
  { table: "OrderCounter", order: "id" },
  { table: "ShippingRate", order: "id", dates: ["createdAt"] },
  { table: "SupplierCampaignSettings", order: "id", dates: ["updatedAt"] },
  { table: "Category", order: "id", dates: ["createdAt"] },
  { table: "ApiKey", order: "id", dates: ["lastUsedAt", "createdAt", "revokedAt"], bools: ["enabled"] },
  { table: "Webhook", order: "id", dates: ["lastDeliveryAt", "createdAt", "updatedAt"], bools: ["enabled"] },
  { table: "WebhookDelivery", order: "id", dates: ["nextRetryAt", "createdAt", "deliveredAt"] },
  { table: "ShippingProvider", order: "id", dates: ["lastTestAt", "createdAt", "updatedAt"], bools: ["enabled"] },
  { table: "User", order: "id", dates: ["lastLogin", "createdAt", "updatedAt"], bools: ["isSuperAdmin"] },
  { table: "SupplierReferral", order: "id", dates: ["activationDate", "campaignEndDate", "createdAt", "updatedAt"], bools: ["dataConfirmed", "firstQualifiedNotified", "firstBonusNotified", "endWarningNotified"] },
  { table: "SupplierReferralEvent", order: "id", dates: ["createdAt"] },
  { table: "Product", order: "id", dates: ["deletedAt", "createdAt", "updatedAt"], bools: ["isVisible", "autoAssignReviewers"] },
  { table: "ProductVariant", order: "id", dates: ["createdAt"], bools: ["isActive"] },
  { table: "ProductGalleryImage", order: "id", dates: ["createdAt"] },
  { table: "IncentiveCampaign", order: "id", dates: ["startDate", "endDate", "createdAt", "updatedAt"], bools: ["isActive"] },
  { table: "Order", order: "id", dates: ["createdAt", "updatedAt", "deliveredAt", "cancelledAt", "collectedAt", "confirmationDeadline", "assignedAt", "confirmedAt"] },
  { table: "OrderItem", order: "id" },
  { table: "OrderComment", order: "id", dates: ["createdAt"] },
  { table: "OrderImage", order: "id", dates: ["createdAt"] },
  { table: "ConfirmationAttempt", order: "id", dates: ["createdAt"] },
  { table: "Shipment", order: "id", dates: ["lastStatusAt", "createdAt", "updatedAt"] },
  { table: "CommissionLog", order: "id", dates: ["createdAt"] },
  { table: "Withdrawal", order: "id", dates: ["processedAt", "createdAt"] },
  { table: "Notification", order: "id", dates: ["createdAt"], bools: ["read"] },
  { table: "Favorite", order: "id", dates: ["createdAt"] },
  { table: "ProductSuggestion", order: "id", dates: ["createdAt"] },
  { table: "MarketingStrategy", order: "id", dates: ["createdAt", "updatedAt"] },
  { table: "StockRefillRequest", order: "id", dates: ["processedAt", "createdAt", "updatedAt"] },
  { table: "StockLog", order: "id", dates: ["createdAt"] },
  { table: "IncentiveTarget", order: "id", dates: ["joinedAt"] },
  { table: "IncentiveReward", order: "id", dates: ["reviewedAt", "paidAt", "processedAt", "createdAt", "updatedAt"] },
  { table: "AdminActivity", order: "id", dates: ["createdAt"] },
  { table: "BonusLedger", order: "id", dates: ["paidAt", "createdAt"] },
]

function coerce(row: Record<string, unknown>, spec: ModelSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (spec.bools?.includes(k)) {
      out[k] = v === null || v === undefined ? null : Number(v) !== 0
    } else if (spec.dates?.includes(k)) {
      out[k] = v === null || v === undefined ? null : new Date(Number(v))
    } else {
      out[k] = v
    }
  }
  return out
}

async function rowCount(table: string): Promise<number> {
  const res = await pg.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM "${table}"`)
  return Number(res[0]?.n ?? 0)
}

async function main() {
  const failures: { model: string; id: string; error: string }[] = []
  const report: { model: string; sqlite: number; pg: number }[] = []

  for (const spec of MODELS) {
    const srcRows = sqlite.prepare(`SELECT * FROM "${spec.table}"${spec.order ? ` ORDER BY ${spec.order}` : ""}`).all() as Record<string, unknown>[]
    const existing = await rowCount(spec.table)
    if (existing > 0) {
      const allowTruncate = process.env.ALLOW_TRUNCATE_STAGING === "1"
      if (!allowTruncate) {
        console.error(`REFUSING: ${spec.table} already has ${existing} rows. Set ALLOW_TRUNCATE_STAGING=1 to reseed staging.`)
        process.exit(1)
      }
      await pg.$executeRawUnsafe(`TRUNCATE TABLE "${spec.table}" CASCADE`)
    }

    let inserted = 0
    const BATCH = 500
    for (let i = 0; i < srcRows.length; i += BATCH) {
      const chunk = srcRows.slice(i, i + BATCH).map((r) => coerce(r, spec))
      if (chunk.length === 0) continue
      try {
        await (pg as any)[spec.table].createMany({ data: chunk })
        inserted += chunk.length
      } catch (e) {
        // Fall back to row-by-row so we can attribute the failing ID precisely,
        // then STOP — partial model loads risk referential inconsistency downstream.
        for (const row of chunk) {
          try {
            await (pg as any)[spec.table].create({ data: row })
            inserted++
          } catch (rowErr) {
            failures.push({
              model: spec.table,
              id: String((row as any).id ?? "(composite)"),
              error: rowErr instanceof Error ? rowErr.message.slice(0, 300) : String(rowErr),
            })
          }
        }
        if (failures.length > 0) break
      }
    }

    report.push({ model: spec.table, sqlite: srcRows.length, pg: inserted })
    console.log(`${spec.table}: sqlite=${srcRows.length} pg=${inserted}`)
    if (failures.length > 0) break
  }

  if (failures.length > 0) {
    console.error("\nMIGRATION FAILED — failing records:")
    for (const f of failures) console.error(JSON.stringify(f))
    await pg.$disconnect()
    process.exit(1)
  }

  const bad = report.filter((r) => r.sqlite !== r.pg)
  if (bad.length > 0) {
    console.error("\nCOUNT MISMATCH:")
    for (const b of bad) console.error(JSON.stringify(b))
    await pg.$disconnect()
    process.exit(1)
  }

  console.log("\nALL MODELS MIGRATED — counts match.")
  await pg.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await pg.$disconnect()
  process.exit(1)
})
