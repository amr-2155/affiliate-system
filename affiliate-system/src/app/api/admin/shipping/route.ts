import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"

export async function GET() {
  const guard = await requireAdminPermission("settings.shipping")
  if (guard instanceof NextResponse) return guard

  const rates = await prisma.shippingRate.findMany({
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(rates)
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdminPermission("settings.shipping")
  if (guard instanceof NextResponse) return guard
  const actor = guard.actor

  const body = await request.json()
  const { rate, estimatedDays } = body

  if (typeof rate !== "number") {
    return NextResponse.json({ error: "rate is required and must be a number" }, { status: 400 })
  }

  const data: { rate: number; estimatedDays?: number } = { rate }
  if (typeof estimatedDays === "number") {
    data.estimatedDays = estimatedDays
  }

  const result = await prisma.shippingRate.updateMany({
    where: { isActive: true },
    data,
  })

  await logActivity(actor.id, "SHIPPING_RATES_UPDATED", "settings", `تم توحيد أسعار الشحن لـ ${result.count} محافظة — ${rate} ج.م${typeof estimatedDays === "number" ? ` / ${estimatedDays} يوم` : ""}`)

  return NextResponse.json({
    updated: result.count,
    message: "تم تحديث الأسعار",
  })
}
