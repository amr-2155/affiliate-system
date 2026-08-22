"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Plus, Search, Edit2, Trash2, X, Loader2, Package, Upload, Check, LayoutGrid, Boxes,
  Archive, Power, ChevronDown, AlertTriangle, CheckCircle2, RefreshCw, Hash,
} from "lucide-react"
import { formatCurrency, getStatusColor, getStatusText } from "@/lib/utils"
import Pagination from "@/components/Pagination"
import { useDebounce } from "@/hooks/useDebounce"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import { useToast } from "@/components/Toast"

interface Product {
  id: string
  name: string
  nameAr: string
  slug: string
  sku?: string | null
  price: number
  minPrice?: number | null
  costPrice: number
  stock: number
  status: string
  image?: string | null
  categoryId: string
  category?: { id: string; nameAr: string }
  deletedAt?: string | null
  _count?: { orderItems: number }
}
interface Category { id: string; nameAr: string }

const STATUS_FILTERS = [
  { key: "", label: "الكل", cls: "bg-slate-50 text-slate-600 border-slate-100" },
  { key: "ACTIVE", label: "نشط", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { key: "INACTIVE", label: "غير نشط", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  { key: "ARCHIVED", label: "مؤرشف", cls: "bg-slate-50 text-slate-500 border-slate-200" },
  { key: "OUT_OF_STOCK", label: "نفد المخزون", cls: "bg-red-50 text-red-600 border-red-100" },
]

const SORT_OPTIONS = [
  { id: "newest", label: "الأحدث" },
  { id: "updated", label: "الأحدث تعديلًا" },
  { id: "price-asc", label: "السعر: من الأقل" },
  { id: "price-desc", label: "السعر: من الأعلى" },
  { id: "stock", label: "المخزون" },
  { id: "name", label: "الاسم" },
]

type BulkAction = { type: "delete" | "activate" | "deactivate" | "archive"; ids: string[] } | null

export default function AdminProductsPage() {
  const perms = usePermissions()
  const can = perms.can
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [sortBy, setSortBy] = useState("newest")
  const [sortOpen, setSortOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [singleDeleting, setSingleDeleting] = useState(false)
  const [bulkAction, setBulkAction] = useState<BulkAction>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ deleted?: number; archived?: number; updated?: number; message: string } | null>(null)
  const [modal, setModal] = useState<"add" | null>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

  const debouncedSearch = useDebounce(search, 400)

  const fetchProducts = useCallback((signal?: AbortSignal) => {
    const p = new URLSearchParams({ page: page.toString(), limit: "20" })
    if (debouncedSearch) p.set("search", debouncedSearch)
    if (selectedCategory) p.set("category", selectedCategory)
    if (statusFilter) p.set("status", statusFilter)
    if (sortBy) p.set("sortBy", sortBy)
    fetch(`/api/admin/products?${p}`, { signal })
      .then(r => r.json())
      .then(d => {
        if (d?.products) {
          setProducts(d.products)
          setTotalPages(d.pages || 1)
          setTotal(d.total || 0)
        } else {
          setProducts([])
          setLoadError(true)
        }
        setLoading(false)
      })
      .catch(() => {
        if (signal?.aborted) return
        setProducts([])
        setLoadError(true)
        setLoading(false)
      })
  }, [page, debouncedSearch, selectedCategory, statusFilter, sortBy])

  useEffect(() => {
    const ctrl = new AbortController()
    fetchProducts(ctrl.signal)
    return () => ctrl.abort()
  }, [fetchProducts])

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(d => setCategories(Array.isArray(d) ? d : []))
  }, [])

  const selectedProducts = useMemo(() => products.filter(p => selected.has(p.id)), [products, selected])

  // Checkbox "تحديد الكل" مع حالة غير مكتملة
  useEffect(() => {
    if (!selectAllRef.current) return
    const onPage = products.length
    const selOnPage = products.filter(p => selected.has(p.id)).length
    selectAllRef.current.indeterminate = selOnPage > 0 && selOnPage < onPage
    selectAllRef.current.checked = onPage > 0 && selOnPage === onPage
  }, [products, selected])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev)
      const allOnPage = products.every(p => next.has(p.id))
      if (allOnPage) products.forEach(p => next.delete(p.id))
      else products.forEach(p => next.add(p.id))
      return next
    })
  }

  const confirmSingleDelete = async () => {
    if (!deleteTarget) return
    setSingleDeleting(true)
    try {
      const res = await fetch(`/api/admin/products/${deleteTarget.id}`, { method: "DELETE" })
      const d = await res.json()
      if (res.ok) {
        toast(d.message || "تم حذف المنتج بنجاح", d.outcome === "archived" ? "warning" : "success")
        setDeleteTarget(null)
        fetchProducts()
      } else {
        toast(d.error || "تعذر حذف المنتج", "error")
      }
    } catch {
      toast("حدث خطأ أثناء الحذف", "error")
    }
    setSingleDeleting(false)
  }

  const runBulk = async () => {
    if (!bulkAction) return
    setBulkBusy(true)
    setBulkResult(null)
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: bulkAction.ids, action: bulkAction.type }),
      })
      const d = await res.json()
      if (res.ok) {
        setBulkResult({ deleted: d.deleted, archived: d.archived, updated: d.updated, message: d.message || "تمت العملية بنجاح" })
        toast(d.message || "تمت العملية بنجاح", "success")
        setSelected(new Set())
        fetchProducts()
      } else {
        toast(d.error || "تعذر تنفيذ العملية", "error")
        setBulkAction(null)
      }
    } catch {
      toast("حدث خطأ أثناء تنفيذ العملية", "error")
      setBulkAction(null)
    }
    setBulkBusy(false)
  }

  const allSelectedActive = selectedProducts.length > 0 && selectedProducts.every(p => p.status === "ACTIVE")
  const hasFilters = search || selectedCategory || statusFilter

  return (
    <RequirePerms perm="products.view">
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
            <Boxes size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">إدارة المنتجات</h1>
            <p className="text-[12px] text-slate-500">{total > 0 ? `${total} منتج` : "إدارة منتجاتك وأسعارها ومخزونها"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button onClick={() => { setSearch(""); setSelectedCategory(""); setStatusFilter(""); setPage(1); setSelected(new Set()); setLoading(true) }}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
              <X size={13} /> مسح الفلاتر
            </button>
          )}
          {can("products.create") && (
            <button onClick={() => setModal("add")} className="btn-primary flex items-center gap-2 px-5 py-2.5 text-[13px]">
              <Plus size={16} /> <span>إضافة منتج</span>
            </button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم العربي، الإنجليزي، أو الكود..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); setSelected(new Set()); setLoading(true) }}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => { setSearch(""); setSelected(new Set()); setLoading(true) }} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="relative shrink-0">
            <button onClick={() => setSortOpen(o => !o)}
              className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-all w-full sm:w-auto">
              <ChevronDown size={14} className={sortOpen ? "rotate-180 transition-transform" : "transition-transform"} />
              {SORT_OPTIONS.find(s => s.id === sortBy)?.label}
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute z-20 top-full right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  {SORT_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={() => { setSortBy(opt.id); setSortOpen(false); setSelected(new Set()); setLoading(true) }}
                      className={`w-full text-right px-4 py-2.5 text-[12px] font-semibold transition-colors ${sortBy === opt.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}>
                      {opt.id === sortBy && <Check size={12} className="inline ml-1.5" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => { setSelectedCategory(""); setPage(1); setSelected(new Set()); setLoading(true) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${!selectedCategory ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"}`}>
            <LayoutGrid size={13} /> الكل
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setPage(1); setSelected(new Set()); setLoading(true) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${selectedCategory === cat.id ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"}`}>
              {cat.nameAr}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-50 pt-3">
          {STATUS_FILTERS.map(s => (
            <button key={s.key} onClick={() => { setStatusFilter(s.key); setPage(1); setSelected(new Set()); setLoading(true) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${statusFilter === s.key ? "ring-2 ring-indigo-200 " + s.cls : s.cls + " hover:opacity-80"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-5 h-5 bg-slate-100 rounded-md" />
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3 bg-slate-100 rounded-lg" />
                  <div className="w-20 h-2 bg-slate-100 rounded-lg" />
                </div>
                <div className="w-16 h-6 bg-slate-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={30} className="text-red-400" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">تعذر تحميل المنتجات</p>
          <p className="text-slate-400 text-sm mb-4">حدث خطأ أثناء جلب البيانات</p>
          <button onClick={() => { setLoading(true); setLoadError(false); fetchProducts() }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            <RefreshCw size={14} /> إعادة المحاولة
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Package size={32} className="text-slate-300" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">لا توجد منتجات</p>
          <p className="text-slate-400 text-sm">{hasFilters ? "جرّب تغيير معايير البحث أو الفلاتر" : "لم تتم إضافة أي منتجات بعد"}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="w-12 px-4 py-3.5">
                    <input ref={selectAllRef} type="checkbox" onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer" title="تحديد الكل" />
                  </th>
                  <th className="text-right px-4 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">المنتج</th>
                  <th className="text-right px-4 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">التصنيف</th>
                  <th className="text-right px-4 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">السعر</th>
                  <th className="text-right px-4 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">المخزون</th>
                  <th className="text-right px-4 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">الحالة</th>
                  <th className="text-right px-4 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {products.map(p => {
                  const isSelected = selected.has(p.id)
                  const hasOrders = (p._count?.orderItems || 0) > 0
                  return (
                    <tr key={p.id} onClick={() => toggleSelect(p.id)}
                      className={`cursor-pointer transition-colors group ${isSelected ? "bg-indigo-50/60" : "hover:bg-slate-50/60"} ${p.status === "ARCHIVED" ? "opacity-70" : ""}`}>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0" onClick={e => e.stopPropagation()}>
                          {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-100 shrink-0" /> : <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shrink-0"><Package size={16} className="text-slate-400" /></div>}
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-800 truncate">{p.nameAr}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-slate-400 font-mono" dir="ltr">{p.sku || "—"}</span>
                              {hasOrders && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md" title="مرتبط بطلبات سابقة">
                                  <Hash size={9} /> له طلبات سابقة
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[12px] text-slate-500 bg-slate-50 rounded-lg px-2 py-1 whitespace-nowrap">{p.category?.nameAr || "-"}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-[13px] font-bold text-slate-800 tabular-nums whitespace-nowrap">{formatCurrency(p.price)}</p>
                        {p.minPrice ? (
                          <p className="text-[11px] text-emerald-600 font-semibold tabular-nums whitespace-nowrap">ربح {formatCurrency(p.minPrice - p.price)}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[13px] font-bold tabular-nums ${p.stock > 0 ? "text-slate-800" : "text-red-500"}`}>{p.stock}</span>
                        {p.stock <= 0 && <span className="text-[10px] text-red-500 mr-1">نفد</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg ${getStatusColor(p.status)}`}>{getStatusText(p.status)}</span>
                      </td>
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {can("products.update") && (
                            <Link href={`/admin/products/${p.id}`} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="تعديل">
                              <Edit2 size={14} />
                            </Link>
                          )}
                          {can("products.delete") && (
                            <button onClick={() => setDeleteTarget(p)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all" title="حذف">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !loadError && totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={p => { setPage(p); setSelected(new Set()); setLoading(true) }} />
      )}

      {modal === "add" && <ProductModal mode="add" categories={categories} onClose={() => { setModal(null); fetchProducts() }} />}

      {/* Single delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => { if (!singleDeleting) setDeleteTarget(null) }} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-bold text-slate-900">حذف المنتج</h3>
                <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                  هل أنت متأكد من حذف «{deleteTarget.nameAr}»؟
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>إذا كان المنتج مرتبطًا بطلبات سابقة فسيتم <b>أرشفته</b> بدل الحذف النهائي للحفاظ على السجل التاريخي والتقارير.</span>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDeleteTarget(null)} disabled={singleDeleting} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50">إلغاء</button>
              <button onClick={confirmSingleDelete} disabled={singleDeleting}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {singleDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                {singleDeleting ? "جاري الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action modal */}
      {bulkAction && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => { if (!bulkBusy && !bulkResult) setBulkAction(null) }} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in">
            {bulkResult ? (
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                </div>
                <h3 className="text-[15px] font-bold text-slate-900 mb-1">تمت العملية بنجاح</h3>
                <p className="text-[12px] text-slate-500 leading-relaxed">{bulkResult.message}</p>
                <button onClick={() => { setBulkAction(null); setBulkResult(null) }} className="mt-5 w-full py-2.5 rounded-xl text-[13px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">حسنًا</button>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bulkAction.type === "delete" ? "bg-red-50 border border-red-100" : "bg-indigo-50 border border-indigo-100"}`}>
                    {bulkAction.type === "delete" ? <Trash2 size={18} className="text-red-500" /> : bulkAction.type === "archive" ? <Archive size={18} className="text-amber-500" /> : <Power size={18} className="text-indigo-500" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[14px] font-bold text-slate-900">
                      {bulkAction.type === "delete" ? "حذف المنتجات المحددة" : bulkAction.type === "archive" ? "أرشفة المنتجات المحددة" : bulkAction.type === "activate" ? "تفعيل المنتجات المحددة" : "إيقاف المنتجات المحددة"}
                    </h3>
                    <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                      سيتم تنفيذ العملية على <b className="text-slate-800">{bulkAction.ids.length} منتج</b>.
                    </p>
                  </div>
                </div>

                {bulkAction.type === "delete" && (
                  <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    <span>المنتجات غير المستخدمة تُحذف نهائيًا، بينما <b>المرتبطة بطلبات سابقة تُؤرشف تلقائيًا</b> للحفاظ على الطلبات والتقارير والعمولات القديمة.</span>
                  </div>
                )}

                <div className="flex gap-2 mt-5">
                  <button onClick={() => setBulkAction(null)} disabled={bulkBusy} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50">إلغاء</button>
                  <button onClick={runBulk} disabled={bulkBusy}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${bulkAction.type === "delete" ? "bg-red-500 hover:bg-red-600" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                    {bulkBusy ? <Loader2 size={15} className="animate-spin" /> : bulkAction.type === "delete" ? <Trash2 size={15} /> : bulkAction.type === "archive" ? <Archive size={15} /> : <Check size={15} />}
                    {bulkBusy ? "جاري التنفيذ..." : "تأكيد"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-[70] bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] animate-fadeIn"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="flex flex-wrap items-center justify-between gap-3 max-w-5xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[12px] font-extrabold">{selected.size}</span>
              <span className="text-[13px] font-bold text-slate-800">منتج محدد</span>
              <button onClick={() => setSelected(new Set())} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                <X size={12} /> إلغاء التحديد
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setBulkAction({ type: allSelectedActive ? "deactivate" : "activate", ids: Array.from(selected) })}
                disabled={bulkBusy}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-colors disabled:opacity-50 ${allSelectedActive ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"}`}>
                <Power size={13} /> {allSelectedActive ? "إيقاف" : "تفعيل"}
              </button>
              <button
                onClick={() => setBulkAction({ type: "archive", ids: Array.from(selected) })}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50">
                <Archive size={13} /> أرشفة
              </button>
              {can("products.delete") && (
                <button
                  onClick={() => setBulkAction({ type: "delete", ids: Array.from(selected) })}
                  disabled={bulkBusy}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                  <Trash2 size={13} /> حذف المحدد
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </RequirePerms>
  )
}

function ProductModal({ mode, categories, onClose }: { mode: "add" | "edit"; categories: Category[]; onClose: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    nameAr: "", slug: "", sku: "", price: "", minPrice: "",
    costPrice: "", stock: "0", categoryId: "", image: "",
    status: "ACTIVE", descriptionAr: "", isVisible: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [galleryImages, setGalleryImages] = useState<{ url: string; alt?: string }[]>([])
  const [variants, setVariants] = useState<{ name: string; type: string; value: string; price: string; stock: string; sku: string }[]>([])
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [newVariant, setNewVariant] = useState({ name: "", type: "color", value: "", price: "", stock: "0", sku: "" })
  const [selectedValues, setSelectedValues] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nameAr || !form.slug || !form.sku || !form.price || !form.categoryId) { setError("جميع الحقول المطلوبة"); return }
    setSaving(true); setError("")
    try {
      const payload = { ...form, name: form.nameAr, galleryImages, variants }
      const res = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (res.ok) {
        toast("تمت إضافة المنتج بنجاح", "success")
        onClose()
      } else { const d = await res.json(); setError(d.error || "خطأ") }
    } catch { setError("خطأ") }
    setSaving(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("folder", "products")
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    if (res.ok) { const { url } = await res.json(); setForm(f => ({ ...f, image: url })) }
    setUploading(false)
  }

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "products")
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (res.ok) { const { url } = await res.json(); setGalleryImages(prev => [...prev, { url, alt: file.name }]) }
    }
    setUploading(false)
    if (e.target) e.target.value = ""
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
              <Plus size={15} className="text-white" />
            </div>
            <h2 className="text-[15px] font-bold text-slate-900">{mode === "edit" ? "تعديل منتج" : "إضافة منتج جديد"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6">
          {error && <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl mb-4 border border-red-100">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الاسم بالعربي *</label>
                <input value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value, slug: form.slug || e.target.value.replace(/\s+/g, "-").toLowerCase()})} required className="input-premium" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الـ Slug *</label>
                <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} required className="input-premium" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">SKU * <span className="text-[10px] font-normal text-slate-400">(للربط مع المنصات)</span></label>
                <div className="flex gap-2">
                  <input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} placeholder="مثال: PRD-001" required className="input-premium flex-1" dir="ltr" />
                  <button type="button" onClick={() => setForm(f => ({...f, sku: `SKU-${Date.now().toString(36).toUpperCase().slice(-6)}`}))} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[12px] font-semibold rounded-xl transition-colors whitespace-nowrap">توليد</button>
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">التصنيف *</label>
                <select value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} required className="input-premium">
                  <option value="">اختر التصنيف</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">سعر التكلفة</label>
                <input type="number" value={form.costPrice} onChange={e => setForm({...form, costPrice: e.target.value})} className="input-premium" dir="ltr" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">سعر المنتج *</label>
                <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} required className="input-premium" dir="ltr" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">أقل سعر بيع</label>
                <input type="number" value={form.minPrice} onChange={e => setForm({...form, minPrice: e.target.value})} className="input-premium" dir="ltr" placeholder="للمستهلك" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">المخزون</label>
                <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="input-premium" dir="ltr" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الحالة</label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-premium">
                  <option value="ACTIVE">نشط</option><option value="INACTIVE">غير نشط</option><option value="ARCHIVED">مؤرشف</option><option value="OUT_OF_STOCK">نفد المخزون</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">صورة المنتج</label>
              <div className="flex items-center gap-3">
                {form.image ? (
                  <div className="relative">
                    <img src={form.image} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-100" />
                    <button type="button" onClick={() => setForm(f => ({ ...f, image: "" }))} className="absolute -top-1 -left-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"><X size={10} /></button>
                  </div>
                ) : (
                  <label className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors">
                    {uploading ? <Loader2 size={16} className="animate-spin text-indigo-500" /> : <Upload size={16} className="text-slate-400" />}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
                <span className="text-[11px] text-slate-400">ارفع صورة المنتج</span>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">صور إضافية للمنتج</label>
              <p className="text-[11px] text-slate-400 mb-2">يمكنك رفع أكثر من صورة مرة واحدة</p>
              {galleryImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {galleryImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img.url} alt={img.alt || ""} className="w-16 h-16 rounded-xl object-cover border border-slate-100" />
                      <button type="button" onClick={() => setGalleryImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -left-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
              <label className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-indigo-400 transition-colors bg-slate-50/50">
                {uploading ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <Upload size={14} className="text-slate-400" />}
                <span className="text-[12px] text-slate-500 font-medium">إضافة صور</span>
                <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} className="hidden" />
              </label>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
              <label className="text-[13px] font-semibold text-slate-700">ظهور المنتج للمسوقين</label>
              <div className={`w-10 h-6 rounded-full cursor-pointer transition-colors relative ${form.isVisible ? "bg-indigo-500" : "bg-slate-300"}`} onClick={() => setForm(f => ({ ...f, isVisible: !f.isVisible }))}>
                <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-transform ${form.isVisible ? "right-1" : "right-5"}`} />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الوصف بالعربي</label>
              <textarea value={form.descriptionAr} onChange={e => setForm({...form, descriptionAr: e.target.value})} rows={2} className="input-premium resize-none" />
            </div>
            <div className="card-premium p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[13px] font-semibold text-slate-700">المتغيرات (اختياري)</label>
                <button type="button" onClick={() => setShowVariantForm(!showVariantForm)} className="text-[12px] text-indigo-600 font-semibold hover:underline">
                  {showVariantForm ? "إخفاء" : "+ إضافة متغير"}
                </button>
              </div>
              {showVariantForm && (
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newVariant.type} onChange={e => {
                      const type = e.target.value
                      const nameMap: Record<string, string> = { color: "اللون", size: "المقاس", material: "المادة", other: "" }
                      setNewVariant({ ...newVariant, type, name: nameMap[type] || newVariant.name, value: "" })
                      setSelectedValues([])
                    }} className="input-premium text-[12px]">
                      <option value="color">🎨 ألوان</option><option value="size">📏 مقاسات</option><option value="material">🧶 مادة</option><option value="other">📝 أخرى</option>
                    </select>
                    <input value={newVariant.name} onChange={e => setNewVariant({ ...newVariant, name: e.target.value })} placeholder="الاسم (تلقائي)" className="input-premium text-[12px]" />
                  </div>
                  {(newVariant.type === "color" || newVariant.type === "size") && (
                    <div>
                      <p className="text-[10px] text-slate-400 mb-1.5">اضغط على العناصر المطلوبة (اختيار متعدد)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(newVariant.type === "color"
                          ? ["أبيض","أسود","أحمر","أزرق","أخضر","أصفر","برتقالي","وردي","بنفسجي","بني","رمادي","كحلي","بيج","ذهبي","فضي","نيلي","سماوي","زيتي","مرجاني","كريمي","ماروني","كاكاوي"]
                          : ["XXS","XS","S","M","L","XL","2XL","3XL","4XL","28","30","32","34","36","38","40","42","صغير","متوسط","كبير"]
                        ).map(val => {
                          const sel = selectedValues.includes(val)
                          if (newVariant.type === "color") {
                            const hex: Record<string, string> = { "أبيض":"#fff","أسود":"#000","أحمر":"#ef4444","أزرق":"#3b82f6","أخضر":"#22c55e","أصفر":"#eab308","برتقالي":"#f97316","وردي":"#ec4899","بنفسجي":"#a855f7","بني":"#92400e","رمادي":"#9ca3af","كحلي":"#1e3a5f","بيج":"#d4b896","ذهبي":"#d4a017","فضي":"#c0c0c0","نيلي":"#1e40af","سماوي":"#0ea5e9","زيتي":"#65a30d","مرجاني":"#f97316","كريمي":"#fde68a","ماروني":"#7f1d1d","كاكاوي":"#4a5568" }
                            const bg = hex[val] || "#6b7280"
                            return (
                              <button key={val} type="button" onClick={() => setSelectedValues(p => p.includes(val) ? p.filter(v => v !== val) : [...p, val])}
                                className={`w-7 h-7 rounded-md border-2 transition-all ${sel ? "border-indigo-500 shadow scale-110" : "border-slate-200 hover:border-slate-400"}`}
                                style={{ backgroundColor: bg }} title={val}>
                                {sel && <Check size={10} className="mx-auto" style={{ color: ["#fff","#fde68a","#d4b896"].includes(bg) ? "#333" : "#fff" }} />}
                              </button>
                            )
                          }
                          return (
                            <button key={val} type="button" onClick={() => setSelectedValues(p => p.includes(val) ? p.filter(v => v !== val) : [...p, val])}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border-2 transition-all ${sel ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                              {val}
                            </button>
                          )
                        })}
                      </div>
                      {selectedValues.length > 0 && <p className="text-[10px] text-indigo-600 font-semibold mt-1">مختار ({selectedValues.length}): {selectedValues.join("، ")}</p>}
                    </div>
                  )}
                  {newVariant.type !== "color" && newVariant.type !== "size" && (
                    <input value={newVariant.value} onChange={e => setNewVariant({ ...newVariant, value: e.target.value })} placeholder="القيمة" className="input-premium text-[12px]" />
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" value={newVariant.price} onChange={e => setNewVariant({ ...newVariant, price: e.target.value })} placeholder="السعر" className="input-premium text-[12px]" dir="ltr" />
                    <input type="number" value={newVariant.stock} onChange={e => setNewVariant({ ...newVariant, stock: e.target.value })} placeholder="المخزون لكل" className="input-premium text-[12px]" dir="ltr" />
                    <input value={newVariant.sku} onChange={e => setNewVariant({ ...newVariant, sku: e.target.value })} placeholder="SKU" className="input-premium text-[12px]" dir="ltr" />
                  </div>
                  <button type="button" onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const values = (newVariant.type === "color" || newVariant.type === "size") ? selectedValues : [newVariant.value]
                    if (values.length === 0) { setError("اختر عنصرًا واحدًا على الأقل"); return }
                    const nameMap: Record<string, string> = { color: "اللون", size: "المقاس", material: "المادة", other: "" }
                    const name = newVariant.name || nameMap[newVariant.type] || newVariant.type
                    const toAdd = values.map(v => ({ name, type: newVariant.type, value: v, price: newVariant.price, stock: newVariant.stock, sku: newVariant.sku }))
                    setVariants(prev => [...prev, ...toAdd])
                    setSelectedValues([])
                    setNewVariant({ name: newVariant.name, type: newVariant.type, value: "", price: "", stock: "0", sku: "" })
                    setError("")
                  }} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[13px] font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40"
                    disabled={(newVariant.type === "color" || newVariant.type === "size") ? selectedValues.length === 0 : !newVariant.value}>
                    + إضافة {(newVariant.type === "color" || newVariant.type === "size") && selectedValues.length > 0 ? `(${selectedValues.length})` : ""}
                  </button>
                </div>
              )}
              {variants.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {variants.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl">
                      <span className="text-[11px] text-indigo-700 font-medium px-1.5 py-0.5 bg-indigo-100 rounded">{v.type === "color" ? "لون" : v.type === "size" ? "مقاس" : v.type === "material" ? "مادة" : "أخرى"}</span>
                      <span className="text-[12px] font-semibold text-slate-800">{v.name}: {v.value}</span>
                      {v.price && <span className="text-[11px] text-slate-500 tabular-nums">{formatCurrency(parseFloat(v.price))}</span>}
                      <span className="text-[11px] text-slate-400">مخزون: {v.stock}</span>
                      <button type="button" onClick={() => setVariants(prev => prev.filter((_, idx) => idx !== i))} className="mr-auto p-0.5 text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-[14px] flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {saving ? "جاري الحفظ..." : mode === "edit" ? "حفظ التعديلات" : "إضافة المنتج"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
