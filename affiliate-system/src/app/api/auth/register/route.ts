import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { isSettingEnabled } from "@/lib/settings"
import { notifyMany, NOTIFICATION_TYPE } from "@/lib/notifications"
import { clientIp, enforceRateLimit, RateLimitError } from "@/lib/api/rate-limit"
import { firstIssueMessage, registerSchema } from "@/lib/validation"

const REGISTER_RATE = { limit: 5, windowMs: 10 * 60 * 1000 }

export async function POST(req: NextRequest) {
  try {
    // Phase 3: brute-force / spam protection per IP.
    enforceRateLimit(`register:${clientIp(req)}`, REGISTER_RATE.limit, REGISTER_RATE.windowMs)

    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
    }
    const { name, email, password, phone, ref } = parsed.data

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
      select: { id: true },
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
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
      )
    }
    console.error("Register error")
    // Phase 3: never leak exception internals to the client.
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
