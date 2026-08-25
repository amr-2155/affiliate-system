import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { join } from "path"
import { setupTestDatabase } from "./setup-db"
import type { PrismaClient, IncentiveReward } from "../src/generated/prisma/client"
import type * as OrderService from "../src/lib/order-service"

const DB_PATH = join(__dirname, "test-concurrency.db")

let prisma: PrismaClient
let runTransition: typeof OrderService.applyOrderTransition
let OrderStateErrorT: typeof OrderService.OrderStateError

function uid() {
  return "c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)
}

async function mkAff(o: { balance?: number; totalEarnings?: number } = {}) {
  return prisma.user.create({
    data: { name: "A", email: uid() + "@t.co", password: "x", role: "AFFILIATE", status: "ACTIVE", balance: 0, totalEarnings: 0, referralCode: uid(), ...o },
  })
}

async function mkProd() {
  const cat = await prisma.category.create({ data: { name: "Cat-" + uid(), nameAr: "اختبار", slug: uid() } })
  return prisma.product.create({
    data: { name: "P", nameAr: "P", sku: uid(), slug: uid(), price: 500, minPrice: null, costPrice: 200, affiliateCostPrice: 300, stock: 100, categoryId: cat.id },
  })
}

async function mkOrderWithCommission(affId: string) {
  const prod = await mkProd()
  return prisma.order.create({
    data: {
      orderNumber: uid(),
      status: "PENDING",
      subtotal: 400,
      shippingCost: 50,
      total: 450,
      customerName: "C",
      customerPhone: "0",
      customerAddress: "A",
      customerCity: "X",
      affiliateId: affId,
      items: { create: [{ productId: prod.id, quantity: 1, unitPrice: 400, total: 400 }] },
    },
  })
}

async function addCommission(orderId: string, userId: string, amount: number) {
  await prisma.commissionLog.create({ data: { amount, orderId, userId } })
}

/** Exact transaction body used by src/app/api/admin/incentives/rewards/[rewardId]/route.ts */
async function payRewardGate(reward: IncentiveReward): Promise<"PAID" | "ALREADY_PAID"> {
  try {
    await prisma.$transaction(async (tx) => {
      const gate = await tx.incentiveReward.updateMany({
        where: { id: reward.id, status: { not: "PAID" } },
        data: { status: "PAID", paidAt: new Date(), processedAt: new Date() },
      })
      if (gate.count === 0) throw new Error("ALREADY_PAID")
      await tx.user.update({
        where: { id: reward.affiliateId },
        data: { balance: { increment: reward.amount }, totalEarnings: { increment: reward.amount } },
      })
    })
    return "PAID"
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_PAID") return "ALREADY_PAID"
    throw e
  }
}

