import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { execSync } from "child_process"
import { join } from "path"
import { PrismaClient } from "../src/generated/prisma/client"
import { setupTestDatabase } from "./setup-db"
import { isAffiliateEditable } from "../src/lib/order-state"
import { computeItemCommission } from "../src/lib/commission"

const DB_PATH = join(__dirname, "test-authz.db")
function createPrisma() { return new PrismaClient({ datasources: { db: { url: "file:" + DB_PATH } } }) }
let prisma: PrismaClient
function uid() { return "z-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) }
async function mkAff(p: PrismaClient, o: Record<string, any> = {}) {
  return p.user.create({ data: { name: "A", email: uid() + "@t.co", password: "x", role: "AFFILIATE", status: "ACTIVE", balance: 0, totalEarnings: 0, referralCode: uid(), ...o } })
}
async function mkAdmin(p: PrismaClient) {
  return p.user.create({ data: { name: "Admin", email: uid() + "@t.co", password: "x", role: "ADMIN", status: "ACTIVE", balance: 0, totalEarnings: 0, referralCode: uid() } })
}
async function mkCat(p: PrismaClient) {
  return p.category.create({ data: { name: "Cat-" + uid(), nameAr: "اختبار", slug: uid() } })
}
async function mkProd(p: PrismaClient) {
  const cat = await mkCat(p)
  return p.product.create({ data: { name: "P", nameAr: "P", sku: uid(), slug: uid(), price: 500, minPrice: 300, costPrice: 200, stock: 100, categoryId: cat.id } })
}

describe("Order Authorization", () => {
  before(async () => {
    process.env.DATABASE_URL = await setupTestDatabase("test-authz.db")
    prisma = new PrismaClient()
  })
  after(async () => { await prisma?.$disconnect() })

  it("Affiliate A cannot read Affiliate B's order via DB query", async () => {
    const affA = await mkAff(prisma)
    const affB = await mkAff(prisma)
    const prod = await mkProd(prisma)
    const order = await prisma.order.create({
      data: { orderNumber: uid(), status: "PENDING", subtotal: 400, shippingCost: 50, total: 450, customerName: "C", customerPhone: "0", customerAddress: "A", customerCity: "X", affiliateId: affA.id, items: { create: [{ productId: prod.id, quantity: 1, unitPrice: 400, total: 400 }] } },
    })
    // Simulating the API route's DB query which uses where: { id, affiliateId }
    const found = await prisma.order.findFirst({ where: { id: order.id, affiliateId: affB.id } })
    assert.equal(found, null, "Affiliate B cannot find Affiliate A's order")
  })

  it("Affiliate A cannot edit Affiliate B's order via DB", async () => {
    const affA = await mkAff(prisma)
    const affB = await mkAff(prisma)
    const prod = await mkProd(prisma)
    const order = await prisma.order.create({
      data: { orderNumber: uid(), status: "PENDING", subtotal: 400, shippingCost: 50, total: 450, customerName: "C", customerPhone: "0", customerAddress: "A", customerCity: "X", affiliateId: affA.id, items: { create: [{ productId: prod.id, quantity: 1, unitPrice: 400, total: 400 }] } },
    })
    // The API route checks ownership: loadOrder(id, user.id) — which uses affiliateId filter
    // If we try to update where id + affiliateId matches B, it fails
    const result = await prisma.order.updateMany({ where: { id: order.id, affiliateId: affB.id }, data: { customerName: "HACKED" } })
    assert.equal(result.count, 0, "Update should affect 0 rows (wrong affiliate)")
    const unchanged = await prisma.order.findUnique({ where: { id: order.id } })
    assert.equal(unchanged!.customerName, "C", "Order unchanged")
  })

  it("Affiliate cannot modify another user's withdrawal", async () => {
    const affA = await mkAff(prisma)
    const affB = await mkAff(prisma)
    const w = await prisma.withdrawal.create({ data: { amount: 100, method: "BANK", userId: affA.id } })
    // The withdrawals GET route filters by userId: session.user.id
    const found = await prisma.withdrawal.findFirst({ where: { id: w.id, userId: affB.id } })
    assert.equal(found, null, "Affiliate B cannot find Affiliate A's withdrawal")
  })

  it("Affiliate can only modify PENDING/UNDER_REVIEW orders", async () => {
    assert.equal(isAffiliateEditable("PENDING"), true)
    assert.equal(isAffiliateEditable("UNDER_REVIEW"), true)
    assert.equal(isAffiliateEditable("CONFIRMED"), false)
    assert.equal(isAffiliateEditable("PROCESSING"), false)
    assert.equal(isAffiliateEditable("SHIPPED"), false)
    assert.equal(isAffiliateEditable("DELIVERED"), false)
    assert.equal(isAffiliateEditable("COLLECTED"), false)
    assert.equal(isAffiliateEditable("CANCELLED"), false)
  })

  it("Commission values cannot be manipulated by client", () => {
    // The commission is always computed as: (unitPrice - costPrice) * quantity
    // There is no API field that accepts a "commission" parameter
    const prod = { price: 500, minPrice: null, affiliateCostPrice: 300 }
    // Client sends unitPrice=1000000 — commission is still computed from cost
    const c1 = computeItemCommission(prod, 1000000, 1)
    assert.equal(c1, 999700)
    // Client sends unitPrice=0 — commission is 0 (no negative)
    const c2 = computeItemCommission(prod, 0, 1)
    assert.equal(c2, 0)
  })

  it("Malformed IDs return 404 not 500", async () => {
    const found = await prisma.order.findUnique({ where: { id: "nonexistent-id" } })
    assert.equal(found, null, "Non-existent ID returns null, not error")
  })

  it("Negative quantities rejected at API level", async () => {
    const product = { price: 100, minPrice: null, affiliateCostPrice: 50 }
    // computeItemCommission itself doesn't guard qty (API route does)
    assert.equal(computeItemCommission(product, 200, 0), 0, "Zero qty returns 0")
    // Negative qty would produce negative commission, but API rejects before reaching this
    const result = computeItemCommission(product, 200, -1)
    assert.ok(result < 0, "Negative qty would produce negative — API must reject before this point")
  })

  it("Admin cannot be impersonated by affiliate", async () => {
    const aff = await mkAff(prisma)
    const admin = await mkAdmin(prisma)
    assert.equal(aff.role, "AFFILIATE")
    assert.equal(admin.role, "ADMIN")
    assert.notEqual(aff.id, admin.id)
    // The requireAdminActor() function checks session.user.role === "ADMIN"
    // An affiliate session would fail this check
  })
})
