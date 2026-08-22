import { PrismaClient } from "../src/generated/prisma/client"
import bcrypt from "bcryptjs"
import path from "path"
import { ALL_PERMISSIONS } from "../src/lib/permissions"

process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(__dirname, "dev.db")}`

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding database...")

  const adminPassword = await bcrypt.hash("admin123", 12)
  const allPermissions = ALL_PERMISSIONS
  const admin = await prisma.user.upsert({
    where: { email: "admin@affiliate.com" },
    update: { isSuperAdmin: true, permissions: JSON.stringify(allPermissions) },
    create: {
      name: "المدير",
      email: "admin@affiliate.com",
      password: adminPassword,
      role: "ADMIN",
      isSuperAdmin: true,
      permissions: JSON.stringify(allPermissions),
      commissionRate: 15,
      phone: "01000000000",
    },
  })
  console.log("✅ Admin:", admin.email)

  const affiliatePassword = await bcrypt.hash("affiliate123", 12)
  const affiliate = await prisma.user.upsert({
    where: { email: "affiliate@affiliate.com" },
    update: {},
    create: {
      name: "المسوق",
      email: "affiliate@affiliate.com",
      password: affiliatePassword,
      role: "AFFILIATE",
      commissionRate: 10,
      phone: "01111111111",
    },
  })
  console.log("✅ Affiliate:", affiliate.email)

  const categories = [
    { name: "Electronics", nameAr: "إلكترونيات", slug: "electronics", icon: "📱" },
    { name: "Clothing", nameAr: "ملابس", slug: "clothing", icon: "👕" },
    { name: "Home", nameAr: "المنزل والمطبخ", slug: "home", icon: "🏠" },
    { name: "Beauty", nameAr: "الجمال والعناية", slug: "beauty", icon: "💄" },
    { name: "Sports", nameAr: "الرياضة", slug: "sports", icon: "⚽" },
    { name: "Books", nameAr: "الكتب", slug: "books", icon: "📚" },
    { name: "Toys", nameAr: "الألعاب", slug: "toys", icon: "🎮" },
    { name: "Automotive", nameAr: "السيارات", slug: "automotive", icon: "🚗" },
  ]

  const createdCategories = []
  for (const cat of categories) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    })
    createdCategories.push(created)
  }
  console.log("✅ Categories:", createdCategories.length)

  const products = [
    { name: "iPhone 15 Pro", nameAr: "آيفون 15 برو", slug: "iphone-15-pro", sku: "APL-IP15P", price: 57999, comparePrice: 62999, costPrice: 45000, affiliateCostPrice: 50000, stock: 25, categoryId: createdCategories[0].id, image: "https://placehold.co/400x400/6366f1/ffffff?text=iPhone+15+Pro" },
    { name: "Samsung Galaxy S24", nameAr: "سامسونج جالكسي S24", slug: "samsung-galaxy-s24", sku: "SMS-GS24", price: 39999, comparePrice: 42999, costPrice: 32000, affiliateCostPrice: 36000, stock: 30, categoryId: createdCategories[0].id, image: "https://placehold.co/400x400/22c55e/ffffff?text=Galaxy+S24" },
    { name: "MacBook Air M3", nameAr: "ماك بوك إير M3", slug: "macbook-air-m3", sku: "APL-MBA-M3", price: 64999, costPrice: 52000, affiliateCostPrice: 58000, stock: 15, categoryId: createdCategories[0].id, image: "https://placehold.co/400x400/8b5cf6/ffffff?text=MacBook+Air" },
    { name: "Sony WH-1000XM5", nameAr: "سوني سماعات WH-1000XM5", slug: "sony-wh1000xm5", sku: "SNY-WH5", price: 12999, comparePrice: 15999, costPrice: 9000, affiliateCostPrice: 10500, stock: 40, categoryId: createdCategories[0].id, image: "https://placehold.co/400x400/f59e0b/ffffff?text=Sony+XM5" },
    { name: "Nike Air Max", nameAr: "نايك اير ماكس", slug: "nike-air-max", sku: "NIK-AM90", price: 4999, comparePrice: 5999, costPrice: 3000, affiliateCostPrice: 3800, stock: 50, categoryId: createdCategories[1].id, image: "https://placehold.co/400x400/ef4444/ffffff?text=Nike+Air+Max" },
    { name: "Levi's Jeans", nameAr: "جينز ليفايز", slug: "levis-jeans", sku: "LEV-501", price: 2499, comparePrice: 2999, costPrice: 1500, affiliateCostPrice: 1900, stock: 60, categoryId: createdCategories[1].id, image: "https://placehold.co/400x400/3b82f6/ffffff?text=Levi%27s+Jeans" },
    { name: "Dyson V15", nameAr: "ديسون اسبراي V15", slug: "dyson-v15", sku: "DYS-V15D", price: 19999, comparePrice: 24999, costPrice: 15000, affiliateCostPrice: 17000, stock: 20, categoryId: createdCategories[2].id, image: "https://placehold.co/400x400/06b6d4/ffffff?text=Dyson+V15" },
    { name: "Instant Pot", nameAr: "إنستان بوت", slug: "instant-pot", sku: "INS-DUO7", price: 3999, costPrice: 2500, affiliateCostPrice: 3100, stock: 35, categoryId: createdCategories[2].id, image: "https://placehold.co/400x400/84cc16/ffffff?text=Instant+Pot" },
    { name: "The Ordinary Set", nameAr: "سيت ذه أورديناري", slug: "the-ordinary-set", sku: "ORD-NIA-SET", price: 1499, comparePrice: 1999, costPrice: 800, affiliateCostPrice: 1100, stock: 100, categoryId: createdCategories[3].id, image: "https://placehold.co/400x400/ec4899/ffffff?text=The+Ordinary" },
    { name: "Adidas Ultraboost", nameAr: "أديدس ألترا بوست", slug: "adidas-ultraboost", sku: "ADD-UB22", price: 5499, costPrice: 3500, affiliateCostPrice: 4200, stock: 45, categoryId: createdCategories[4].id, image: "https://placehold.co/400x400/14b8a6/ffffff?text=Adidas+Ultra" },
    { name: "iPad Air", nameAr: "آيباد إير", slug: "ipad-air", sku: "APL-IPAD-A", price: 29999, comparePrice: 32999, costPrice: 24000, affiliateCostPrice: 27000, stock: 20, categoryId: createdCategories[0].id, image: "https://placehold.co/400x400/a855f7/ffffff?text=iPad+Air" },
    { name: "PlayStation 5", nameAr: "بلايستيشن 5", slug: "ps5", sku: "SON-PS5", price: 24999, costPrice: 20000, affiliateCostPrice: 22500, stock: 10, categoryId: createdCategories[6].id, image: "https://placehold.co/400x400/64748b/ffffff?text=PS5" },
  ]

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: { affiliateCostPrice: product.affiliateCostPrice, sku: product.sku },
      create: product,
    })
  }
  console.log("✅ Products:", products.length)

  const governorates = [
    { governorate: "القاهرة", rate: 45, freeAbove: 300, estimatedDays: 2 },
    { governorate: "الجيزة", rate: 45, freeAbove: 300, estimatedDays: 2 },
    { governorate: "الإسكندرية", rate: 45, freeAbove: 300, estimatedDays: 2 },
    { governorate: "القليوبية", rate: 65, freeAbove: 500, estimatedDays: 3 },
    { governorate: "المنوفية", rate: 65, freeAbove: 500, estimatedDays: 3 },
    { governorate: "البحيرة", rate: 65, freeAbove: 500, estimatedDays: 4 },
    { governorate: "كفر الشيخ", rate: 65, freeAbove: 500, estimatedDays: 4 },
    { governorate: "الغربية", rate: 65, freeAbove: 500, estimatedDays: 3 },
    { governorate: "الدقهلية", rate: 65, freeAbove: 500, estimatedDays: 3 },
    { governorate: "دمياط", rate: 65, freeAbove: 500, estimatedDays: 4 },
    { governorate: "الشرقية", rate: 65, freeAbove: 500, estimatedDays: 3 },
    { governorate: "بورسعيد", rate: 65, freeAbove: 500, estimatedDays: 3 },
    { governorate: "الإسماعيلية", rate: 65, freeAbove: 500, estimatedDays: 3 },
    { governorate: "السويس", rate: 65, freeAbove: 500, estimatedDays: 3 },
    { governorate: "شمال سيناء", rate: 80, freeAbove: 700, estimatedDays: 5 },
    { governorate: "جنوب سيناء", rate: 80, freeAbove: 700, estimatedDays: 5 },
    { governorate: "بني سويف", rate: 65, freeAbove: 500, estimatedDays: 4 },
    { governorate: "الفيوم", rate: 65, freeAbove: 500, estimatedDays: 4 },
    { governorate: "المنيا", rate: 65, freeAbove: 500, estimatedDays: 4 },
    { governorate: "أسيوط", rate: 65, freeAbove: 500, estimatedDays: 4 },
    { governorate: "سوهاج", rate: 65, freeAbove: 500, estimatedDays: 4 },
    { governorate: "قهلة", rate: 65, freeAbove: 500, estimatedDays: 4 },
    { governorate: "الأقصر", rate: 80, freeAbove: 700, estimatedDays: 5 },
    { governorate: "أسوان", rate: 80, freeAbove: 700, estimatedDays: 5 },
    { governorate: "البحر الأحمر", rate: 80, freeAbove: 700, estimatedDays: 5 },
    { governorate: "الوادي الجديد", rate: 80, freeAbove: 700, estimatedDays: 5 },
    { governorate: "مطروح", rate: 80, freeAbove: 700, estimatedDays: 5 },
  ]

  for (const gov of governorates) {
    const existing = await prisma.shippingRate.findFirst({ where: { governorate: gov.governorate } })
    if (!existing) {
      await prisma.shippingRate.create({ data: gov })
    }
  }
  console.log("✅ Shipping rates:", governorates.length)

  const notifications = [
    { title: "مرحباً بك!", message: "تم تسجيل دخولك بنجاح. استكشف النظام وابدأ التسويق.", type: "SYSTEM", userId: affiliate.id },
    { title: "منتج جديد متاح", message: "تمت إضافة iPhone 15 Pro للنظام. شارك رابطك واحصل على عمولة.", type: "INFO", userId: affiliate.id },
    { title: "تم تأكيد طلبك", message: "تم تأكيد الطلب #ORD-001 ويجري تجهيزه.", type: "ORDER", userId: affiliate.id },
  ]

  for (const notif of notifications) {
    await prisma.notification.create({ data: notif })
  }
  console.log("✅ Notifications:", notifications.length)

  const sampleOrders = [
    { customerName: "أحمد محمد", customerPhone: "01234567890", customerAddress: "شارع التحرير", customerCity: "القاهرة", subtotal: 57999, shippingCost: 0, total: 57999, status: "DELIVERED", paymentStatus: "PAID", affiliateId: affiliate.id },
    { customerName: "سارة علي", customerPhone: "01987654321", customerAddress: "شارع الملك فيصل", customerCity: "الجيزة", subtotal: 39999, shippingCost: 45, total: 40044, status: "SHIPPED", paymentStatus: "PAID", affiliateId: affiliate.id },
    { customerName: "محمد حسين", customerPhone: "01555666777", customerAddress: "شارع المعز", customerCity: "القاهرة", subtotal: 4999, shippingCost: 45, total: 5044, status: "CONFIRMED", paymentStatus: "PENDING", affiliateId: affiliate.id },
    { customerName: "فاطمة حسن", customerPhone: "01888999000", customerAddress: "شارع فلسطين", customerCity: "الإسكندرية", subtotal: 19999, shippingCost: 45, total: 20044, status: "PENDING", paymentStatus: "PENDING", affiliateId: affiliate.id },
    { customerName: "خالد عمر", customerPhone: "01112223334", customerAddress: "شارع المحطة", customerCity: "المنصورة", subtotal: 12999, shippingCost: 65, total: 13064, status: "CANCELLED", paymentStatus: "FAILED", affiliateId: affiliate.id },
  ]

  const productsList = await prisma.product.findMany({ take: 5 })
  const existingOrderCount = await prisma.order.count()
  if (existingOrderCount === 0) {
    for (let i = 0; i < sampleOrders.length; i++) {
      const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-SEED-${String(i + 1).padStart(3, "0")}`,
        ...sampleOrders[i],
        items: {
          create: {
            productId: productsList[i % productsList.length].id,
            quantity: 1,
            unitPrice: productsList[i % productsList.length].price,
            total: productsList[i % productsList.length].price,
          },
        },
      },
    })
    await prisma.commissionLog.create({
      data: { amount: order.total * 0.1, orderId: order.id, userId: affiliate.id },
    })
    }
  }
  console.log("✅ Sample orders:", existingOrderCount === 0 ? sampleOrders.length : `${existingOrderCount} (skipped)`)

  const defaultSettings: Record<string, string> = {
    "brand-primary": "#1e40af",
    "brand-primary-light": "#3b82f6",
    "brand-primary-dark": "#1e3a8a",
    "brand-accent": "#f59e0b",
    "brand-accent-light": "#fbbf24",
    "brand-bg": "#f0f4f8",
    "brand-text": "#0f172a",
    "brand-text-secondary": "#64748b",
    "brand-surface": "#ffffff",
    "brand-success": "#059669",
    "brand-danger": "#dc2626",
    "site-name": "AFFILIATE",
    "site-name-ar": "نظام التسويق بالعمولة",
    "logo-url": "",
  }

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    })
  }
  console.log("✅ Default system settings")

  console.log("\n🎉 Done!")
  console.log("Admin: admin@affiliate.com / admin123")
  console.log("Affiliate: affiliate@affiliate.com / affiliate123")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
