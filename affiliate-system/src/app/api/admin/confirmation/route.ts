import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("confirmation.view")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))

    const where: any = { role: "VERIFIER" }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    }
    if (status) where.status = status

    const [members, total, counts] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true, avatar: true,
          role: true, status: true, lastLogin: true, createdAt: true,
          isSuperAdmin: true,
          _count: { select: { assignedOrders: true, confirmedOrders: true, adminActivities: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
      prisma.order.groupBy({
        by: ["reviewerId"],
        where: { reviewerId: { not: null } },
        _count: { _all: true },
      }),
    ])

    const reviewCountMap = new Map(counts.map((c: any) => [c.reviewerId, c._count._all]))

    const membersWithStats = members.map((m: any) => {
      const assigned = reviewCountMap.get(m.id) || 0
      const confirmed = m._count.confirmedOrders
      return {
        ...m,
        assignedOrders: assigned,
        confirmedOrders: confirmed,
        successRate: assigned > 0 ? Math.round((confirmed / assigned) * 100) : 0,
        lastActivity: null as string | null,
      }
    })

    // آخر نشاط لكل عضو
    const memberIds = members.map((m: any) => m.id)
    const lastActivities = await prisma.adminActivity.findMany({
      where: { userId: { in: memberIds } },
      orderBy: { createdAt: "desc" },
      select: { userId: true, action: true, createdAt: true },
    })
    const lastActivityMap = new Map<string, { action: string; createdAt: Date }>()
    for (const a of lastActivities) {
      if (!lastActivityMap.has(a.userId)) lastActivityMap.set(a.userId, a)
    }
    for (const m of membersWithStats) {
      const la = lastActivityMap.get(m.id)
      m.lastActivity = la ? `${la.action} · ${la.createdAt.toISOString()}` : null
    }

    return NextResponse.json({ members: membersWithStats, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("confirmation.create")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { name, email, phone, password, status } = await req.json()

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "الاسم والبريد وكلمة المرور مطلوبة" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "كلمة المرور 6 أحرف على الأقل" }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { email: email.trim() } })
    if (exists) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        password: hash,
        role: "VERIFIER",
        status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        isSuperAdmin: false,
        permissions: JSON.stringify([
          "confirmation.view",
          "confirmation.assign",
          "confirmation.confirm",
          "confirmation.reports",
        ]),
      },
    })

    await logActivity(user.id, "ACCOUNT_CREATED", "confirmation", `تم إنشاء حساب موظف التأكيد بواسطة ${actor.name}`)

    return NextResponse.json({ success: true, id: user.id })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
