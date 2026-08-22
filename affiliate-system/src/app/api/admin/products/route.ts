import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminPermission } from "@/lib/admin-guard"

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("products.view")
    if (guard instanceof NextResponse) return guard

    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const category = searchParams.get("category") || ""
    const status = searchParams.get("status") || ""
    const sortBy = searchParams.get("sortBy") || "newest"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))

    // لا تُظهر المنتجات المؤرشفة (Soft Delete) في القائمة الافتراضية.
    const where: any = { deletedAt: null }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameAr: { contains: search } },
        { sku: { contains: search } },
      ]
    }
    if (category) where.categoryId = category
    if (status) where.status = status

    const orderBy: any = (() => {
      switch (sortBy) {
        case "price-asc": return { price: "asc" as const }
        case "price-desc": return { price: "desc" as const }
        case "name": return { nameAr: "asc" as const }
        case "stock": return { stock: "asc" as const }
        case "updated": return { updatedAt: "desc" as const }
        default: return { createdAt: "desc" as const }
      }
    })()

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: true,
          galleryImages: true,
          _count: { select: { orderItems: true } },
        },
        skip: (page - 1) * limit, take: limit,
        orderBy,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({ products, total, pages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("admin products list error", error)
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdminPermission("products.create")
    if (guard instanceof NextResponse) return guard

    const body = await req.json()
    const {
      name, nameAr, slug, sku, price, minPrice, costPrice, affiliateCostPrice, stock, categoryId,
      image, status, description, descriptionAr, isVisible,
      lockedToAffiliates, autoAssignReviewers, variants, galleryImages, mediaUrl,
    } = body

    if (!nameAr || !slug || !sku || !price || !categoryId) {
      return NextResponse.json({ error: "جميع الحقول المطلوبة يجب ملؤها" }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name: name || nameAr, nameAr, slug, sku, price: parseFloat(price),
        minPrice: minPrice ? parseFloat(minPrice) : null,
        costPrice: costPrice ? parseFloat(costPrice) : parseFloat(price),
        affiliateCostPrice: affiliateCostPrice ? parseFloat(affiliateCostPrice) : null,
        stock: parseInt(stock) || 0, categoryId, image: image || null,
        status: status || "ACTIVE", description: description || null,
        descriptionAr: descriptionAr || null,
        isVisible: isVisible !== false,
        lockedToAffiliates: JSON.stringify(lockedToAffiliates || []),
        autoAssignReviewers: autoAssignReviewers || false,
        mediaUrl: mediaUrl || null,
      },
    })

    if (variants && Array.isArray(variants) && variants.length > 0) {
      for (const v of variants) {
        await prisma.productVariant.create({
          data: {
            productId: product.id, name: v.name, type: v.type || "color",
            value: v.value, price: v.price ? parseFloat(v.price) : null,
            stock: parseInt(v.stock) || 0, sku: v.sku || null,
            image: v.image || null, isActive: v.isActive !== false,
          },
        })
      }
    }

    if (galleryImages && Array.isArray(galleryImages) && galleryImages.length > 0) {
      for (let i = 0; i < galleryImages.length; i++) {
        const g = galleryImages[i]
        await prisma.productGalleryImage.create({
          data: { productId: product.id, url: g.url, alt: g.alt || null, sortOrder: i },
        })
      }
    }

    return NextResponse.json(product)
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "الـ slug موجود بالفعل" }, { status: 400 })
    }
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 })
  }
}
