"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2, Package, ShoppingCart, Users, UsersRound, Inbox, CornerDownLeft } from "lucide-react"
import { useDebounce } from "@/hooks/useDebounce"
import { formatCurrency, getStatusText } from "@/lib/utils"

interface SearchResults {
  products: { id: string; nameAr: string; name: string; image: string | null; price: number; sku: string }[]
  orders: { id: string; orderNumber: string; customerName: string; total: number; status: string }[]
  affiliates: { id: string; name: string; email: string; referralCode: string }[]
  customers: { id: string; name: string; phone: string; orderCount: number; totalValue: number }[]
}

export default function AdminGlobalSearch({ autoFocus = false, onNavigate }: { autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults>({ products: [], orders: [], affiliates: [], customers: [] })
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const debounced = useDebounce(query, 300)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults({ products: [], orders: [], affiliates: [], customers: [] })
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/admin/search?q=${encodeURIComponent(debounced.trim())}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setResults(data)
          setOpen(true)
          setActiveIndex(-1)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("touchstart", handler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("touchstart", handler)
    }
  }, [])

  const flatItems = useMemo(() => {
    const items: { type: string; label: string; sub: string; href: string; icon: any }[] = []
    results.products.forEach((p) =>
      items.push({ type: "منتجات", label: p.nameAr || p.name, sub: `${formatCurrency(p.price)} • ${p.sku || ""}`, href: `/admin/products/${p.id}`, icon: Package })
    )
    results.orders.forEach((o) =>
      items.push({ type: "طلبات", label: o.orderNumber, sub: `${o.customerName} • ${getStatusText(o.status)}`, href: `/admin/orders/${o.id}`, icon: ShoppingCart })
    )
    results.affiliates.forEach((a) =>
      items.push({ type: "مسوقين", label: a.name, sub: a.email || a.referralCode, href: "/admin/affiliates", icon: Users })
    )
    results.customers.forEach((c) =>
      items.push({ type: "عملاء", label: c.name, sub: `${c.phone} • ${c.orderCount} طلب`, href: `/admin/customers?search=${encodeURIComponent(c.phone)}`, icon: UsersRound })
    )
    return items
  }, [results])

  const total = flatItems.length

  const goTo = (href: string) => {
    setOpen(false)
    setQuery("")
    setResults({ products: [], orders: [], affiliates: [], customers: [] })
    onNavigate?.()
    router.push(href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % Math.max(total, 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + Math.max(total, 1)) % Math.max(total, 1))
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && flatItems[activeIndex]) {
        goTo(flatItems[activeIndex].href)
      } else if (flatItems[0]) {
        goTo(flatItems[0].href)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const grouped = useMemo(() => {
    const groups = [
      { title: "المنتجات", items: flatItems.filter((i) => i.type === "منتجات") },
      { title: "الطلبات", items: flatItems.filter((i) => i.type === "طلبات") },
      { title: "المسوقين", items: flatItems.filter((i) => i.type === "مسوقين") },
      { title: "العملاء", items: flatItems.filter((i) => i.type === "عملاء") },
    ]
    return groups.filter((g) => g.items.length > 0)
  }, [flatItems])

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value)
            if (e.target.value.trim().length >= 2) setOpen(true)
          }}
          onFocus={() => {
            if (query.trim().length >= 2 && total > 0) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="بحث في المنتجات، الطلبات، المسوقين، العملاء..."
          className="w-full pr-10 pl-16 py-2.5 rounded-xl text-sm border-0 bg-slate-100/80 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:shadow-sm transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("")
              setResults({ products: [], orders: [], affiliates: [], customers: [] })
              inputRef.current?.focus()
            }}
            className="absolute left-8 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <Inbox size={14} />
          </button>
        )}
        <kbd className="hidden sm:flex absolute left-2.5 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-slate-400">
          Ctrl K
        </kbd>
      </div>

      {open && (
        <div className="absolute top-full mt-2 inset-x-0 bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden z-50 animate-slide-in">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              جاري البحث...
            </div>
          ) : total === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 py-8 text-slate-400">
              <Inbox size={22} className="mb-1 opacity-60" />
              <p className="text-sm">لا توجد نتائج لـ «{query}»</p>
              <p className="text-[11px]">جرّب البحث باسم المنتج، رقم الطلب، اسم المسوق، أو رقم عميل</p>
            </div>
          ) : (
            <div className="max-h-[min(420px,70vh)] overflow-y-auto">
              {grouped.map((group) => (
                <div key={group.title}>
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold text-slate-400 tracking-wider uppercase">{group.title}</p>
                  {group.items.map((item) => {
                    const idx = flatItems.indexOf(item)
                    return (
                      <button
                        key={item.href + item.label}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => goTo(item.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors ${
                          activeIndex === idx ? "bg-blue-50/70" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activeIndex === idx ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                          <item.icon size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-700 truncate">{item.label}</p>
                          <p className="text-[11px] text-slate-400 truncate">{item.sub}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
          {total > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-100 bg-slate-50/60 text-[10px] text-slate-400">
              <CornerDownLeft size={11} />
              للتنقل بين النتائج
              <span className="mx-1 text-slate-300">•</span>
              Esc للإغلاق
            </div>
          )}
        </div>
      )}
    </div>
  )
}
