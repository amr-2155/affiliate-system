import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") || ""
    const read = searchParams.get("read")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20))

    const where: any = { userId: session.user.id }
    if (type) where.type = { in: type.split(",").map((t) => t.trim()).filter(Boolean) }
    if (read === "true") where.read = true
    if (read === "false") where.read = false

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: session.user.id, read: false } }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))

    return NextResponse.json({
      notifications,
      unreadCount,
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    })
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

    const { ids, markAll, link, relatedId } = await req.json()

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      })
    } else if (ids?.length) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: session.user.id },
        data: { read: true },
      })
    } else if (relatedId) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, relatedId, read: false },
        data: { read: true },
      })
    } else if (link) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, link, read: false },
        data: { read: true },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const all = searchParams.get("all") === "true"

    if (all) {
      await prisma.notification.deleteMany({ where: { userId: session.user.id } })
    } else if (id) {
      const existing = await prisma.notification.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
      })
      if (!existing) {
        return NextResponse.json({ error: "الإشعار غير موجود" }, { status: 404 })
      }
      await prisma.notification.delete({ where: { id } })
    } else {
      return NextResponse.json({ error: "معرّف الإشعار مطلوب" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
