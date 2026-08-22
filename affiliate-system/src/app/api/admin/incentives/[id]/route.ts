import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("incentives.update")
    if (guard instanceof NextResponse) return guard
    const { id } = await params

    const existing = await prisma.incentiveCampaign.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 })

    const body = await req.json()
    const { name, description, status, isActive, startDate, endDate } = body

    const data: any = {}
    if (name !== undefined && name.trim()) data.name = name.trim()
    if (description !== undefined) data.description = description || null
    if (status !== undefined) {
      if (!["ACTIVE", "PAUSED", "ENDED"].includes(status)) {
        return NextResponse.json({ error: "حالة الحملة غير صحيحة" }, { status: 400 })
      }
      data.status = status
    }
    if (isActive !== undefined) data.isActive = !!isActive
    if (startDate !== undefined || endDate !== undefined) {
      const start = startDate !== undefined ? new Date(startDate) : existing.startDate
      const end = endDate !== undefined ? new Date(endDate) : existing.endDate
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return NextResponse.json({ error: "التاريخ أو الوقت المُدخل غير صحيح" }, { status: 400 })
      }
      if (start >= end) {
        return NextResponse.json({ error: "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء" }, { status: 400 })
      }
      data.startDate = start
      data.endDate = end
    }

    const campaign = await prisma.incentiveCampaign.update({ where: { id }, data })
    await logActivity(
      guard.actor.id,
      "INCENTIVE_CAMPAIGN_UPDATED",
      "incentives",
      `تعديل حملة "${campaign.name}" — الحالة: ${campaign.status}`,
    )
    return NextResponse.json(campaign)
  } catch (error) {
    console.error("admin incentives PUT error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("incentives.delete")
    if (guard instanceof NextResponse) return guard
    const { id } = await params

    const existing = await prisma.incentiveCampaign.findUnique({ where: { id }, select: { name: true } })
    if (!existing) return NextResponse.json({ error: "الحملة غير موجودة" }, { status: 404 })

    await prisma.incentiveCampaign.delete({ where: { id } })
    await logActivity(guard.actor.id, "INCENTIVE_CAMPAIGN_DELETED", "incentives", `حذف حملة "${existing.name}"`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("admin incentives DELETE error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
