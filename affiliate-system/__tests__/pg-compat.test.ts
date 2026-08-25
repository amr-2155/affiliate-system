import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { join } from "path"
import { setupTestDatabase } from "./setup-db"
import type { PrismaClient } from "../src/generated/prisma/client"
import type * as Incentives from "../src/lib/incentives"

const DB_PATH = join(__dirname, "test-pgcompat.db")

let prisma: PrismaClient
let claimMilestone: typeof Incentives.claimMilestone

function uid() {
  return "p-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)
}

// ─── Pure units: search mode selection ────────────────────────────────────────

describe("textMatch (PG/SQLite case-sensitivity bridge)", () => {
  // Import lazily so we can flip DATABASE_URL between assertions
  let textMatch: typeof import("../src/lib/text-search").textMatch
  before(async () => {
    ;({ textMatch } = await import("../src/lib/text-search"))
  })

  it("SQLite (file:) → contains only — preserves today's behavior", async () => {
    process.env.DATABASE_URL = "file:C:/some/path/dev.db"
    assert.deepEqual(textMatch("Ali"), { contains: "Ali" })
    assert.deepEqual(textMatch(""), { contains: "" })
  })

  it("PostgreSQL URL → explicit mode:insensitive (ILIKE)", async () => {
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db?schema=public"
    assert.deepEqual(textMatch("Ali"), { contains: "Ali", mode: "insensitive" })
  })

  it("Arabic query passes through unchanged on both engines (no case mapping)", async () => {
    const ar = "محمد"
    process.env.DATABASE_URL = "file:x.db"
    const sqliteRes = textMatch(ar)
    process.env.DATABASE_URL = "postgresql://u:p@h/db"
    const pgRes = textMatch(ar)
    assert.equal(pgRes.contains, sqliteRes.contains)
    assert.equal(pgRes.contains, ar)
  })

  it("missing/unset DATABASE_URL defaults to SQLite semantics", async () => {
    delete process.env.DATABASE_URL
    assert.deepEqual(textMatch("x"), { contains: "x" })
  })

  after(() => {
    // restore project default for any later suites in this process
    process.env.DATABASE_URL = "file:" + DB_PATH
  })
})

// ─── Pure units: raw value normalization ─────────────────────────────────────

describe("raw-dates normalization (SQLite epoch vs PG Date)", () => {
  let rawDateToIso: typeof import("../src/lib/raw-dates").rawDateToIso
  let rawNumber: typeof import("../src/lib/raw-dates").rawNumber
  before(async () => {
    ;({ rawDateToIso, rawNumber } = await import("../src/lib/raw-dates"))
  })

  it("epoch-ms number → ISO (SQLite shape)", () => {
    assert.equal(rawDateToIso(1750000000000), new Date(1750000000000).toISOString())
  })

  it("JS Date → ISO (PostgreSQL shape) — NOT assumed to be a number", () => {
    const d = new Date("2026-01-15T10:00:00Z")
    assert.equal(rawDateToIso(d), d.toISOString())
  })

  it("ISO string and bigint pass through", () => {
    assert.equal(rawDateToIso("2026-03-01T00:00:00.000Z"), "2026-03-01T00:00:00.000Z")
    assert.equal(rawDateToIso(BigInt(1750000000000)), new Date(1750000000000).toISOString())
  })

  it("null / empty / garbage → null without throwing", () => {
    assert.equal(rawDateToIso(null), null)
    assert.equal(rawDateToIso(undefined), null)
    assert.equal(rawDateToIso(""), null)
    assert.equal(rawDateToIso("not-a-date"), null)
  })

  it("rawNumber coerces PG bigint COUNT() and SQLite numbers identically", () => {
    assert.equal(rawNumber(BigInt(7)), 7)
    assert.equal(rawNumber(7), 7)
    assert.equal(rawNumber("3"), 3)
    assert.equal(rawNumber(null), 0)
    assert.equal(rawNumber(undefined, 5), 5)
  })
})

// ─── Pure units: Cairo timezone contract ─────────────────────────────────────

describe("time.ts Africa/Cairo boundaries (explicit TZ contract)", () => {
  let t: typeof import("../src/lib/time")
  before(async () => {
    t = await import("../src/lib/time")
  })

  it("winter day start = UTC+2 midnight (matches legacy local math on a Cairo host)", () => {
    assert.equal(
      t.zonedStartOfDay(new Date("2026-01-15T10:00:00Z")).toISOString(),
      "2026-01-14T22:00:00.000Z",
    )
  })

  it("summer day start respects Egypt DST (UTC+3)", () => {
    // Cairo midnight of Jul 15 (UTC+3) = 2026-07-14T21:00Z
    assert.equal(
      t.zonedStartOfDay(new Date("2026-07-15T10:00:00Z")).toISOString(),
      "2026-07-14T21:00:00.000Z",
    )
  })

  it("month & year starts land on Cairo midnights", () => {
    assert.equal(
      t.zonedStartOfMonth(new Date("2026-07-15T10:00:00Z")).toISOString(),
      "2026-06-30T21:00:00.000Z",
    )
    assert.equal(
      t.zonedStartOfYear(new Date("2026-07-15T10:00:00Z")).toISOString(),
      "2025-12-31T22:00:00.000Z",
    )
  })

  it("relative month keys shift correctly across year boundary", () => {
    const ref = new Date("2026-01-15T10:00:00Z")
    assert.equal(t.zonedMonthKeyOffset(ref, -1), "2025-12")
    assert.equal(t.zonedMonthKeyOffset(ref, -11), "2025-02")
    assert.equal(t.zonedMonthKeyOffset(ref, 0), "2026-01")
  })

  it("date keys use the Cairo calendar day of the instant", () => {
    // 01:30 Cairo on Jan 15 is still Jan 15; 23:30 UTC Jan 14 (=01:30 Cairo Jan 15) too
    assert.equal(t.zonedDateKey(new Date("2026-01-14T23:30:00Z")), "2026-01-15")
  })

  it("week start returns the Monday of the Cairo calendar week", () => {
    const ws = t.zonedWeekStart(new Date("2026-07-15T10:00:00Z")) // Wed Jul 15 Cairo
    // Cairo midnight instants sit on the previous UTC day — verify via civil parts
    const p = t.zonedCivilParts(ws)
    assert.equal(`${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`, "2026-07-13")
    // Idempotent on an already-Monday boundary
    assert.equal(t.zonedWeekStart(ws).getTime(), ws.getTime())
  })
})

