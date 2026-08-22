"use client"
import { Heart, ShoppingCart, Package, Pin, Scale, BadgePercent } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useState } from "react"
import Link from "next/link"
import { useAppStore } from "@/lib/store"
import { usePinned } from "@/hooks/usePinned"
import StockActions from "@/components/StockActions"

interface Product {
  id: string
  name: string
  nameAr: string
  price: number
  minPrice?: number | null
  affiliateCostPrice?: number | null
  image?: string
  stock: number
  category?: { nameAr: string }
}

export default function ProductCard({
  product,
  onAddToCart,
  onToggleFavorite,
  isFavorited,
  isPinned,
  onTogglePin,
  isCompared,
  onToggleCompare,
  showStockActions = true,
}: {
  product: Product
  onAddToCart?: (productId: string) => void
  onToggleFavorite?: (productId: string) => void
  isFavorited?: boolean
  isPinned?: boolean
  onTogglePin?: (productId: string) => void
  isCompared?: boolean
  onToggleCompare?: (productId: string) => void
  showStockActions?: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const getAvailableStock = useAppStore((s) => s.getAvailableStock)
  const availableStock = getAvailableStock(product.id, product.stock)
  const displayPrice = product.minPrice || product.price
  const affiliateProfit = product.minPrice ? product.minPrice - product.price : product.price - (product.affiliateCostPrice || 0)
  const hasProfit = affiliateProfit > 0

  const { pinned: selfPinned, togglePin: selfTogglePin } = usePinned()
  const pinned = isPinned !== undefined ? isPinned : selfPinned.has(product.id)
  const handleTogglePin = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onTogglePin) onTogglePin(product.id)
    else selfTogglePin(product.id)
  }
  const handleToggleCompare = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleCompare?.(product.id)
  }

  return (
    <div className={`card-premium overflow-hidden group flex flex-col ${isCompared ? "ring-2 ring-blue-500/60 border-blue-400/60" : ""}`}>
      <Link href={`/products/${product.id}`} className="block relative">
        <div className="relative aspect-square bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
          {product.image && !imgError ? (
            <img
              src={product.image}
              alt={product.nameAr}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={40} className="text-slate-300" />
            </div>
          )}

          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite?.(product.id) }}
            className={`absolute top-3 left-3 p-2 rounded-xl transition-all duration-200 shadow-sm z-10
              ${isFavorited
                ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-red-200"
                : "bg-white/90 backdrop-blur-sm text-slate-500 hover:text-red-500 hover:bg-white"}`}
            title={isFavorited ? "إزالة من المفضلة" : "أضف للمفضلة"}
          >
            <Heart size={15} fill={isFavorited ? "currentColor" : "none"} />
          </button>

          <button
            onClick={handleTogglePin}
            className={`absolute top-3 right-3 p-2 rounded-xl transition-all duration-200 shadow-sm z-10
              ${pinned
                ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-200"
                : "bg-white/90 backdrop-blur-sm text-slate-500 hover:text-amber-500 hover:bg-white"}`}
            title={pinned ? "إلغاء التثبيت" : "ثبّت المنتج في الأعلى"}
          >
            <Pin size={15} fill={pinned ? "currentColor" : "none"} className={pinned ? "rotate-45" : ""} />
          </button>

          {availableStock === 0 && (
            <div className="absolute bottom-3 right-3 left-3 z-10">
              <span className="block text-center text-[11px] font-bold text-white bg-red-500/90 backdrop-blur-sm rounded-lg py-1">
                غير متوفر
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-2">
          {product.category ? (
            <span className="inline-block text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              {product.category.nameAr}
            </span>
          ) : <span />}
          {onToggleCompare && (
            <button
              onClick={handleToggleCompare}
              className={`p-1.5 rounded-lg transition-all ${isCompared ? "bg-blue-600 text-white shadow-sm" : "bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50"}`}
              title={isCompared ? "إزالة من المقارنة" : "أضف للمقارنة"}
            >
              <Scale size={13} />
            </button>
          )}
        </div>

        <div className="flex-1">
          <Link href={`/products/${product.id}`}>
            <h3 className="text-[13px] font-semibold text-slate-800 leading-relaxed line-clamp-2 min-h-[36px] hover:text-blue-600 transition-colors">
              {product.nameAr}
            </h3>
          </Link>

          <div className="flex items-baseline gap-2 mt-2.5">
            <span className="text-lg font-extrabold text-slate-900">{formatCurrency(displayPrice)}</span>
            {product.minPrice && product.minPrice !== product.price && (
              <span className="text-[11px] text-slate-400">تكلفتك {formatCurrency(product.price)}</span>
            )}
          </div>

          {hasProfit ? (
            <div className="mt-2 rounded-lg bg-gradient-to-l from-emerald-500/10 to-green-500/10 border border-emerald-200/70 px-2.5 py-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <BadgePercent size={12} />
                أقل ربح مضمون
              </span>
              <span className="text-[12px] font-extrabold text-emerald-600 tabular-nums">{formatCurrency(affiliateProfit)}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${availableStock > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
            {availableStock > 0 ? `متوفر (${availableStock})` : "غير متوفر"}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddToCart?.(product.id) }}
            disabled={availableStock === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed bg-brand-gradient"
          >
            <ShoppingCart size={13} />
            <span>أضف للطلب</span>
          </button>
        </div>

        {showStockActions && (
          <StockActions product={product} compact />
        )}
      </div>
    </div>
  )
}
