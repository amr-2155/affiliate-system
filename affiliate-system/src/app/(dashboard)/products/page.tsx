"use client"
import { Suspense, useEffect, useMemo, useState } from "react"
import {
  Search, X, Loader2, Package, LayoutGrid, SlidersHorizontal, ArrowUpDown,
  Scale, Check, Trash2, ShoppingCart,
} from "lucide-react"
import ProductCard from "@/components/ProductCard"
import Pagination from "@/components/Pagination"
import Skeleton from "@/components/Skeleton"
import EmptyState from "@/components/EmptyState"
import { useDebounce } from "@/hooks/useDebounce"
import { useSearchParams } from "next/navigation"
import { useAppStore } from "@/lib/store"
import { useToast } from "@/components/Toast"
import { usePinned } from "@/hooks/usePinned"
import { formatCurrency } from "@/lib/utils"

interface Product {
  id: string
  name: string
  nameAr: string
  slug: string
  price: number
  minPrice?: number | null
  affiliateCostPrice?: number | null
  image?: string
  stock: number
  status: string
  category?: { id: string; nameAr: string }
  categoryId: string
}

interface Category {
  id: string
  nameAr: string
  _count: { products: number }
}

function productProfit(p: Product) {
  if (p.minPrice) return p.minPrice - p.price
  if (p.affiliateCostPrice) return p.price - p.affiliateCostPrice
  return 0
}

const SORT_OPTIONS = [
  { id: "newest", label: "الأحدث" },
  { id: "price-asc", label: "السعر: من الأقل" },
  { id: "price-desc", label: "السعر: من الأعلى" },
  { id: "profit", label: "الأعلى ربحًا" },
  { id: "name", label: "الاسم" },
]

function ProductCardSkeleton() {
  return (
    <div className="card-premium overflow-hidden">
      <Skeleton className="aspect-square rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-5 w-20" />
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export default function ProductsPageWrapper() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 size={40} className="animate-spin text-gray-400" /></div>}><ProductsPage /></Suspense>
}

