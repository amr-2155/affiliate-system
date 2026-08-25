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
import { Prisma } from "../src/generated/prisma/client"
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
  { table: "ShippingRate", order: "id", dates: ["createdAt"], bools: ["isActive"] },
  { table: "SupplierCampaignSettings", order: "id", dates: ["updatedAt"], bools: ["enabled", "includeCollected", "durationStartFromActivation"] },
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

/**
 * DateTime coercion for the three shapes found in dev.db:
 * 1. INTEGER epoch-ms   (Prisma default)            → new Date(n)
 * 2. TEXT numeric       (rare legacy writes)        → new Date(Number)
 * 3. TEXT "YYYY-MM-DD HH:MM:SS" (non-Prisma seeds)  → parsed as UTC (documented:
 *    affects only 3 SystemSetting.updatedAt metadata fields; setting VALUES
 *    untouched). Throws on anything unparseable so failures are loud.
 */
function toDateValue(v: unknown): Date {
  if (typeof v === "number") return new Date(v)
  if (typeof v === "bigint") return new Date(Number(v))
  const s = String(v).trim()
  const n = Number(s)
  if (s !== "" && Number.isFinite(n)) return new Date(n)
  const normalized = s.includes("T") ? s : s.replace(" ", "T")
  const d = new Date(normalized.endsWith("Z") ? normalized : normalized + "Z")
  if (isNaN(d.getTime())) throw new Error(`Unparseable datetime value: ${JSON.stringify(String(v))}`)
  return d
}

