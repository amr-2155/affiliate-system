import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { requireAdminPermission } from "@/lib/admin-guard"
import { textMatch } from "@/lib/text-search"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("affiliates.view")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""

    const where: Prisma.UserWhereInput = { role: "AFFILIATE" }
    if (search) {
      where.OR = [
        { name: textMatch(search) },
        { email: textMatch(search) },
        { phone: textMatch(search) },
        { referralCode: textMatch(search) },
      ]
    }
    if (status) where.status = status

    const affiliates = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true, status: true,
        commissionRate: true, balance: true, totalEarnings: true,
        referralCode: true, createdAt: true,
        _count: { select: { orders: true, withdrawals: true } },
      },
      orderBy: { totalEarnings: "desc" },
    })

    return NextResponse.json(affiliates)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
