import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { execSync } from "child_process"
import { join } from "path"
import type { PrismaClient } from "../src/generated/prisma/client"
import type * as OrderServiceModule from "../src/lib/order-service"

/**
 * Phase 6 — the money lifecycle of an ORDER through OrderService:
 *
 *   PENDING -> CONFIRMED -> SHIPPED -> DELIVERED   (balance must stay 0)
 *   DELIVERED -> COLLECTED                          (credited exactly once)
 *   COLLECTED -> COLLECTED                          (NO second credit)
 *   PENDING -> CANCELLED                            (stock released once)
 */
const DB_PATH = join(__dirname, "test-lifecycle.db")

let prisma: PrismaClient
let applyOrderTransition: typeof OrderServiceModule.applyOrderTransition
let OrderStateError: typeof OrderServiceModule.OrderStateError

function uid() {
  return "l-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)
}

async function mkAff(o: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: { name: "A", email: uid() + "@t.co", password: "x", role: "AFFILIATE", status: "ACTIVE", balance: 0, totalEarnings: 0, referralCode: uid(), ...o },
  })
}

async function mkOrder(affId: string, o: { stock?: number } = {}) {
  const cat = await prisma.category.create({ data: { name: "Cat-" + uid(), nameAr: "اختبار", slug: uid() } })
  const product = await prisma.product.create({
    data: { name: "P", nameAr: "P", sku: uid(), slug: uid(), price: 400, minPrice: null, costPrice: 200, affiliateCostPrice: 300, stock: o.stock ?? 10, categoryId: cat.id },
  })
  const order = await prisma.order.create({
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
      items: { create: [{ productId: product.id, quantity: 3, unitPrice: 400, total: 1200 }] },
    },
  })
  return { order, product }
}

async function balanceOf(userId: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { balance: true, totalEarnings: true } })
  return u
}

describe("Order lifecycle money flow (integration)", () => {
  before(async () => {
    execSync("npx prisma db push --schema=prisma/schema.prisma --skip-generate", {
      cwd: join(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
      stdio: "pipe",
    })
    // Must be set BEFORE importing order-service so its prisma singleton
    // binds to the isolated test database.
    process.env.DATABASE_URL = `file:${DB_PATH}`
    const p = await import("../src/generated/prisma/client")
    prisma = new p.PrismaClient({ datasources: { db: { url: `file:${DB_PATH}` } } })
    const svc = await import("../src/lib/order-service")
    applyOrderTransition = svc.applyOrderTransition
    OrderStateError = svc.OrderStateError
  })

  after(async () => {
    await prisma?.$disconnect()
  })

  it("credits NOTHING on the way up — only at COLLECTED", async () => {
    const aff = await mkAff()
    const { order } = await mkOrder(aff.id)
    await prisma.commissionLog.create({ data: { amount: 100, orderId: order.id, userId: aff.id } })

    for (const to of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]) {
      await applyOrderTransition({ orderId: order.id, to, source: "test" })
      const b = await balanceOf(aff.id)
      assert.equal(b.balance, 0, `balance must stay 0 at ${to}`)
      assert.equal(b.totalEarnings, 0)
    }

    await applyOrderTransition({ orderId: order.id, to: "COLLECTED", source: "test" })
    const b = await balanceOf(aff.id)
    assert.equal(b.balance, 100, "credited exactly at COLLECTED")
    assert.equal(b.totalEarnings, 100)

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    assert.equal(updated.paymentStatus, "PAID")
  })

  it("COLLECTED again -> NO second credit", async () => {
    const aff = await mkAff()
    const { order } = await mkOrder(aff.id)
    await prisma.commissionLog.create({ data: { amount: 75, orderId: order.id, userId: aff.id } })

    await applyOrderTransition({ orderId: order.id, to: "COLLECTED", source: "test" })
    await applyOrderTransition({ orderId: order.id, to: "COLLECTED", source: "test" }) // repeat
    await applyOrderTransition({ orderId: order.id, to: "COLLECTED", source: "test" }) // and again

    const b = await balanceOf(aff.id)
    assert.equal(b.balance, 75, "no double credit")
    assert.equal(b.totalEarnings, 75)
  })

  it("leaving COLLECTED revokes exactly what was credited — once", async () => {
    const aff = await mkAff()
    const { order } = await mkOrder(aff.id)
    await prisma.commissionLog.create({ data: { amount: 60, orderId: order.id, userId: aff.id } })

    await applyOrderTransition({ orderId: order.id, to: "COLLECTED", source: "test" })
    await applyOrderTransition({ orderId: order.id, to: "CANCELLED", source: "test", cancelReason: "مرتجع" })

    let b = await balanceOf(aff.id)
    assert.equal(b.balance, 0, "revoked exactly once")

    // Repeating CANCELLED is an idempotent NO-OP (never a double action).
    const repeat = await applyOrderTransition({ orderId: order.id, to: "CANCELLED", source: "test" })
    assert.equal(repeat.from, "CANCELLED")
    b = await balanceOf(aff.id)
    assert.equal(b.balance, 0, "still zero — no double revoke")
  })

  it("cancellation releases reserved stock exactly once (idempotent repeat)", async () => {
    const aff = await mkAff()
    const { order, product } = await mkOrder(aff.id, { stock: 10 })

    await applyOrderTransition({ orderId: order.id, to: "CANCELLED", source: "test" })
    let p = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, select: { stock: true } })
    assert.equal(p.stock, 13, "10 + 3 items returned")

    // Repeat is a no-op: stock must NOT be restored twice.
    await applyOrderTransition({ orderId: order.id, to: "CANCELLED", source: "test" })
    p = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, select: { stock: true } })
    assert.equal(p.stock, 13, "stock not double-restored")
  })

  it("backward transitions are rejected without any side effect", async () => {
    const aff = await mkAff()
    const { order } = await mkOrder(aff.id)

    await applyOrderTransition({ orderId: order.id, to: "CONFIRMED", source: "test" })
    await assert.rejects(
      applyOrderTransition({ orderId: order.id, to: "PENDING", source: "test" }), // backward
      (e: unknown) => e instanceof OrderStateError,
    )

    const b = await balanceOf(aff.id)
    assert.equal(b.balance, 0)
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } })
    assert.equal(fresh.status, "CONFIRMED")
  })

  it("terminal orders are frozen: CANCELLED cannot go anywhere new", async () => {
    const aff = await mkAff()
    const { order } = await mkOrder(aff.id)

    await applyOrderTransition({ orderId: order.id, to: "CANCELLED", source: "test" })
    await assert.rejects(
      applyOrderTransition({ orderId: order.id, to: "PROCESSING", source: "test" }),
      (e: unknown) => e instanceof OrderStateError,
    )
    await assert.rejects(
      applyOrderTransition({ orderId: order.id, to: "COLLECTED", source: "test" }),
      (e: unknown) => e instanceof OrderStateError,
    )

    const b = await balanceOf(aff.id)
    assert.equal(b.balance, 0)
  })
})