function coerce(row: Record<string, unknown>, spec: ModelSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (spec.bools?.includes(k)) {
      out[k] = v === null || v === undefined ? null : Number(v) !== 0
    } else if (spec.dates?.includes(k)) {
      out[k] = v === null || v === undefined ? null : toDateValue(v)
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

/** Fully-typed per-model insert dispatch (explicit allowlist, no dynamic any). */
async function insertBatch(table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (table === "SystemSetting") {
    await pg.systemSetting.createMany({ data: rows as never as Prisma.SystemSettingCreateManyInput[] })
  } else if (table === "OrderCounter") {
    await pg.orderCounter.createMany({ data: rows as never as Prisma.OrderCounterCreateManyInput[] })
  } else if (table === "ShippingRate") {
    await pg.shippingRate.createMany({ data: rows as never as Prisma.ShippingRateCreateManyInput[] })
  } else if (table === "SupplierCampaignSettings") {
    await pg.supplierCampaignSettings.createMany({ data: rows as never as Prisma.SupplierCampaignSettingsCreateManyInput[] })
  } else if (table === "Category") {
    await pg.category.createMany({ data: rows as never as Prisma.CategoryCreateManyInput[] })
  } else if (table === "ApiKey") {
    await pg.apiKey.createMany({ data: rows as never as Prisma.ApiKeyCreateManyInput[] })
  } else if (table === "Webhook") {
    await pg.webhook.createMany({ data: rows as never as Prisma.WebhookCreateManyInput[] })
  } else if (table === "WebhookDelivery") {
    await pg.webhookDelivery.createMany({ data: rows as never as Prisma.WebhookDeliveryCreateManyInput[] })
  } else if (table === "ShippingProvider") {
    await pg.shippingProvider.createMany({ data: rows as never as Prisma.ShippingProviderCreateManyInput[] })
  } else if (table === "User") {
    await pg.user.createMany({ data: rows as never as Prisma.UserCreateManyInput[] })
  } else if (table === "SupplierReferral") {
    await pg.supplierReferral.createMany({ data: rows as never as Prisma.SupplierReferralCreateManyInput[] })
  } else if (table === "SupplierReferralEvent") {
    await pg.supplierReferralEvent.createMany({ data: rows as never as Prisma.SupplierReferralEventCreateManyInput[] })
  } else if (table === "Product") {
    await pg.product.createMany({ data: rows as never as Prisma.ProductCreateManyInput[] })
  } else if (table === "ProductVariant") {
    await pg.productVariant.createMany({ data: rows as never as Prisma.ProductVariantCreateManyInput[] })
  } else if (table === "ProductGalleryImage") {
    await pg.productGalleryImage.createMany({ data: rows as never as Prisma.ProductGalleryImageCreateManyInput[] })
  } else if (table === "IncentiveCampaign") {
    await pg.incentiveCampaign.createMany({ data: rows as never as Prisma.IncentiveCampaignCreateManyInput[] })
  } else if (table === "Order") {
    await pg.order.createMany({ data: rows as never as Prisma.OrderCreateManyInput[] })
  } else if (table === "OrderItem") {
    await pg.orderItem.createMany({ data: rows as never as Prisma.OrderItemCreateManyInput[] })
  } else if (table === "OrderComment") {
    await pg.orderComment.createMany({ data: rows as never as Prisma.OrderCommentCreateManyInput[] })
  } else if (table === "OrderImage") {
    await pg.orderImage.createMany({ data: rows as never as Prisma.OrderImageCreateManyInput[] })
  } else if (table === "ConfirmationAttempt") {
    await pg.confirmationAttempt.createMany({ data: rows as never as Prisma.ConfirmationAttemptCreateManyInput[] })
  } else if (table === "Shipment") {
    await pg.shipment.createMany({ data: rows as never as Prisma.ShipmentCreateManyInput[] })
  } else if (table === "CommissionLog") {
    await pg.commissionLog.createMany({ data: rows as never as Prisma.CommissionLogCreateManyInput[] })
  } else if (table === "Withdrawal") {
    await pg.withdrawal.createMany({ data: rows as never as Prisma.WithdrawalCreateManyInput[] })
  } else if (table === "Notification") {
    await pg.notification.createMany({ data: rows as never as Prisma.NotificationCreateManyInput[] })
  } else if (table === "Favorite") {
    await pg.favorite.createMany({ data: rows as never as Prisma.FavoriteCreateManyInput[] })
  } else if (table === "ProductSuggestion") {
    await pg.productSuggestion.createMany({ data: rows as never as Prisma.ProductSuggestionCreateManyInput[] })
  } else if (table === "MarketingStrategy") {
    await pg.marketingStrategy.createMany({ data: rows as never as Prisma.MarketingStrategyCreateManyInput[] })
  } else if (table === "StockRefillRequest") {
    await pg.stockRefillRequest.createMany({ data: rows as never as Prisma.StockRefillRequestCreateManyInput[] })
  } else if (table === "StockLog") {
    await pg.stockLog.createMany({ data: rows as never as Prisma.StockLogCreateManyInput[] })
  } else if (table === "IncentiveTarget") {
    await pg.incentiveTarget.createMany({ data: rows as never as Prisma.IncentiveTargetCreateManyInput[] })
  } else if (table === "IncentiveReward") {
    await pg.incentiveReward.createMany({ data: rows as never as Prisma.IncentiveRewardCreateManyInput[] })
  } else if (table === "AdminActivity") {
    await pg.adminActivity.createMany({ data: rows as never as Prisma.AdminActivityCreateManyInput[] })
  } else if (table === "BonusLedger") {
    await pg.bonusLedger.createMany({ data: rows as never as Prisma.BonusLedgerCreateManyInput[] })
  } else {
    throw new Error(`No delegate allowlisted for table ${table}`)
  }
}

async function insertOne(table: string, row: Record<string, unknown>): Promise<void> {
  if (table === "SystemSetting") {
    await pg.systemSetting.create({ data: row as never as Prisma.SystemSettingCreateInput })
  } else if (table === "OrderCounter") {
    await pg.orderCounter.create({ data: row as never as Prisma.OrderCounterCreateInput })
  } else if (table === "ShippingRate") {
    await pg.shippingRate.create({ data: row as never as Prisma.ShippingRateCreateInput })
  } else if (table === "SupplierCampaignSettings") {
    await pg.supplierCampaignSettings.create({ data: row as never as Prisma.SupplierCampaignSettingsCreateInput })
  } else if (table === "Category") {
    await pg.category.create({ data: row as never as Prisma.CategoryCreateInput })
  } else if (table === "ApiKey") {
    await pg.apiKey.create({ data: row as never as Prisma.ApiKeyCreateInput })
  } else if (table === "Webhook") {
    await pg.webhook.create({ data: row as never as Prisma.WebhookCreateInput })
  } else if (table === "WebhookDelivery") {
    await pg.webhookDelivery.create({ data: row as never as Prisma.WebhookDeliveryCreateInput })
  } else if (table === "ShippingProvider") {
    await pg.shippingProvider.create({ data: row as never as Prisma.ShippingProviderCreateInput })
  } else if (table === "User") {
    await pg.user.create({ data: row as never as Prisma.UserCreateInput })
  } else if (table === "SupplierReferral") {
    await pg.supplierReferral.create({ data: row as never as Prisma.SupplierReferralCreateInput })
  } else if (table === "SupplierReferralEvent") {
    await pg.supplierReferralEvent.create({ data: row as never as Prisma.SupplierReferralEventCreateInput })
  } else if (table === "Product") {
    await pg.product.create({ data: row as never as Prisma.ProductCreateInput })
  } else if (table === "ProductVariant") {
    await pg.productVariant.create({ data: row as never as Prisma.ProductVariantCreateInput })
  } else if (table === "ProductGalleryImage") {
    await pg.productGalleryImage.create({ data: row as never as Prisma.ProductGalleryImageCreateInput })
  } else if (table === "IncentiveCampaign") {
    await pg.incentiveCampaign.create({ data: row as never as Prisma.IncentiveCampaignCreateInput })
  } else if (table === "Order") {
    await pg.order.create({ data: row as never as Prisma.OrderCreateInput })
  } else if (table === "OrderItem") {
    await pg.orderItem.create({ data: row as never as Prisma.OrderItemCreateInput })
  } else if (table === "OrderComment") {
    await pg.orderComment.create({ data: row as never as Prisma.OrderCommentCreateInput })
  } else if (table === "OrderImage") {
    await pg.orderImage.create({ data: row as never as Prisma.OrderImageCreateInput })
  } else if (table === "ConfirmationAttempt") {
    await pg.confirmationAttempt.create({ data: row as never as Prisma.ConfirmationAttemptCreateInput })
  } else if (table === "Shipment") {
    await pg.shipment.create({ data: row as never as Prisma.ShipmentCreateInput })
  } else if (table === "CommissionLog") {
    await pg.commissionLog.create({ data: row as never as Prisma.CommissionLogCreateInput })
  } else if (table === "Withdrawal") {
    await pg.withdrawal.create({ data: row as never as Prisma.WithdrawalCreateInput })
  } else if (table === "Notification") {
    await pg.notification.create({ data: row as never as Prisma.NotificationCreateInput })
  } else if (table === "Favorite") {
    await pg.favorite.create({ data: row as never as Prisma.FavoriteCreateInput })
  } else if (table === "ProductSuggestion") {
    await pg.productSuggestion.create({ data: row as never as Prisma.ProductSuggestionCreateInput })
  } else if (table === "MarketingStrategy") {
    await pg.marketingStrategy.create({ data: row as never as Prisma.MarketingStrategyCreateInput })
  } else if (table === "StockRefillRequest") {
    await pg.stockRefillRequest.create({ data: row as never as Prisma.StockRefillRequestCreateInput })
  } else if (table === "StockLog") {
    await pg.stockLog.create({ data: row as never as Prisma.StockLogCreateInput })
  } else if (table === "IncentiveTarget") {
    await pg.incentiveTarget.create({ data: row as never as Prisma.IncentiveTargetCreateInput })
  } else if (table === "IncentiveReward") {
    await pg.incentiveReward.create({ data: row as never as Prisma.IncentiveRewardCreateInput })
  } else if (table === "AdminActivity") {
    await pg.adminActivity.create({ data: row as never as Prisma.AdminActivityCreateInput })
  } else if (table === "BonusLedger") {
    await pg.bonusLedger.create({ data: row as never as Prisma.BonusLedgerCreateInput })
  } else {
    throw new Error(`No delegate allowlisted for table ${table}`)
  }
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
        await insertBatch(spec.table, chunk)
        inserted += chunk.length
      } catch (e) {
        // Fall back to row-by-row so we can attribute the failing ID precisely,
        // then STOP — partial model loads risk referential inconsistency downstream.
        for (const row of chunk) {
          try {
            await insertOne(spec.table, row)
            inserted++
          } catch (rowErr) {
            const rowId = typeof row.id === "string" || typeof row.id === "number" ? String(row.id) : null
            const rowKey = typeof row.key === "string" ? row.key : null
            failures.push({
              model: spec.table,
              id: rowId ?? rowKey ?? JSON.stringify(row).slice(0, 120),
              error: rowErr instanceof Error ? rowErr.message : String(rowErr),
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