function ProductsPage() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showPriceFilter, setShowPriceFilter] = useState(false)
  const [sortBy, setSortBy] = useState("newest")
  const [sortOpen, setSortOpen] = useState(false)
  const [compare, setCompare] = useState<Product[]>([])
  const [showCompare, setShowCompare] = useState(false)

  const debouncedSearch = useDebounce(search, 400)
  const { pinned, togglePin } = usePinned()

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: page.toString(),
      limit: "12",
    })
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (selectedCategory) params.set("category", selectedCategory)
    if (minPrice) params.set("minPrice", minPrice)
    if (maxPrice) params.set("maxPrice", maxPrice)

    fetch(`/api/products?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || [])
        setTotalPages(data.pages || 1)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [debouncedSearch, selectedCategory, minPrice, maxPrice, page])

  useEffect(() => {
    fetch("/api/favorites")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFavorites(new Set(data.map((f) => f.productId)))
        }
      })
      .catch(() => {})
  }, [])

  const toggleFavorite = async (productId: string) => {
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json()
      setFavorites((prev) => {
        const next = new Set(prev)
        if (data.favorited) {
          next.add(productId)
        } else {
          next.delete(productId)
        }
        return next
      })
    } catch {
      /* ignore */
    }
  }

  const addToCart = useAppStore((s) => s.addToCart)
  const { toast } = useToast()

  const handleAddToCart = (product: Product) => {
    addToCart({
      productId: product.id,
      nameAr: product.nameAr,
      name: product.name,
      price: product.price,
      image: product.image,
      stock: product.stock,
    })
    toast(`تمت إضافة "${product.nameAr}" للعربة`, "success")
  }

  const toggleCompare = (product: Product) => {
    setCompare((prev) => {
      if (prev.some((p) => p.id === product.id)) {
        return prev.filter((p) => p.id !== product.id)
      }
      if (prev.length >= 4) {
        toast("الحد الأقصى للمقارنة 4 منتجات", "warning")
        return prev
      }
      toast(`تمت إضافة "${product.nameAr}" للمقارنة`, "info")
      return [...prev, product]
    })
  }

  const clearFilters = () => {
    setSearch("")
    setSelectedCategory("")
    setMinPrice("")
    setMaxPrice("")
    setPage(1)
  }

  const sortedProducts = useMemo(() => {
    const list = [...products]
    list.sort((a, b) => {
      const pa = pinned.has(a.id) ? 0 : 1
      const pb = pinned.has(b.id) ? 0 : 1
      if (pa !== pb) return pa - pb
      switch (sortBy) {
        case "price-asc": return a.price - b.price
        case "price-desc": return b.price - a.price
        case "profit": return productProfit(b) - productProfit(a)
        case "name": return a.nameAr.localeCompare(b.nameAr, "ar")
        default: return 0
      }
    })
    return list
  }, [products, sortBy, pinned])

  const hasFilters = search || selectedCategory || minPrice || maxPrice
  const pinnedCount = products.filter((p) => pinned.has(p.id)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
            <Package size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">المنتجات المتاحة</h1>
            <p className="text-[12px] text-slate-500">
              {products.length} منتج
              {pinnedCount > 0 && <span className="text-amber-600 font-semibold"> · {pinnedCount} مثبت</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
              <X size={13} />
              مسح الكل
            </button>
          )}
          {compare.length > 0 && (
            <button
              onClick={() => setShowCompare(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-white rounded-lg transition-all shadow-sm bg-brand-gradient"
            >
              <Scale size={13} />
              مقارنة ({compare.length})
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم العربي، الإنجليزي، أو الكود..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative shrink-0">
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-all"
            >
              <ArrowUpDown size={14} />
              {SORT_OPTIONS.find((s) => s.id === sortBy)?.label}
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute z-20 top-full right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => { setSortBy(opt.id); setSortOpen(false) }}
                      className={`w-full text-right px-4 py-2.5 text-[12px] font-semibold transition-colors ${sortBy === opt.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                      {opt.id === sortBy && <Check size={12} className="inline ml-1.5" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => { setSelectedCategory(""); setPage(1) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all
              ${!selectedCategory
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"}`}
          >
            <LayoutGrid size={13} />
            الكل
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setPage(1) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap
                ${selectedCategory === cat.id
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"}`}
            >
              {cat.nameAr}
              <span className={`text-[10px] ${selectedCategory === cat.id ? "text-white/70" : "text-slate-400"}`}>
                {cat._count.products}
              </span>
            </button>
          ))}
          <button
            onClick={() => setShowPriceFilter(!showPriceFilter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all
              ${showPriceFilter
                ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"}`}
          >
            <SlidersHorizontal size={13} />
            السعر
          </button>
        </div>

        {/* Price Range */}
        {showPriceFilter && (
          <div className="flex items-center gap-2 pt-2">
            <input
              type="number" placeholder="من"
              value={minPrice}
              onChange={(e) => { setMinPrice(e.target.value); setPage(1) }}
              className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <span className="text-slate-300">—</span>
            <input
              type="number" placeholder="إلى"
              value={maxPrice}
              onChange={(e) => { setMaxPrice(e.target.value); setPage(1) }}
              className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {(minPrice || maxPrice) && (
              <button onClick={() => { setMinPrice(""); setMaxPrice("") }}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors">
                إلغاء
              </button>
            )}
          </div>
        )}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : sortedProducts.length === 0 ? (
        <EmptyState
          icon={<Package size={28} className="text-slate-300" />}
          title="لا توجد منتجات"
          subtitle={hasFilters ? "جرّب تغيير معايير البحث أو اختر تصنيفًا آخر" : "لا توجد منتجات متاحة حاليًا"}
          action={hasFilters ? (
            <button onClick={clearFilters} className="px-4 py-2 rounded-xl text-[12px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
              مسح الفلاتر
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isFavorited={favorites.has(product.id)}
              onToggleFavorite={toggleFavorite}
              onAddToCart={() => handleAddToCart(product)}
              isPinned={pinned.has(product.id)}
              onTogglePin={togglePin}
              isCompared={compare.some((c) => c.id === product.id)}
              onToggleCompare={() => toggleCompare(product)}
            />          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && products.length > 0 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Compare Bar */}
      {compare.length >= 2 && !showCompare && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 shadow-[0_-4px_20px_rgba(15,23,42,0.08)]"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
            <div className="flex items-center gap-2 overflow-x-auto">
              {compare.map((p) => (
                <div key={p.id} className="relative shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
                    {p.image ? (
                      <img src={p.image} alt={p.nameAr} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={15} className="text-slate-300" /></div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleCompare(p)}
                    className="absolute -top-1.5 -left-1.5 w-4.5 h-4.5 w-[18px] h-[18px] rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm"
                    title="إزالة"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              <span className="text-[12px] text-slate-400 font-medium whitespace-nowrap">أضف حتى 4 منتجات</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCompare([])}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <Trash2 size={13} /> مسح
              </button>
              <button
                onClick={() => setShowCompare(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-white transition-all shadow-md bg-brand-gradient"
              >
                <Scale size={15} /> قارن الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompare && compare.length > 0 && (
        <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" onClick={() => setShowCompare(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2">
                <Scale size={17} className="text-blue-600" /> مقارنة المنتجات
              </h2>
              <button onClick={() => setShowCompare(false)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr>
                    <th className="w-40" />
                    {compare.map((p) => (
                      <th key={p.id} className="p-2 align-top">
                        <div className="relative">
                          <button
                            onClick={() => toggleCompare(p)}
                            className="absolute top-1 left-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm"
                            title="إزالة"
                          >
                            <X size={11} />
                          </button>
                          <div className="aspect-square rounded-xl bg-slate-100 overflow-hidden border border-slate-100">
                            {p.image ? (
                              <img src={p.image} alt={p.nameAr} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-slate-300" /></div>
                            )}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "اسم المنتج", render: (p: Product) => <span className="font-semibold text-slate-800">{p.nameAr}</span> },
                    { label: "التصنيف", render: (p: Product) => <span className="text-slate-600">{p.category?.nameAr || "—"}</span> },
                    { label: "سعر البيع", render: (p: Product) => <span className="font-extrabold text-slate-900">{formatCurrency(p.minPrice || p.price)}</span> },
                    { label: "تكلفتك", render: (p: Product) => <span className="text-slate-500">{formatCurrency(p.price)}</span> },
                    { label: "أقل ربح مضمون", render: (p: Product) => (
                      <span className="font-bold text-emerald-600">{formatCurrency(productProfit(p))}</span>
                    ) },
                    { label: "المتوفر", render: (p: Product) => (
                      <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${p.stock > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                        {p.stock > 0 ? `متوفر (${p.stock})` : "غير متوفر"}
                      </span>
                    ) },
                    { label: "", render: (p: Product) => (
                      <button
                        onClick={() => handleAddToCart(p)}
                        disabled={p.stock === 0}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold text-white transition-all bg-brand-gradient disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ShoppingCart size={13} /> أضف للطلب
                      </button>
                    ) },
                  ].map((row) => (
                    <tr key={row.label}>
                      <td className="py-3 px-2 text-[12px] font-bold text-slate-500 border-t border-slate-50">{row.label}</td>
                      {compare.map((p) => (
                        <td key={p.id} className="py-3 px-2 text-[13px] border-t border-slate-50">{row.render(p)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>
  )
}

