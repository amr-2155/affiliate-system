import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission, logActivity } from "@/lib/admin-guard"
import { notifyLowStock } from "@/lib/stock"
import { safeDeleteProduct } from "@/lib/product-admin"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("products.view")
    if (guard instanceof NextResponse) return guard
    const { id } = await params
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true, variants: true, galleryImages: { orderBy: { sortOrder: "asc" } } },
    })
    if (!product) return NextResponse.json({ error: "غير موجود" }, { status: 404 })
    return NextResponse.json(product)
  } catch (error) {
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("products.update")
    if (guard instanceof NextResponse) return guard

    const { id } = await params
    const body = await req.json()
    const {
      name, nameAr, slug, sku, price, minPrice, costPrice, affiliateCostPrice, stock, categoryId,
      image, status, description, descriptionAr, isVisible,
      lockedToAffiliates, autoAssignReviewers, variants, galleryImages, mediaUrl,
    } = body

    const data: any = {}
    if (name !== undefined) data.name = name
    if (nameAr !== undefined) { data.nameAr = nameAr; if (!name) data.name = nameAr }
    if (slug !== undefined) data.slug = slug
    if (sku !== undefined) data.sku = sku
    if (price !== undefined) data.price = parseFloat(price)
    if (minPrice !== undefined) data.minPrice = minPrice ? parseFloat(minPrice) : null
    if (costPrice !== undefined) data.costPrice = costPrice ? parseFloat(costPrice) : parseFloat(price)
    if (affiliateCostPrice !== undefined) data.affiliateCostPrice = affiliateCostPrice ? parseFloat(affiliateCostPrice) : null
    if (stock !== undefined) data.stock = parseInt(stock) || 0
    if (categoryId !== undefined) data.categoryId = categoryId
    let prevStock: number | undefined
    if (stock !== undefined) {
      const existing = await prisma.product.findUnique({ where: { id }, select: { stock: true } })
      prevStock = existing?.stock
    }
    if (image !== undefined) data.image = image || null
    if (status !== undefined) data.status = status
    // إعادة منتج مؤرشف إلى الظهور عند تعديل حالته إلى غير "مؤرشف".
    if (status !== undefined && status !== "ARCHIVED") data.deletedAt = null
    if (description !== undefined) data.description = description || null
    if (descriptionAr !== undefined) data.descriptionAr = descriptionAr || null
    if (isVisible !== undefined) data.isVisible = isVisible
    if (lockedToAffiliates !== undefined) data.lockedToAffiliates = JSON.stringify(lockedToAffiliates || [])
    if (autoAssignReviewers !== undefined) data.autoAssignReviewers = autoAssignReviewers
    if (mediaUrl !== undefined) data.mediaUrl = mediaUrl || null

    const product = await prisma.product.update({ where: { id }, data })

    // تنبيه تلقائي عند انخفاض المخزون إلى حد التنبيه أو أقل
    if (stock !== undefined && product.lowStockThreshold !== undefined) {
      notifyLowStock(product, prevStock).catch((e) => console.error("notifyLowStock failed", e))
    }

    if (variants && Array.isArray(variants)) {
      const existingVariantIds = variants.filter((v: any) => v.id).map((v: any) => v.id)
      await prisma.productVariant.deleteMany({ where: { productId: id, id: { notIn: existingVariantIds } } })
      for (const v of variants) {
        if (v.id) {
          await prisma.productVariant.update({ where: { id: v.id }, data: { name: v.name, type: v.type, value: v.value, price: v.price ? parseFloat(v.price) : null, stock: parseInt(v.stock) || 0, sku: v.sku || null, image: v.image || null, isActive: v.isActive !== false } })
        } else {
          await prisma.productVariant.create({ data: { productId: id, name: v.name, type: v.type || "color", value: v.value, price: v.price ? parseFloat(v.price) : null, stock: parseInt(v.stock) || 0, sku: v.sku || null, image: v.image || null } })
        }
      }
    }

    if (galleryImages && Array.isArray(galleryImages)) {
      const existingIds = galleryImages.filter((g: any) => g.id).map((g: any) => g.id)
      await prisma.productGalleryImage.deleteMany({ where: { productId: id, id: { notIn: existingIds } } })
      for (let i = 0; i < galleryImages.length; i++) {
        const g = galleryImages[i]
        if (g.id) {
          await prisma.productGalleryImage.update({ where: { id: g.id }, data: { url: g.url, alt: g.alt || null, sortOrder: i } })
        } else {
          await prisma.productGalleryImage.create({ data: { productId: id, url: g.url, alt: g.alt || null, sortOrder: i } })
        }
      }
    }

    return NextResponse.json(product)
  } catch (error: any) {
    if (error?.code === "P2002") return NextResponse.json({ error: "الـ slug موجود بالفعل" }, { status: 400 })
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdminPermission("products.delete")
    if (guard instanceof NextResponse) return guard
    const actor = guard.actor

    const { id } = await params
    const result = await safeDeleteProduct(id)

    await logActivity(
      actor.id,
      result.outcome === "deleted" ? "PRODUCT_DELETED" : "PRODUCT_ARCHIVED",
      "products",
      result.outcome === "deleted"
        ? `${actor.name} حذف منتج نهائيًا`
        : `${actor.name} أرشف منتجًا لأنه ${result.reason}`,
      undefined
    )

    return NextResponse.json({
      success: true,
      outcome: result.outcome,
      message:
        result.outcome === "deleted"
          ? "تم حذف المنتج نهائيًا"
          : `لا يمكن حذف المنتج نهائيًا (${result.reason})، تم أرشفته بدل ذلك للحفاظ على الطلبات والتقارير السابقة.`,
    })
  } catch (error) {
    console.error("admin product DELETE error", error)
    const err = error as { status?: number }
    if (err?.status === 404) {
      return NextResponse.json({ error: "المنتج غير موجود" }, { status: 404 })
    }
    return NextResponse.json({ error: "تعذر حذف المنتج. حاول مرة أخرى." }, { status: 500 })
  }
}
