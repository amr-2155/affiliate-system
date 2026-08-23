import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import bcrypt from "bcryptjs"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { textMatch } from "@/lib/text-search"
import { parsePermissions } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("managers.view")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))

    const where: Prisma.UserWhereInput = { role: "ADMIN" }
    if (search) {
      where.OR = [
        { name: textMatch(search) },
        { email: textMatch(search) },
        { phone: textMatch(search) },
      ]
    }
    if (status) where.status = status

    const [managers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, name: true, email: true, phone: true, avatar: true,
          role: true, status: true, lastLogin: true, createdAt: true,
          isSuperAdmin: true, permissions: true,
          _count: { select: { adminActivities: true } },
        },
        orderBy: [{ isSuperAdmin: "desc" }, { createdAt: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      managers: managers.map((m: (typeof managers)[number]) => ({
        ...m,
        permissions: parsePermissions(m.permissions),
        permissionsCount: parsePermissions(m.permissions).length,
      })),
      total,
      pages: Math.ceil(total / limit),
    })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("managers.create")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { name, email, phone, password, status, permissions } = await req.json()

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
        role: "ADMIN",
        status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        isSuperAdmin: false,
        permissions: JSON.stringify(parsePermissions(permissions)),
      },
    })

    await logActivity(user.id, "ACCOUNT_CREATED", "managers", `تم إنشاء حساب المدير بواسطة ${actor.name}`)

    return NextResponse.json({ success: true, id: user.id })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
