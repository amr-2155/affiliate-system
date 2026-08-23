import { PrismaClient } from "@prisma/client"
import { execSync } from "child_process"
import { randomUUID } from "crypto"
import { join } from "path"

const DB_PATH = join(__dirname, "test.db")

let _prisma: PrismaClient | null = null

export function getTestPrisma(): PrismaClient {
  if (_prisma) return _prisma
  _prisma = new PrismaClient({
    datasources: { db: { url: `file:${DB_PATH}` } },
  })
  return _prisma
}

export async function setupTestDb(): Promise<PrismaClient> {
  const prisma = getTestPrisma()
  execSync(`npx prisma db push --schema=prisma/schema.prisma --skip-generate`, {
    cwd: join(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
    stdio: "pipe",
  })
  return prisma
}

export async function resetDb(): Promise<void> {
  const prisma = getTestPrisma()
  const tableNames = [
    "AdminActivity", "BonusLedger", "Cart", "CartItem", "CommissionLog",
    "HelpTicket", "HelpTicketMessage", "Image", "IncentiveCampaign",
    "IncentiveLevel", "IncentiveReward", "Notification", "Order", "OrderItem",
    "Product", "ProductCategory", "RefreshToken", "Session", "Settings",
    "ShippingRate", "StockMovement", "SupplierCampaignSettings",
    "SupplierReferral", "SupplierReferralEvent", "User", "Verification",
    "Webhook", "Withdrawal", "APIKey",
  ]
  for (const table of tableNames) {
    try { await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`) } catch {}
  }
}

export async function teardownTestDb(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect()
    _prisma = null
  }
}

export function uniqueEmail(prefix = "test"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@test.com`
}

export async function createTestAffiliate(prisma: PrismaClient, overrides: Record<string, any> = {}) {
  const email = uniqueEmail("affiliate")
  return prisma.user.create({
    data: {
      name: "Test Affiliate",
      email,
      password: "hashed_password",
      role: "AFFILIATE",
      status: "ACTIVE",
      balance: 0,
      totalEarnings: 0,
      referralCode: `REF-${randomUUID().slice(0, 8)}`,
      ...overrides,
    },
  })
}

export async function createTestAdmin(prisma: PrismaClient, overrides: Record<string, any> = {}) {
  const email = uniqueEmail("admin")
  return prisma.user.create({
    data: {
      name: "Test Admin",
      email,
      password: "hashed_password",
      role: "ADMIN",
      status: "ACTIVE",
      balance: 0,
      totalEarnings: 0,
      referralCode: `REF-${randomUUID().slice(0, 8)}`,
      ...overrides,
    },
  })
}

export async function createTestProduct(prisma: PrismaClient, overrides: Record<string, any> = {}) {
  return prisma.product.create({
    data: {
      name: "Test Product",
      nameAr: "منتج تجريبي",
      sku: `SKU-${randomUUID().slice(0, 8)}`,
      price: 500,
      minPrice: 350,
      affiliateCostPrice: 300,
      stock: 100,
      isActive: true,
      ...overrides,
    },
  })
}

export async function createTestOrder(
  prisma: PrismaClient,
  affiliateId: string,
  items: { productId: string; unitPrice: number; quantity: number; total: number }[],
  overrides: Record<string, any> = {}
) {
  const subtotal = items.reduce((s, i) => s + i.total, 0)
  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-${randomUUID().slice(0, 8)}`,
      status: "PENDING",
      subtotal,
      shippingCost: 50,
      total: subtotal + 50,
      customerName: "Test Customer",
      customerPhone: "01234567890",
      customerAddress: "Test Address",
      customerCity: "Cairo",
      affiliateId,
      items: { create: items },
      ...overrides,
    },
    include: { items: true },
  })
  return order
}
