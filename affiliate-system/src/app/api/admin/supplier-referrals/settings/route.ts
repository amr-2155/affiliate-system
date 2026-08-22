import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"

export async function PUT(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("suppliers.manage")
    if (guard instanceof NextResponse) return guard

    const body = await req.json()
    const data: any = {}
    if (typeof body.enabled === "boolean") data.enabled = body.enabled
    if (body.bonusPerOrder !== undefined) data.bonusPerOrder = Math.max(0, parseFloat(body.bonusPerOrder) || 0)
    if (typeof body.includeCollected === "boolean") data.includeCollected = body.includeCollected
    if (body.campaignStart !== undefined && body.campaignStart !== null && body.campaignStart !== "") data.campaignStart = new Date(body.campaignStart)
    if (body.campaignStart === null) data.campaignStart = null
    if (body.campaignEnd !== undefined && body.campaignEnd !== null && body.campaignEnd !== "") data.campaignEnd = new Date(body.campaignEnd)
    if (body.campaignEnd === null) data.campaignEnd = null
    if (body.maxBonusPerSupplier !== undefined && body.maxBonusPerSupplier !== null && body.maxBonusPerSupplier !== "") data.maxBonusPerSupplier = Math.max(0, parseFloat(body.maxBonusPerSupplier) || 0)
    if (body.maxBonusPerSupplier === null) data.maxBonusPerSupplier = null
    if (body.maxTotalBonus !== undefined && body.maxTotalBonus !== null && body.maxTotalBonus !== "") data.maxTotalBonus = Math.max(0, parseFloat(body.maxTotalBonus) || 0)
    if (body.maxTotalBonus === null) data.maxTotalBonus = null
    if (body.minEligibleOrders !== undefined) data.minEligibleOrders = Math.max(0, parseInt(body.minEligibleOrders) || 0)
    if (body.durationDays !== undefined) data.durationDays = Math.max(1, parseInt(body.durationDays) || 30)
    if (typeof body.durationStartFromActivation === "boolean") data.durationStartFromActivation = body.durationStartFromActivation
    data.updatedBy = guard.actor.id

    const settings = await prisma.supplierCampaignSettings.upsert({
      where: { id: "supplier-campaign" },
      update: data,
      create: { id: "supplier-campaign", ...data },
    })

    await logActivity(guard.actor.id, "SUPPLIER_CAMPAIGN_UPDATED", "suppliers", `تحديث إعدادات حملة الموردين`,)

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("admin supplier-referrals settings PUT error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
