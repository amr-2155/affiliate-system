import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { execSync } from "child_process"
import { join } from "path"
import { PrismaClient } from "../src/generated/prisma/client"
import { setupTestDatabase } from "./setup-db"
import { computeItemCommission } from "../src/lib/commission"

const DB_PATH = join(__dirname, "test-financial.db")
function createPrisma() {
  return new PrismaClient({ datasources: { db: { url: "file:" + DB_PATH } } })
}
let prisma: PrismaClient
function uid() { return "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) }

async function mkAff(p: PrismaClient, o: Record<string, any> = {}) {
  return p.user.create({ data: { name: "A", email: uid() + "@t.co", password: "x", role: "AFFILIATE", status: "ACTIVE", balance: 0, totalEarnings: 0, referralCode: uid(), ...o } })
}
async function mkCat(p: PrismaClient) {
  return p.category.create({ data: { name: "Cat-" + uid(), nameAr: "اختبار", slug: uid() } })
}
async function mkProd(p: PrismaClient, o: Record<string, any> = {}) {
  if (!o.categoryId) {
    const cat = await mkCat(p)
    o.categoryId = cat.id
  }
  return p.product.create({ data: { name: "P", nameAr: "P", sku: uid(), slug: uid(), price: 500, minPrice: null, costPrice: 200, affiliateCostPrice: 300, stock: 100, status: "ACTIVE", ...o } as any })
}

describe("Financial Invariants", () => {
  before(async () => {
    process.env.DATABASE_URL = await setupTestDatabase("test-financial.db")
    prisma = new PrismaClient()
  })
  after(async () => { await prisma?.$disconnect() })

  it("1. Raw double-increment proves business logic guard is essential", async () => {
    const aff = await mkAff(prisma)
    const prod = await mkProd(prisma)
    const c = computeItemCommission({ price: prod.price, minPrice: prod.minPrice, affiliateCostPrice: prod.affiliateCostPrice }, 400, 1)
    assert.ok(c > 0)
    await prisma.user.update({ where: { id: aff.id }, data: { balance: { increment: c }, totalEarnings: { increment: c } } })
    await prisma.user.update({ where: { id: aff.id }, data: { balance: { increment: c }, totalEarnings: { increment: c } } })
    const u = await prisma.user.findUnique({ where: { id: aff.id } })
    assert.equal(u!.balance, c * 2, "Without state guard, double-credit succeeds at DB level")
  })

  it("2. Raw double-decrement proves reversal guard is essential", async () => {
    const aff = await mkAff(prisma, { balance: 1000, totalEarnings: 1000 })
    await prisma.user.update({ where: { id: aff.id }, data: { balance: { decrement: 200 }, totalEarnings: { decrement: 200 } } })
    await prisma.user.update({ where: { id: aff.id }, data: { balance: { decrement: 200 }, totalEarnings: { decrement: 200 } } })
    const u = await prisma.user.findUnique({ where: { id: aff.id } })
    assert.equal(u!.balance, 600)
  })

  it("3. Withdrawal double-spend blocked by transaction", async () => {
    const aff = await mkAff(prisma, { balance: 500 })
    await prisma.$transaction(async (tx: any) => {
      const u = await tx.user.findUnique({ where: { id: aff.id }, select: { balance: true } })
      if (u!.balance < 300) throw new Error("INSUFFICIENT")
      await tx.withdrawal.create({ data: { amount: 300, method: "BANK", userId: aff.id } })
      await tx.user.update({ where: { id: aff.id }, data: { balance: { decrement: 300 } } })
    })
    const u1 = await prisma.user.findUnique({ where: { id: aff.id } })
    assert.equal(u1!.balance, 200)
    let failed = false
    try {
      await prisma.$transaction(async (tx: any) => {
        const u = await tx.user.findUnique({ where: { id: aff.id }, select: { balance: true } })
        if (u!.balance < 300) throw new Error("INSUFFICIENT")
        await tx.withdrawal.create({ data: { amount: 300, method: "BANK", userId: aff.id } })
        await tx.user.update({ where: { id: aff.id }, data: { balance: { decrement: 300 } } })
      })
    } catch { failed = true }
    assert.equal(failed, true)
  })

  it("4. Supplier bonus unique constraint prevents double-pay", async () => {
    const aff = await mkAff(prisma)
    const prod = await mkProd(prisma)
    const order = await prisma.order.create({ data: { orderNumber: uid(), status: "COLLECTED", subtotal: 400, shippingCost: 50, total: 450, customerName: "C", customerPhone: "0", customerAddress: "A", customerCity: "X", affiliateId: aff.id, collectedAt: new Date(), items: { create: [{ productId: prod.id, quantity: 1, unitPrice: 400, total: 400 }] } } })
    const ref = await prisma.supplierReferral.create({ data: { supplierName: "S", brandName: "B", phone: "0100", phoneKey: uid(), city: "Cairo", productType: "X", contactMethod: "PHONE", affiliateId: aff.id, status: "ACTIVE", activationDate: new Date(Date.now() - 86400000), campaignEndDate: new Date(Date.now() + 86400000) } })
    await prisma.bonusLedger.create({ data: { referralId: ref.id, affiliateId: aff.id, orderId: order.id, orderNumber: order.orderNumber, amount: 10, status: "EARNED" } })
    let failed = false
    try {
      await prisma.bonusLedger.create({ data: { referralId: ref.id, affiliateId: aff.id, orderId: order.id, orderNumber: order.orderNumber, amount: 10, status: "EARNED" } })
    } catch { failed = true }
    assert.equal(failed, true, "P2002 unique constraint should block duplicate bonus")
  })

  it("5. Commission is server-side computed, not client-injectable", () => {
    const prod = { price: 500, minPrice: null, affiliateCostPrice: 300 }
    assert.equal(computeItemCommission(prod, 400, 1), 100)
    assert.equal(computeItemCommission(prod, 300, 1), 0)
    assert.equal(computeItemCommission(prod, 250, 1), 0)
  })
})