// ─── DB: milestone claim concurrency + deterministic aggregates ──────────────

describe("PG-compat DB behaviors", () => {
  before(async () => {
    process.env.DATABASE_URL = await setupTestDatabase("test-pgcompat.db")
    const p = await import("../src/generated/prisma/client")
    prisma = new p.PrismaClient()
    const inc = await import("../src/lib/incentives")
    claimMilestone = inc.claimMilestone
  })

  after(async () => {
    await prisma?.$disconnect()
  })

  it("claimMilestone: concurrent claims notify exactly once", async () => {
    const aff = await prisma.user.create({
      data: { name: "A", email: uid() + "@t.co", password: "x", role: "AFFILIATE", status: "ACTIVE", balance: 0, totalEarnings: 0, referralCode: uid() },
    })
    const campaign = await prisma.incentiveCampaign.create({
      data: { name: "C-" + uid(), startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000) },
    })

    const results = await Promise.all([
      claimMilestone(campaign.id, aff.id, "90"),
      claimMilestone(campaign.id, aff.id, "90"),
    ])
    assert.equal(results.filter(Boolean).length, 1, "exactly one concurrent claim wins")

    // Sequential repeat must be a no-op as well
    assert.equal(await claimMilestone(campaign.id, aff.id, "90"), false)

    const target = await prisma.incentiveTarget.findUnique({
      where: { campaignId_affiliateId: { campaignId: campaign.id, affiliateId: aff.id } },
    })
    const notified = JSON.parse(target!.milestonesNotified || "[]")
    assert.deepEqual(notified, ["90"], "milestone recorded exactly once")

    // A second distinct milestone still claims fine (list append works)
    assert.equal(await claimMilestone(campaign.id, aff.id, "100"), true)
    const target2 = await prisma.incentiveTarget.findUnique({
      where: { campaignId_affiliateId: { campaignId: campaign.id, affiliateId: aff.id } },
    })
    assert.deepEqual(JSON.parse(target2!.milestonesNotified || "[]").sort(), ["100", "90"])
  })

  // Engine-scope: 8 concurrent interactive writers exceed SQLite's whole-DB
  // lock; this invariant is validated on PostgreSQL (Phase 16 staging results).
  const onSqlite = !(process.env.TEST_DATABASE_URL ?? "").startsWith("postgres")
  it("order counter: concurrent generations produce unique sequential values", { skip: onSqlite ? "requires PostgreSQL concurrent-writer capability" : false }, async () => {
    const N = 8
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        prisma.$transaction(async (tx) => {
          const c = await tx.orderCounter.upsert({
            where: { id: "main" },
            create: { id: "main", value: 1 },
            update: { value: { increment: 1 } },
          })
          return c.value as number
        }),
      ),
    )
    assert.equal(new Set(results).size, N, `all ${N} counter values must be unique under concurrency`)
    for (const v of results) assert.ok(v > 0 && Number.isInteger(v), "counter value is a positive integer")
  })
  it("groupBy aggregate tiebreak: equal sums ordered deterministically by key", async () => {
    const mkProduct = async (name: string) => {
      const cat = await prisma.category.create({ data: { name: "Cat-" + uid(), nameAr: name, slug: uid() } })
      return prisma.product.create({
        data: { name, nameAr: name, sku: uid(), slug: uid(), price: 10, costPrice: 5, stock: 100, categoryId: cat.id },
      })
    }
    const pa = await mkProduct("Prod-A")
    const pb = await mkProduct("Prod-B")

    const mkOrderFor = async (prodId: string) => {
      const aff = await prisma.user.create({
        data: { name: "U", email: uid() + "@t.co", password: "x", role: "AFFILIATE", status: "ACTIVE", balance: 0, totalEarnings: 0, referralCode: uid() },
      })
      return prisma.order.create({
        data: {
          orderNumber: uid(), status: "PENDING", subtotal: 50, shippingCost: 0, total: 50,
          customerName: "C", customerPhone: uid(), customerAddress: "A", customerCity: "X",
          affiliateId: aff.id,
          items: { create: [{ productId: prodId, quantity: 5, unitPrice: 10, total: 50 }] },
        },
      })
    }

    // Both products end with identical _sum.total = 50 → previously nondeterministic
    await mkOrderFor(pa.id)
    await mkOrderFor(pb.id)

    const groups = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { in: [pa.id, pb.id] } },
      _sum: { quantity: true, total: true },
      orderBy: [{ _sum: { total: "desc" } }, { productId: "asc" }],
    })

    assert.equal(groups.length, 2)
    assert.equal(groups[0]._sum.total, 50)
    assert.equal(groups[1]._sum.total, 50)
    // Deterministic: lexicographically smaller cuid first regardless of engine
    assert.ok(groups[0].productId < groups[1].productId, "tie broken by productId ASC")
  })
})
