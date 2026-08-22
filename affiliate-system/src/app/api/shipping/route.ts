import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function GET() {
  try {
    const rates = await prisma.shippingRate.findMany({
      where: { isActive: true },
      orderBy: { governorate: "asc" },
    })
    return NextResponse.json(rates)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("settings.shipping")
    if (guard instanceof NextResponse) return guard

    const body = await req.json()
    const { governorate, rate, freeAbove, estimatedDays } = body

    const shippingRate = await prisma.shippingRate.create({
      data: { governorate, rate, freeAbove, estimatedDays },
    })

    return NextResponse.json(shippingRate)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("settings.shipping")
    if (guard instanceof NextResponse) return guard

    const body = await req.json()
    const { id, rate, estimatedDays } = body
    if (!id) return NextResponse.json({ error: "ID مطلوب" }, { status: 400 })

    const updated = await prisma.shippingRate.update({
      where: { id },
      data: { rate: Number(rate), estimatedDays: Number(estimatedDays) },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
