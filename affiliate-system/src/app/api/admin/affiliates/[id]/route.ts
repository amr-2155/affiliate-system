import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"
import { firstIssueMessage, adminAffiliateUpdateSchema } from "@/lib/validation"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("affiliates.update")
    if (guard instanceof NextResponse) return guard

    const { id } = await params

    // Phase 3 (H-04): the permission is scoped to AFFILIATES — it must never
    // be usable to mutate admin/manager/verifier accounts.
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    })
    if (!target || target.role !== "AFFILIATE") {
      return NextResponse.json({ error: "المسوق غير موجود" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = adminAffiliateUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.status !== undefined) data.status = parsed.data.status
    if (parsed.data.commissionRate !== undefined) data.commissionRate = parsed.data.commissionRate
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "لا توجد تغييرات صالحة" }, { status: 400 })
    }

    // Phase 3 (H-04): whitelist select — the password hash (and other
    // internals) must never leave the server, even to admins.
    const affiliate = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        commissionRate: true,
        balance: true,
        totalEarnings: true,
        referralCode: true,
      },
    })
    return NextResponse.json(affiliate)
  } catch (error) {
    console.error("admin affiliate update error")
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
