"use client"
import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowRight,
  Loader2,
  Heart,
  ShoppingCart,
  Package,
  Share2,
  Check,
  ChevronLeft,
  Zap,
  Minus,
  Plus,
  Truck,
  Coins,
  Info,
  Ruler,
  FolderDown,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { useAppStore } from "@/lib/store"
import { useToast } from "@/components/Toast"
import ProductGallery from "@/components/ProductGallery"
import ProductCard from "@/components/ProductCard"
import StockActions from "@/components/StockActions"
import ProductTools from "@/components/ProductTools"

const COLOR_MAP: Record<string, string> = {
  "أبيض": "#ffffff", "أسود": "#1a1a1a", "أحمر": "#ef4444", "أزرق": "#3b82f6", "أخضر": "#22c55e",
  "أصفر": "#eab308", "برتقالي": "#f97316", "وردي": "#ec4899", "بنفسجي": "#a855f7", "بني": "#92400e",
  "رمادي": "#9ca3af", "كحلي": "#1e3a5f", "بيج": "#d4b896", "ذهبي": "#d4a017", "فضي": "#c0c0c0",
  "نيلي": "#1e40af", "سماوي": "#0ea5e9", "زيتي": "#65a30d", "مرجاني": "#f97316", "كريمي": "#fde68a",
  "ماروني": "#7f1d1d", "كاكاوي": "#4a5568",
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedColor, setSelectedColor] = useState("")
  const [selectedSize, setSelectedSize] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [isFavorited, setIsFavorited] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [addingToCart, setAddingToCart] = useState(false)
  const [related, setRelated] = useState<any[]>([])
  const [relatedFavorites, setRelatedFavorites] = useState<Set<string>>(new Set())
  const [relatedLoaded, setRelatedLoaded] = useState(false)
  const addToCart = useAppStore((s) => s.addToCart)
  const getAvailableStock = useAppStore((s) => s.getAvailableStock)
  const { toast } = useToast()

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((d) => { setProduct(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (product?.id) {
      fetch("/api/favorites")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setIsFavorited(data.some((f: any) => f.productId === product.id))
            setRelatedFavorites(new Set(data.map((f: any) => f.productId)))
          }
        })
        .catch(() => {})
    }
  }, [product?.id])

  useEffect(() => {
    if (product?.categoryId) {
      fetch(`/api/products?category=${product.categoryId}&limit=5`)
        .then((r) => r.json())
        .then((d) => setRelated((d.products || []).filter((p: any) => p.id !== product.id).slice(0, 4)))
        .catch(() => setRelated([]))
        .finally(() => setRelatedLoaded(true))
    } else {
      setRelatedLoaded(true)
    }
  }, [product])

  const toggleFavorite = async () => {
    try {
      const res = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: product.id }) })
      const data = await res.json()
      setIsFavorited(data.favorited)
    } catch {}
  }

  const toggleRelatedFavorite = async (productId: string) => {
    try {
      const res = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) })
      const data = await res.json()
      setRelatedFavorites((prev) => {
        const next = new Set(prev)
        if (data.favorited) next.add(productId); else next.delete(productId)
        return next
      })
    } catch {}
  }

  const allImages = useMemo(
    () => [product?.image, ...(product?.galleryImages?.map((g: any) => g.url) || [])].filter(Boolean),
    [product]
  )

  const allVariants = product?.variants || []
  const hasColorVariants = allVariants.some((v: any) => v.type === "color")
  const hasSizeVariants = allVariants.some((v: any) => v.type === "size")
  const colorVariants = allVariants.filter((v: any) => v.type === "color")
  const sizeVariants = allVariants.filter((v: any) => v.type === "size")
  const otherVariants = allVariants.filter((v: any) => v.type !== "color" && v.type !== "size")

  const selectedColorObj = colorVariants.find((v: any) => v.value === selectedColor)
  const selectedSizeObj = sizeVariants.find((v: any) => v.value === selectedSize)
  const activeVariant = selectedSizeObj || selectedColorObj

  const currentPrice = activeVariant?.price || product?.price
  const currentStock = activeVariant?.stock ?? product?.stock
  const affiliateCostPrice = product?.affiliateCostPrice
  const minPrice = product?.minPrice
  const displayPrice = minPrice || currentPrice
  const costPrice = minPrice ? currentPrice : (affiliateCostPrice ?? currentPrice)
  const commission = minPrice ? Math.max(0, minPrice - currentPrice) : (currentPrice && affiliateCostPrice ? Math.max(0, currentPrice - affiliateCostPrice) : 0)
  const hasCommission = minPrice || (affiliateCostPrice && currentPrice)

  const mustSelectColor = hasColorVariants && !selectedColor
  const mustSelectSize = hasSizeVariants && !selectedSize
  const canOrder = currentStock > 0 && !mustSelectColor && !mustSelectSize

  const effectiveVariantId = activeVariant?.id
  const availableStock = getAvailableStock(product?.id, product?.stock || 0, effectiveVariantId, currentStock)

  const buildCartItem = () => ({
    productId: product.id,
    nameAr: product.nameAr,
    name: product.name,
    price: displayPrice,
    image: allImages[0] || product.image,
    stock: currentStock,
    variantId: effectiveVariantId,
    variantName: activeVariant ? `${selectedColor ? selectedColor + " - " : ""}${selectedSize || ""}`.trim() : undefined,
    affiliateCostPrice: minPrice ? currentPrice : product.affiliateCostPrice,
    minPrice: product.minPrice,
  })

  const handleAddToCart = (goToCart = false) => {
    if (!canOrder || addingToCart) return
    setAddingToCart(true)
    const cartItem = buildCartItem()
    setTimeout(() => {
      addToCart(cartItem, quantity)
      toast(`تمت إضافة "${product.nameAr}"${activeVariant ? ` (${cartItem.variantName})` : ""} (${quantity} قطعة) للعربة`, "success")
      setAddingToCart(false)
      setQuantity(1)
      if (goToCart) router.push("/cart")
    }, 300)
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: product.nameAr, url }) } catch {}
    } else {
      navigator.clipboard?.writeText(url).then(() => toast("تم نسخ رابط المنتج", "success")).catch(() => {})
    }
  }

  if (loading) return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
      <div className="space-y-3">
        <div className="aspect-square rounded-2xl bg-slate-100 animate-pulse" />
        <div className="flex gap-2.5">
          {[1, 2, 3, 4].map((i) => <div key={i} className="w-16 h-16 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      </div>
      <div className="space-y-5">
        <div className="w-24 h-6 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-9 w-3/4 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-5 w-1/2 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-12 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-12 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    </div>
  )

  if (!product?.id) return (
    <div className="text-center py-20">
      <Package size={48} className="mx-auto text-slate-300 mb-3" />
      <p className="text-slate-500 text-[15px] font-semibold">المنتج غير موجود</p>
      <Link href="/products" className="text-blue-600 text-[13px] font-medium mt-2 inline-block hover:underline">العودة للمنتجات</Link>
    </div>
  )

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[12px] text-slate-400 flex-wrap">
        <Link href="/products" className="hover:text-blue-600 transition-colors font-medium">المنتجات</Link>
        <ChevronLeft size={13} className="text-slate-300" />
        {product.category && (
          <>
            <span className="text-slate-500 font-medium">{product.category.nameAr}</span>
            <ChevronLeft size={13} className="text-slate-300" />
          </>
        )}
        <span className="text-slate-800 font-semibold truncate max-w-[220px] sm:max-w-[360px]">{product.nameAr}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24">
          <ProductGallery images={allImages} alt={product.nameAr} />
        </div>

        {/* Info */}
        <div className="space-y-5">
          {/* Title row */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2.5">
              {product.category && (
                <span className="inline-flex items-center text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                  {product.category.nameAr}
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg ${availableStock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${availableStock > 0 ? "bg-emerald-500" : "bg-red-500"} animate-pulse`} />
                {availableStock > 0 ? `متوفر (${availableStock})` : "نفدت الكمية"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-relaxed">{product.nameAr}</h1>
            {product.name && <p className="text-[13px] text-slate-400 mt-1" dir="ltr">{product.name}</p>}
            {product.sku && (
              <p className="text-[11px] text-slate-400 mt-2">كود المنتج: <span className="font-mono font-semibold text-slate-500" dir="ltr">{product.sku}</span></p>
            )}
          </div>

          {/* Price + Commission */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-extrabold text-slate-900 tabular-nums">{formatCurrency(displayPrice)}</span>
              {product.comparePrice && product.comparePrice > displayPrice && (
                <span className="text-[15px] text-slate-400 line-through tabular-nums">{formatCurrency(product.comparePrice)}</span>
              )}
              {product.comparePrice && product.comparePrice > displayPrice && (
                <span className="text-[11px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-lg">
                  وفّر {formatCurrency(product.comparePrice - displayPrice)}
                </span>
              )}
            </div>
            {minPrice && minPrice !== currentPrice && (
              <p className="text-[12px] text-slate-500 mt-1">تكلفتك: <span className="font-bold text-slate-700 tabular-nums">{formatCurrency(currentPrice)}</span></p>
            )}

            {hasCommission && commission > 0 && (
              <div className="mt-3.5 rounded-xl bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-200/70 p-3.5 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-md shadow-emerald-200">
                  <Coins size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-emerald-700">عمولة المسوق (الحد الأدنى)</p>
                  <p className="text-xl font-extrabold text-emerald-600 tabular-nums leading-tight">{formatCurrency(commission)}</p>
                </div>
                <div className="text-left shrink-0 hidden sm:block">
                  <p className="text-[10px] text-slate-500">سعر البيع <span className="font-bold tabular-nums">{formatCurrency(minPrice || currentPrice)}</span></p>
                  <p className="text-[10px] text-slate-500">تكلفتك <span className="font-bold tabular-nums">{formatCurrency(costPrice)}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* Marketer tools */}
          <ProductTools product={product} />

          {/* Product Media */}
          {product.mediaUrl && (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)" }}>
                  <FolderDown size={20} className="text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-extrabold text-slate-900">ميديا المنتج</h3>
                  <p className="text-[12px] text-slate-500 leading-relaxed">صور وفيديوهات ومواد تسويقية جاهزة للترويج</p>
                </div>
              </div>
              <a
                href={product.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-xl text-[14px] font-bold text-white transition-all active:scale-[0.98] hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #7c3aed, #8b5cf6)" }}
              >
                <FolderDown size={18} />
                تحميل ميديا المنتج
              </a>
            </div>
          )}

          {/* Color variants */}
          {hasColorVariants && (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[13px] font-bold text-slate-800">
                  اللون
                  {mustSelectColor && <span className="text-red-500 text-[11px] font-normal mr-1">(مطلوب)</span>}
                </label>
                {selectedColor && (
                  <span className="text-[12px] font-semibold text-blue-600 flex items-center gap-1">
                    <Check size={13} /> {selectedColor}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                {colorVariants.map((v: any) => {
                  const bg = COLOR_MAP[v.value] || "#6b7280"
                  const isLight = ["#ffffff", "#fde68a", "#d4b896"].includes(bg)
                  const isSelected = selectedColor === v.value
                  const colorAvail = getAvailableStock(product.id, product.stock, v.id, v.stock)
                  const outOfStock = colorAvail <= 0
                  return (
                    <button key={v.id} disabled={outOfStock} onClick={() => {
                      setSelectedColor(isSelected ? "" : v.value)
                      setSelectedSize("")
                      setQuantity(1)
                    }}
                      title={v.value}
                      className={`relative w-12 h-12 rounded-xl border-[3px] transition-all
                        ${isSelected ? "border-blue-500 shadow-lg scale-110 ring-2 ring-blue-200" : "border-slate-200 hover:border-slate-400 hover:scale-105"}
                        ${outOfStock ? "opacity-25 cursor-not-allowed" : "cursor-pointer"}`}
                      style={{ backgroundColor: bg }}>
                      {isSelected && <Check size={16} className="absolute inset-0 m-auto drop-shadow-md" style={{ color: isLight ? "#333" : "#fff" }} />}
                      {outOfStock && <div className="absolute inset-0 flex items-center justify-center"><div className="w-10 h-[2px] bg-red-500 rotate-45 rounded-full" /></div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Size variants */}
          {hasSizeVariants && (selectedColor || !hasColorVariants) && (
            <div className={`rounded-2xl border border-slate-200/70 bg-white p-4 ${hasColorVariants && !selectedColor ? "opacity-50 pointer-events-none" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[13px] font-bold text-slate-800">
                  المقاس
                  {mustSelectSize && <span className="text-red-500 text-[11px] font-normal mr-1">(مطلوب)</span>}
                </label>
                {selectedSize && (
                  <span className="text-[12px] font-semibold text-blue-600 flex items-center gap-1">
                    <Check size={13} /> {selectedSize}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {sizeVariants.map((v: any) => {
                  const isSelected = selectedSize === v.value
                  const sizeAvail = getAvailableStock(product.id, product.stock, v.id, v.stock)
                  const outOfStock = sizeAvail <= 0
                  return (
                    <div key={v.id} className="relative">
                      <button disabled={outOfStock} onClick={() => {
                        setSelectedSize(isSelected ? "" : v.value)
                        setQuantity(1)
                      }}
                        className={`px-5 py-2.5 rounded-xl text-[13px] font-bold border-2 transition-all
                          ${isSelected ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md" : "border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50"}
                          ${outOfStock ? "opacity-25 cursor-not-allowed line-through" : "cursor-pointer"}`}>
                        {v.value}
                      </button>
                      {v.price && (
                        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 whitespace-nowrap tabular-nums">
                          {formatCurrency(v.price)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {selectedSizeObj && (
                <p className={`text-[12px] font-semibold mt-4 ${availableStock > 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {availableStock > 0 ? `متوفر ${availableStock} قطعة` : "غير متوفر"}
                </p>
              )}
            </div>
          )}

          {/* Other variants */}
          {otherVariants.length > 0 && (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
              <label className="block text-[13px] font-bold text-slate-800 mb-2.5">الخيارات</label>
              <div className="flex flex-wrap gap-2">
                {otherVariants.map((v: any) => (
                  <span key={v.id} className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-slate-100 text-slate-700">
                    {v.name}: {v.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + Actions */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 space-y-4">
            {canOrder && (
              <div className="flex items-center justify-between gap-3">
                <label className="text-[13px] font-bold text-slate-700">الكمية:</label>
                <div className="flex items-center border-2 border-slate-200 rounded-xl overflow-hidden">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-2.5 hover:bg-slate-50 text-slate-600 transition-colors" aria-label="تقليل">
                    <Minus size={16} />
                  </button>
                  <span className="px-5 py-2.5 text-[15px] font-extrabold text-slate-800 min-w-[52px] text-center border-x-2 border-slate-200 tabular-nums">{quantity}</span>
                  <button onClick={() => setQuantity(q => Math.min(availableStock, q + 1))} className="px-3 py-2.5 hover:bg-slate-50 text-slate-600 transition-colors" aria-label="زيادة">
                    <Plus size={16} />
                  </button>
                </div>
                <span className="text-[11px] text-slate-400">الحد الأقصى: {availableStock}</span>
              </div>
            )}

            <div className="flex gap-3">
              {canOrder ? (
                <>
                  <button onClick={() => handleAddToCart(false)}
                    disabled={addingToCart}
                    className="flex-1 py-3.5 rounded-xl border-2 border-blue-600 text-blue-700 font-bold text-[14px] flex items-center justify-center gap-2 hover:bg-blue-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <ShoppingCart size={18} />
                    أضف للسلة
                  </button>
                  <button onClick={() => handleAddToCart(true)}
                    disabled={addingToCart}
                    className="flex-1 btn-primary py-3.5 flex items-center justify-center gap-2 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed">
                    {addingToCart ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                    {addingToCart ? "جاري الإضافة..." : "اشترِ الآن"}
                  </button>
                </>
              ) : (
                <button disabled
                  className="flex-1 py-3.5 rounded-xl bg-slate-100 text-slate-400 font-bold text-[14px] flex items-center justify-center gap-2 cursor-not-allowed">
                  {currentStock === 0 ? "غير متوفر حالياً" : "حدد الخيارات أولاً"}
                </button>
              )}
              <button onClick={toggleFavorite}
                className={`p-3.5 rounded-xl border-2 transition-all shrink-0 ${isFavorited ? "bg-red-50 border-red-200 text-red-500" : "border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200"}`}
                aria-label="المفضلة">
                <Heart size={20} fill={isFavorited ? "currentColor" : "none"} />
              </button>
              <button onClick={handleShare}
                className={`p-3.5 rounded-xl border-2 transition-all shrink-0 border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-200`}
                aria-label="مشاركة">
                <Share2 size={20} />
              </button>
            </div>

            {/* Stock actions (shared component — applies to every product) */}
            <StockActions product={product} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border border-slate-200/70 bg-white overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {[
            { key: "desc", label: "الوصف", icon: Info },
            { key: "specs", label: "المواصفات", icon: Ruler },
            { key: "shipping", label: "الشحن", icon: Truck },
          ].map((tab, i) => (
            <button key={tab.key} onClick={() => setActiveTab(i)}
              className={`flex items-center gap-2 px-5 py-3.5 text-[13px] font-bold whitespace-nowrap transition-colors border-b-2 -mb-px
                ${activeTab === i ? "text-blue-600 border-blue-600 bg-blue-50/40" : "text-slate-500 hover:text-slate-700 border-transparent hover:bg-slate-50"}`}>
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-5 sm:p-6">
          {activeTab === 0 && (
            <p className="text-[13.5px] text-slate-600 leading-loose whitespace-pre-line">
              {product.descriptionAr || product.description || "لا يوجد وصف لهذا المنتج."}
            </p>
          )}
          {activeTab === 1 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {[
                product.name && ["الاسم بالإنجليزية", product.name, true],
                product.sku && ["الكود", product.sku, true],
                product.barcode && ["الباركود", product.barcode, true],
                product.category && ["التصنيف", product.category.nameAr, false],
                product.weight && ["الوزن", `${product.weight}`, false],
                product.dimensions && ["الأبعاد", product.dimensions, false],
                hasColorVariants && ["الألوان المتاحة", colorVariants.map((v: any) => v.value).join("، "), false],
                hasSizeVariants && ["المقاسات المتاحة", sizeVariants.map((v: any) => v.value).join("، "), false],
              ].filter(Boolean).map((row: any) => (
                <div key={row[0]} className="flex items-center justify-between gap-3 py-1 border-b border-slate-50">
                  <dt className="text-[12px] font-semibold text-slate-400">{row[0]}</dt>
                  <dd className={`text-[12px] font-bold text-slate-700 truncate max-w-[60%] ${row[2] ? "" : ""}`} dir={row[2] ? "ltr" : "rtl"}>{row[1]}</dd>
                </div>
              ))}
            </dl>
          )}
          {activeTab === 2 && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 max-w-2xl">
              <p className="text-[13px] font-bold text-slate-800 flex items-center gap-2 mb-2"><Truck size={15} className="text-blue-600" /> الشحن</p>
              <p className="text-[12.5px] text-slate-600 leading-relaxed">يتم الشحن لجميع المحافظات خلال 3-7 أيام عمل بعد تأكيد الطلب، وتُعرض تكلفة الشحن حسب المحافظة أثناء إتمام الطلب.</p>
            </div>
          )}
        </div>
      </div>

      {/* Related products */}
      {relatedLoaded && related.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold text-slate-900 flex items-center gap-2">
              منتجات مشابهة
            </h2>
            <Link href="/products" className="text-[12px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
              عرض الكل
              <ArrowRight size={14} className="rotate-180" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {related.map((p: any) => (
              <ProductCard
                key={p.id}
                product={p}
                isFavorited={relatedFavorites.has(p.id)}
                onToggleFavorite={toggleRelatedFavorite}
                showStockActions={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
