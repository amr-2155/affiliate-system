import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { execSync } from "child_process"
import { join } from "path"
import { PrismaClient } from "../src/generated/prisma/client"
import { setupTestDatabase } from "./setup-db"

const DB_PATH = join(__dirname, "test-bonus.db")
function createPrisma() { return new PrismaClient({ datasources: { db: { url: "file:" + DB_PATH } } }) }
let prisma: PrismaClient
function uid() { return "b-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) }
async function mkAff(p: PrismaClient, o: Record<string, any> = {}) {
  return p.user.create({ data: { name: "A", email: uid() + "@t.co", password: "x", role: "AFFILIATE", status: "ACTIVE", balance: 0, totalEarnings: 0, referralCode: uid(), ...o } })
}
async function mkCat(p: PrismaClient) {
  return p.category.create({ data: { name: "Cat-" + uid(), nameAr: "اختبار", slug: uid() } })
}
async function mkProd(p: PrismaClient, data: Record<string, any>) {
  if (!data.categoryId) {
    const cat = await mkCat(p)
    data.categoryId = cat.id
  }
  return p.product.create({ data: data as any })
}

describe("Supplier Bonus Concurrency", () => {
  before(async () => {
    process.env.DATABASE_URL = await setupTestDatabase("test-bonus.db")
    prisma = new PrismaClient()
  })
  after(async () => { await prisma?.$disconnect() })

  it("Sequential bonus payment: idempotent (second call sees no EARNED bonuses)", async () => {
    const aff = await mkAff(prisma)
    const ref = await prisma.supplierReferral.create({
      data: { supplierName: "S", brandName: "B", phone: "0100", phoneKey: uid(), city: "Cairo", productType: "X", contactMethod: "PHONE", affiliateId: aff.id, status: "ACTIVE", activationDate: new Date(Date.now() - 86400000), campaignEndDate: new Date(Date.now() + 86400000) },
    })
    for (let i = 0; i < 3; i++) {
      const prod = await mkProd(prisma, { name: "P" + i, nameAr: "P" + i, sku: uid(), slug: uid(), price: 100, costPrice: 50, stock: 10 })
      const order = await prisma.order.create({ data: { orderNumber: uid(), status: "COLLECTED", subtotal: 100, shippingCost: 10, total: 110, customerName: "C", customerPhone: "0", customerAddress: "A", customerCity: "X", affiliateId: aff.id, collectedAt: new Date(), items: { create: [{ productId: prod.id, quantity: 1, unitPrice: 100, total: 100 }] } } })
      await prisma.bonusLedger.create({ data: { referralId: ref.id, affiliateId: aff.id, orderId: order.id, orderNumber: order.orderNumber, amount: 5, status: "EARNED" } })
    }

    const payOnce = async () => {
      return prisma.$transaction(async (tx) => {
        const pending = await tx.bonusLedger.findMany({ where: { referralId: ref.id, status: "EARNED" }, select: { id: true, amount: true } })
        if (pending.length === 0) return { paid: 0, count: 0 }
        const total = pending.reduce((s, p) => s + p.amount, 0)
        const updated = await tx.bonusLedger.updateMany({ where: { referralId: ref.id, status: "EARNED" }, data: { status: "PAID", paidAt: new Date() } })
        if (updated.count === 0) return { paid: 0, count: 0 }
        await tx.user.update({ where: { id: aff.id }, data: { balance: { increment: total }, totalEarnings: { increment: total } } })
        return { paid: total, count: updated.count }
      })
    }

    const r1 = await payOnce()
    assert.equal(r1.paid, 15, "First payment succeeds: 15")
    assert.equal(r1.count, 3, "All 3 bonuses PAID")

    const r2 = await payOnce()
    assert.equal(r2.paid, 0, "Second payment sees nothing: 0")
    assert.equal(r2.count, 0)

    const u = await prisma.user.findUnique({ where: { id: aff.id } })
    assert.equal(u!.balance, 15, "Balance exactly 15")
    assert.equal(u!.totalEarnings, 15, "totalEarnings exactly 15")
  })

  it("Revoke bonus: only EARNED bonuses are deleted", async () => {
    const aff = await mkAff(prisma)
    const ref = await prisma.supplierReferral.create({
      data: { supplierName: "S2", brandName: "B2", phone: "0200", phoneKey: uid(), city: "Cairo", productType: "X", contactMethod: "PHONE", affiliateId: aff.id, status: "ACTIVE", activationDate: new Date(Date.now() - 86400000), campaignEndDate: new Date(Date.now() + 86400000) },
    })
    const prod = await mkProd(prisma, { name: "P", nameAr: "P", sku: uid(), slug: uid(), price: 100, costPrice: 50, stock: 10 })
    const order = await prisma.order.create({ data: { orderNumber: uid(), status: "COLLECTED", subtotal: 100, shippingCost: 10, total: 110, customerName: "C", customerPhone: "0", customerAddress: "A", customerCity: "X", affiliateId: aff.id, collectedAt: new Date(), items: { create: [{ productId: prod.id, quantity: 1, unitPrice: 100, total: 100 }] } } })

    await prisma.bonusLedger.create({ data: { referralId: ref.id, affiliateId: aff.id, orderId: order.id, orderNumber: order.orderNumber, amount: 5, status: "EARNED" } })

    // Revoke
    const revoked = await prisma.bonusLedger.deleteMany({ where: { orderId: order.id, status: "EARNED" } })
    assert.equal(revoked.count, 1)

    // Revoke again - nothing to revoke
    const revoked2 = await prisma.bonusLedger.deleteMany({ where: { orderId: order.id, status: "EARNED" } })
    assert.equal(revoked2.count, 0, "Double revoke is idempotent")
  })
})