/** Exact transaction body used by src/app/api/withdrawals/route.ts */
async function withdrawGate(userId: string, amount: number): Promise<"OK" | "INSUFFICIENT_BALANCE"> {
  try {
    await prisma.$transaction(async (tx) => {
      const gate = await tx.user.updateMany({
        where: { id: userId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      })
      if (gate.count === 0) throw new Error("INSUFFICIENT_BALANCE")
      await tx.withdrawal.create({ data: { amount, method: "BANK", userId } })
    })
    return "OK"
  } catch (e) {
    if (e instanceof Error && e.message === "INSUFFICIENT_BALANCE") return "INSUFFICIENT_BALANCE"
    throw e
  }
}

describe("Financial Concurrency (Phase 14 fixes)", () => {
  before(async () => {
    process.env.DATABASE_URL = await setupTestDatabase("test-concurrency.db")
    const p = await import("../src/generated/prisma/client")
    prisma = new p.PrismaClient()
    // Real production primitive used by the fixed batch route
    const svc = await import("../src/lib/order-service")
    runTransition = svc.applyOrderTransition
    OrderStateErrorT = svc.OrderStateError
  })

  after(async () => {
    await prisma?.$disconnect()
  })

  describe("Batch commission atomicity (applyOrderTransition)", () => {
    it("COLLECTED credits exactly once; repeated transition is a no-op", async () => {
      const aff = await mkAff()
      const order = await mkOrderWithCommission(aff.id)
      await addCommission(order.id, aff.id, 50)

      const t1 = await runTransition({ orderId: order.id, to: "COLLECTED", source: "batch" })
      assert.equal(t1.commissionCredited, 50)

      let u = await prisma.user.findUnique({ where: { id: aff.id } })
      assert.equal(u!.balance, 50)
      assert.equal(u!.totalEarnings, 50)

      // Repeated COLLECTED → COLLECTED must NOT double-credit
      const t2 = await runTransition({ orderId: order.id, to: "COLLECTED", source: "batch" })
      assert.equal(t2.commissionCredited, 0)

      u = await prisma.user.findUnique({ where: { id: aff.id } })
      assert.equal(u!.balance, 50, "No double credit")
      assert.equal(u!.totalEarnings, 50, "No double credit")
    })

    it("Leaving COLLECTED reverses exactly once; debt (negative balance) is documented behavior", async () => {
      const aff = await mkAff()
      const order = await mkOrderWithCommission(aff.id)
      await addCommission(order.id, aff.id, 80)

      await runTransition({ orderId: order.id, to: "COLLECTED", source: "batch" })
      let u = await prisma.user.findUnique({ where: { id: aff.id } })
      assert.equal(u!.balance, 80)

      // Affiliate withdraws everything (simulated)
      await prisma.user.update({ where: { id: aff.id }, data: { balance: { decrement: 80 } } })

      // Order reversed after payout → affiliate owes money (debt). The state
      // transition MUST complete; balance may legitimately go negative.
      const t = await runTransition({ orderId: order.id, to: "CANCELLED", source: "batch" })
      assert.equal(t.commissionRevoked, 80)

      u = await prisma.user.findUnique({ where: { id: aff.id } })
      assert.equal(u!.balance, -80, "Negative balance = tracked debt")
      assert.equal(u!.totalEarnings, 0, "totalEarnings decremented once")

      // CANCELLED is terminal → revoke can NEVER run twice
      await assert.rejects(
        () => runTransition({ orderId: order.id, to: "PENDING", source: "batch" }),
        OrderStateErrorT,
      )
      u = await prisma.user.findUnique({ where: { id: aff.id } })
      assert.equal(u!.balance, -80, "No double reversal from terminal state")
    })

    it("Concurrent duplicate PENDING→COLLECTED: exactly one credit wins", async () => {
      const aff = await mkAff()
      const order = await mkOrderWithCommission(aff.id)
      await addCommission(order.id, aff.id, 30)

      const results = await Promise.allSettled([
        runTransition({ orderId: order.id, to: "COLLECTED", source: "batch" }),
        runTransition({ orderId: order.id, to: "COLLECTED", source: "batch" }),
      ])

      // Regardless of which one wins/loses, the financial invariant holds:
      const u = await prisma.user.findUnique({ where: { id: aff.id } })
      assert.equal(u!.balance, 30, "Balance credited exactly once despite race")
      assert.equal(u!.totalEarnings, 30)

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ commissionCredited: number }>[]
      const creditedSum = fulfilled.reduce((s, r) => s + r.value.commissionCredited, 0)
      assert.ok(creditedSum <= 30, "At most one request may report a credit")

      const o = await prisma.order.findUnique({ where: { id: order.id } })
      assert.equal(o!.status, "COLLECTED")
      assert.equal(o!.paymentStatus, "PAID", "paymentStatus kept consistent with credit")
    })

    it("Batch of mixed orders: each order credited/reversed independently", async () => {
      const aff1 = await mkAff()
      const aff2 = await mkAff()
      const o1 = await mkOrderWithCommission(aff1.id)
      const o2 = await mkOrderWithCommission(aff2.id)
      await addCommission(o1.id, aff1.id, 10)
      await addCommission(o2.id, aff2.id, 20)

      // Simulates the fixed batch loop: per-order atomic transitions
      const ids = [o1.id, o2.id]
      for (const id of ids) {
        await runTransition({ orderId: id, to: "DELIVERED", source: "batch" })
      }
      for (const id of ids) {
        await runTransition({ orderId: id, to: "COLLECTED", source: "batch" })
      }

      const u1 = await prisma.user.findUnique({ where: { id: aff1.id } })
      const u2 = await prisma.user.findUnique({ where: { id: aff2.id } })
      assert.equal(u1!.balance, 10, "Order 1 credited its own commission only")
      assert.equal(u2!.balance, 20, "Order 2 credited its own commission only")

      // Reverse o2 only — o1 untouched
      await runTransition({ orderId: o2.id, to: "REJECTED", source: "batch" })
      const u2b = await prisma.user.findUnique({ where: { id: aff2.id } })
      const u1b = await prisma.user.findUnique({ where: { id: aff1.id } })
      assert.equal(u2b!.balance, 0, "Reversal scoped to its order")
      assert.equal(u1b!.balance, 10, "Other affiliate unaffected")
    })
  })

  describe("Incentive reward double-pay", () => {
    async function mkReward(amount: number) {
      const aff = await mkAff()
      const campaign = await prisma.incentiveCampaign.create({
        data: { name: "Camp-" + uid(), startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 86400000) },
      })
      return prisma.incentiveReward.create({
        data: { campaignId: campaign.id, affiliateId: aff.id, threshold: 5, amount, levelIndex: 0 },
      })
    }

    it("Repeated approval pays exactly once (second is a no-op)", async () => {
      const reward = await mkReward(25)

      const r1 = await payRewardGate(reward)
      assert.equal(r1, "PAID")

      const r2 = await payRewardGate(reward)
      assert.equal(r2, "ALREADY_PAID", "Second approval must be rejected")

      const u = await prisma.user.findUnique({ where: { id: reward.affiliateId } })
      assert.equal(u!.balance, 25, "Paid exactly once")
      assert.equal(u!.totalEarnings, 25)

      const fresh = await prisma.incentiveReward.findUnique({ where: { id: reward.id } })
      assert.equal(fresh!.status, "PAID")
      assert.ok(fresh!.paidAt, "paidAt set once")
    })

    it("Two simultaneous approvals: exactly one payment lands", async () => {
      const reward = await mkReward(40)

      const results = await Promise.all([payRewardGate(reward), payRewardGate(reward)])
      const paidCount = results.filter((r) => r === "PAID").length
      assert.equal(paidCount, 1, "Exactly one concurrent approval succeeded")

      const u = await prisma.user.findUnique({ where: { id: reward.affiliateId } })
      assert.equal(u!.balance, 40, "Single payment only")
      assert.equal(u!.totalEarnings, 40)

      const count = await prisma.incentiveReward.count({
        where: { id: reward.id, status: "PAID" },
      })
      assert.equal(count, 1, "Reward status consistent — no duplicate ledger entry possible")
    })
  })

  describe("Withdrawal atomic conditional decrement", () => {
    it("Overdraft blocked atomically with zero mutation", async () => {
      const aff = await mkAff({ balance: 100, totalEarnings: 100 })

      const r = await withdrawGate(aff.id, 150)
      assert.equal(r, "INSUFFICIENT_BALANCE")

      const u = await prisma.user.findUnique({ where: { id: aff.id } })
      assert.equal(u!.balance, 100, "Balance unchanged on failure")
      const w = await prisma.withdrawal.count({ where: { userId: aff.id } })
      assert.equal(w, 0, "No withdrawal row created on failure")
    })

    it("Exact-balance withdrawal succeeds (gte boundary)", async () => {
      const aff = await mkAff({ balance: 100, totalEarnings: 100 })
      const r = await withdrawGate(aff.id, 100)
      assert.equal(r, "OK")
      const u = await prisma.user.findUnique({ where: { id: aff.id } })
      assert.equal(u!.balance, 0)
    })

    it("Two simultaneous withdrawals with funds for one: exactly one succeeds, never negative", async () => {
      const aff = await mkAff({ balance: 200, totalEarnings: 200 })

      const results = await Promise.all([withdrawGate(aff.id, 150), withdrawGate(aff.id, 150)])
      const ok = results.filter((r) => r === "OK").length
      assert.equal(ok, 1, "Only one withdrawal can be funded")

      const u = await prisma.user.findUnique({ where: { id: aff.id } })
      assert.equal(u!.balance, 50, "Balance = 200 - 150, never negative")
      assert.ok(u!.balance >= 0)

      const withdrawals = await prisma.withdrawal.count({ where: { userId: aff.id } })
      assert.equal(withdrawals, 1, "One ledger entry only")
    })
  })
})
