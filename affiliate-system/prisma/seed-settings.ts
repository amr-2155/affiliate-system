import { PrismaClient } from "../src/generated/prisma/client"
import path from "path"

process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(__dirname, "dev.db")}`
const prisma = new PrismaClient()

async function main() {
  const defaults: Record<string, string> = {
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
    "shipping-enabled": "true",
    "shipping-default-rate": "50",
    "shipping-free-above": "0",
    "shipping-estimated-days": "3",
    "shipping-cod-enabled": "true",
    "payment-currency": "EGP",
    "payment-cod-enabled": "true",
    "payment-online-enabled": "false",
    "payment-instaypay-enabled": "false",
    "payment-instaypay-number": "",
    "payment-bank-enabled": "false",
    "payment-bank-name": "",
    "payment-bank-account": "",
    "payment-bank-account-name": "",
    "payment-tax-enabled": "false",
    "payment-tax-rate": "14",
    "payment-invoice-prefix": "INV-",
    "notif-new-order": "true",
    "notif-new-affiliate": "true",
    "notif-withdrawal": "true",
    "notif-low-stock": "false",
    "notif-daily-summary": "false",
    "notif-email-enabled": "false",
    "notif-email-admin": "",
    "users-affiliate-commission": "10",
    "users-allow-registration": "true",
    "users-require-approval": "false",
    "users-affiliate-withdrawal-min": "100",
    "products-per-page": "12",
    "products-show-stock": "true",
    "products-hide-out-of-stock": "false",
    "products-allow-price-edit": "true",
    "products-show-compare-price": "true",
    "orders-auto-cancel-days": "3",
    "orders-auto-cancel-enabled": "true",
    "confirmation-attempts-per-day": "3",
    "confirmation-duration-days": "3",
    "confirmation-channels": "WHATSAPP,PHONE",
    "confirmation-attempt-schedule": "10:00,14:00,18:00",
    "confirmation-max-pending-hours": "0",
    "integrations-n8n-url": "",
    "integrations-n8n-api-key": "",
    "integrations-n8n-enabled": "false",
    "orders-new-order-notification": "true",
    "orders-allow-editing": "true",
    "orders-max-items": "20",
    "orders-min-amount": "0",
    "orders-max-amount": "0",
  }

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    })
  }
  console.log("Done: default settings seeded")
  await prisma.$disconnect()
}

main()
