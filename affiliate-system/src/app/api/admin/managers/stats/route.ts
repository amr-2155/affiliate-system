import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("managers.view")
    if (guard instanceof NextResponse) return guard

    const [total, active, superAdmins, withPermissions, recentLogin] = await Promise.all([
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "ADMIN", isSuperAdmin: true } }),
      prisma.user.count({ where: { role: "ADMIN", NOT: { permissions: "[]" } } }),
      prisma.user.findFirst({
        where: { role: "ADMIN", lastLogin: { not: null } },
        orderBy: { lastLogin: "desc" },
        select: { name: true, lastLogin: true },
      }),
    ])

    return NextResponse.json({ total, active, superAdmins, withPermissions, recentLogin })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
