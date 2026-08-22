"use client"
import { useEffect, useState } from "react"
import { Heart, Package } from "lucide-react"
import ProductCard from "@/components/ProductCard"
import EmptyState from "@/components/EmptyState"
import { useToast } from "@/components/Toast"
import Link from "next/link"

interface Favorite {
  id: string
  productId: string
  product?: {
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
}

export default function FavoritesPage() {
  const { toast } = useToast()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/favorites")
      .then((res) => res.json())
      .then((data) => {
        setFavorites(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const removeFavorite = async (productId: string) => {
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      setFavorites((prev) => prev.filter((f) => f.productId !== productId))
      toast("تمت الإزالة من المفضلة", "info")
    } catch {
      toast("حدث خطأ أثناء الإزالة", "error")
    }
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #be123c, #f43f5e)" }}>
          <Heart size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">المفضلة</h1>
          <p className="text-[12px] text-slate-500">
            {loading ? "جاري التحميل..." : `${favorites.length} منتج مفضل`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-100" />
              <div className="p-4 space-y-3">
                <div className="h-3 w-3/4 bg-slate-100 rounded-lg" />
                <div className="h-4 w-1/2 bg-slate-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          icon={<Heart size={26} className="text-slate-300" />}
          title="لا توجد منتجات مفضلة بعد"
          subtitle="اضغط على أيقونة القلب على أي منتج لحفظه هنا والوصول إليه بسرعة لاحقًا"
          action={
            <Link href="/products" className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm">
              <Package size={16} />
              تصفح المنتجات
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {favorites.map((fav) =>
            fav.product ? (
              <ProductCard
                key={fav.id}
                product={fav.product}
                isFavorited={true}
                onToggleFavorite={() => removeFavorite(fav.productId)}
                showStockActions={false}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  )
}
