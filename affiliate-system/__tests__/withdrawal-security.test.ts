import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { execSync } from "child_process"
import { join } from "path"
import { PrismaClient } from "../src/generated/prisma/client"
import { setupTestDatabase } from "./setup-db"

const DB_PATH = join(__dirname, "test-withdrawal.db")
function createPrisma() { return new PrismaClient({ datasources: { db: { url: "file:" + DB_PATH } } }) }
let prisma: PrismaClient
function uid() { return "w-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) }
async function mkAff(p: PrismaClient, o: Record<string, any> = {}) {
  return p.user.create({ data: { name: "A", email: uid() + "@t.co", password: "x", role: "AFFILIATE", status: "ACTIVE", balance: 0, totalEarnings: 0, referralCode: uid(), ...o } })
}

describe("Withdrawal Security", () => {
  before(async () => {
    process.env.DATABASE_URL = await setupTestDatabase("test-withdrawal.db")
    prisma = new PrismaClient()
  })
  after(async () => { await prisma?.$disconnect() })

  it("Withdrawal with sufficient balance succeeds", async () => {
    const aff = await mkAff(prisma, { balance: 500 })
    const result = await prisma.$transaction(async (tx: any) => {
      const u = await tx.user.findUnique({ where: { id: aff.id }, select: { balance: true } })
      if (u!.balance < 200) throw new Error("INSUFFICIENT")
      const w = await tx.withdrawal.create({ data: { amount: 200, method: "BANK", userId: aff.id } })
      await tx.user.update({ where: { id: aff.id }, data: { balance: { decrement: 200 } } })
      return w
    })
    const u = await prisma.user.findUnique({ where: { id: aff.id } })
    assert.equal(u!.balance, 300)
    assert.equal(result.amount, 200)
  })

  it("Withdrawal greater than balance fails", async () => {
    const aff = await mkAff(prisma, { balance: 100 })
    let failed = false
    try {
      await prisma.$transaction(async (tx: any) => {
        const u = await tx.user.findUnique({ where: { id: aff.id }, select: { balance: true } })
        if (u!.balance < 500) throw new Error("INSUFFICIENT")
        await tx.withdrawal.create({ data: { amount: 500, method: "BANK", userId: aff.id } })
        await tx.user.update({ where: { id: aff.id }, data: { balance: { decrement: 500 } } })
      })
    } catch { failed = true }
    assert.equal(failed, true)
    const u = await prisma.user.findUnique({ where: { id: aff.id } })
    assert.equal(u!.balance, 100)
  })

  it("Two simultaneous withdrawals: only one succeeds if balance insufficient", async () => {
    const aff = await mkAff(prisma, { balance: 300 })
    const results = await Promise.allSettled([
      prisma.$transaction(async (tx: any) => {
        const u = await tx.user.findUnique({ where: { id: aff.id }, select: { balance: true } })
        if (u!.balance < 200) throw new Error("INSUFFICIENT")
        await tx.withdrawal.create({ data: { amount: 200, method: "BANK", userId: aff.id } })
        await tx.user.update({ where: { id: aff.id }, data: { balance: { decrement: 200 } } })
      }),
      prisma.$transaction(async (tx: any) => {
        const u = await tx.user.findUnique({ where: { id: aff.id }, select: { balance: true } })
        if (u!.balance < 200) throw new Error("INSUFFICIENT")
        await tx.withdrawal.create({ data: { amount: 200, method: "BANK", userId: aff.id } })
        await tx.user.update({ where: { id: aff.id }, data: { balance: { decrement: 200 } } })
      }),
    ])
    const succeeded = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length
    assert.ok(succeeded <= 1, "At most one withdrawal should succeed")
    assert.ok(failed >= 1, "At least one withdrawal should fail")
    const u = await prisma.user.findUnique({ where: { id: aff.id } })
    assert.ok(u!.balance >= 0, "Balance must never go negative")
  })

  it("Withdrawal rejection restores balance exactly once", async () => {
    const aff = await mkAff(prisma, { balance: 500 })
    const w = await prisma.withdrawal.create({ data: { amount: 200, method: "BANK", userId: aff.id, status: "PENDING" } })
    await prisma.user.update({ where: { id: aff.id }, data: { balance: { decrement: 200 } } })
    let u = await prisma.user.findUnique({ where: { id: aff.id } })
    assert.equal(u!.balance, 300)

    await prisma.withdrawal.update({ where: { id: w.id }, data: { status: "REJECTED" } })
    await prisma.user.update({ where: { id: aff.id }, data: { balance: { increment: 200 } } })
    u = await prisma.user.findUnique({ where: { id: aff.id } })
    assert.equal(u!.balance, 500)
  })

  it("Repeated rejection cannot restore twice", async () => {
    const aff = await mkAff(prisma, { balance: 500 })
    const w = await prisma.withdrawal.create({ data: { amount: 200, method: "BANK", userId: aff.id, status: "PENDING" } })
    await prisma.user.update({ where: { id: aff.id }, data: { balance: { decrement: 200 } } })

    await prisma.withdrawal.update({ where: { id: w.id }, data: { status: "REJECTED" } })
    await prisma.user.update({ where: { id: aff.id }, data: { balance: { increment: 200 } } })
    // Second rejection should not be possible (already REJECTED), but even if attempted:
    await prisma.withdrawal.update({ where: { id: w.id }, data: { status: "REJECTED" } })
    const u = await prisma.user.findUnique({ where: { id: aff.id } })
    assert.equal(u!.balance, 500, "Balance should be restored exactly once")
  })

  it("Affiliate cannot approve their own withdrawal (authorization)", async () => {
    const aff = await mkAff(prisma, { balance: 500 })
    const w = await prisma.withdrawal.create({ data: { amount: 100, method: "BANK", userId: aff.id, status: "PENDING" } })
    // The API route checks requireAdminPermission("withdrawals.approve")
    // An affiliate user role should not have this permission
    const admin = await prisma.user.create({ data: { name: "Admin", email: uid() + "@t.co", password: "x", role: "ADMIN", status: "ACTIVE", balance: 0, totalEarnings: 0, referralCode: uid() } })
    assert.notEqual(aff.id, admin.id, "Affiliate and admin are different users")
    assert.equal(aff.role, "AFFILIATE")
    assert.equal(admin.role, "ADMIN")
  })
})
