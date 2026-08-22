import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("categories.create")
    if (guard instanceof NextResponse) return guard

    const body = await req.json()
    const { name, nameAr, slug, icon } = body

    if (!name || !nameAr || !slug) {
      return NextResponse.json({ error: "جميع الحقول مطلوبة" }, { status: 400 })
    }

    const category = await prisma.category.create({
      data: { name, nameAr, slug, icon: icon || null },
    })

    return NextResponse.json(category)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("categories.delete")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "ID مطلوب" }, { status: 400 })

    const productCount = await prisma.product.count({ where: { categoryId: id } })
    if (productCount > 0) {
      return NextResponse.json({ error: "لا يمكن حذف التصنيف لوجود منتجات فيه" }, { status: 400 })
    }

    await prisma.category.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
