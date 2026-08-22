import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("affiliates.create")
    if (guard instanceof NextResponse) return guard

    const body = await req.json()
    const { name, email, phone, password, status } = body

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "الاسم والبريد وكلمة المرور مطلوبة" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "البريد الإلكتروني غير صحيح" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "البريد الإلكتروني مسجل بالفعل" }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email,
        phone: phone || null,
        password: hashed,
        role: "AFFILIATE",
        status: status || "ACTIVE",
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
