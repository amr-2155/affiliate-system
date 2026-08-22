import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { isSettingEnabled } from "@/lib/settings"
import { notifyMany, NOTIFICATION_TYPE } from "@/lib/notifications"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown"
    const rl = checkRateLimit(`register:${ip}`, RATE_LIMITS.registration)
    if (!rl.allowed) {
      return NextResponse.json({ error: "تم تجاوز الحد المسموح. حاول لاحقًا." }, { status: 429 })
    }

    const body = await req.json()
    const { name, email, password, phone, ref } = body

    if (!name || !email || !password) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "البريد الإلكتروني غير صحيح" }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: "البريد الإلكتروني مسجل بالفعل" }, { status: 400 })
    }

    let referredById: string | null = null
    if (ref) {
      const referrer = await prisma.user.findUnique({ where: { referralCode: String(ref).trim() } })
      if (referrer && referrer.role === "AFFILIATE" && referrer.status === "ACTIVE") {
        referredById = referrer.id
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        referredBy: referredById,
      },
    })

    // Notify admins about the new affiliate (respecting notification settings)
    const newAffiliateNotif = await isSettingEnabled("notif-new-affiliate", true)
    if (newAffiliateNotif) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
      if (admins.length > 0) {
        notifyMany(admins.map((a) => a.id), {
          title: "مسوق جديد",
          message: `${name} — ${email}`,
          type: NOTIFICATION_TYPE.AFFILIATE,
          link: `/admin/affiliates`,
          relatedId: user.id,
        })
      }
    }

    return NextResponse.json({ message: "تم التسجيل بنجاح", userId: user.id })
  } catch (error: any) {
    console.error("Register error:", error)
    return NextResponse.json({ error: error?.message || "خطأ في الخادم" }, { status: 500 })
  }
}
