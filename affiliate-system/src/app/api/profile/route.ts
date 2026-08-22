import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"
import { logActivity } from "@/lib/admin-guard"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        status: true,
        commissionRate: true,
        balance: true,
        totalEarnings: true,
        referralCode: true,
        createdAt: true,
        lastLogin: true,
        _count: { select: { orders: true, favorites: true } },
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const body = await req.json()
    const { name, phone, avatar, currentPassword, newPassword } = body

    const updateData: any = {}

    if (name) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (avatar) updateData.avatar = avatar

    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" }, { status: 400 })
      }

      const user = await prisma.user.findUnique({ where: { id: session.user.id } })
      if (!user) {
        return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 })
      }

      const isValid = await bcrypt.compare(currentPassword, user.password)
      if (!isValid) {
        return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 400 })
      }

      updateData.password = await bcrypt.hash(newPassword, 12)
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
      },
    })

    if (session.user.id) {
      if (currentPassword && newPassword) {
        await logActivity(session.user.id, "PASSWORD_CHANGED", "profile", "تم تغيير كلمة المرور الخاصة بالحساب")
      } else {
        await logActivity(session.user.id, "PROFILE_UPDATED", "profile", "تم تحديث بيانات الحساب")
      }
    }

    return NextResponse.json(updatedUser)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
