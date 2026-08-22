"use client"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FolderOpen, Loader2, Trash2, Eye, Wand2, Package, AlertCircle, PlusCircle } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { strategyToText, type GeneratedStrategy } from "@/lib/strategy"
import EmptyState from "@/components/EmptyState"
import Skeleton from "@/components/Skeleton"
import CopyButton from "@/components/CopyButton"
import ConfirmDialog from "@/components/ConfirmDialog"
import BottomSheet from "@/components/BottomSheet"
import StrategyPlan from "@/components/StrategyPlan"
import { useToast } from "@/components/Toast"

interface SavedStrategy {
  id: string
  title: string
  scenario: string
  content: string
  productSnapshot: string
  createdAt: string
  updatedAt: string
  product: { id: string; nameAr: string; name: string; price: number; image: string | null; category?: { nameAr: string } | null } | null
}

function parsePlan(s: SavedStrategy): GeneratedStrategy | null {
  try {
    const parsed = JSON.parse(s.content)
    if (parsed && Array.isArray(parsed.sections)) return parsed as GeneratedStrategy
  } catch {}
  return null
}

export default function StrategiesPage() {
  const { toast } = useToast()
  const [list, setList] = useState<SavedStrategy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [viewing, setViewing] = useState<SavedStrategy | null>(null)
  const [deleting, setDeleting] = useState<SavedStrategy | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch("/api/strategies")
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error)
        setList(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const doDelete = async () => {
    if (!deleting) return
    setDeletingId(deleting.id)
    try {
      const res = await fetch(`/api/strategies/${deleting.id}`, { method: "DELETE" })
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error || "فشل الحذف")
      setList((prev) => prev.filter((s) => s.id !== deleting.id))
      setDeleting(null)
      toast("تم حذف الاستراتيجية", "success")
    } catch {
      toast("تعذر حذف الاستراتيجية", "error")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #6366f1)" }}>
            <FolderOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">استراتيجياتي</h1>
            <p className="text-[12px] text-slate-500">خططك التسويقية المحفوظة لكل منتج</p>
          </div>
        </div>
        <Link
          href="/products"
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-violet-600 to-indigo-600 text-white rounded-xl text-[12px] font-bold shadow-sm hover:shadow-md transition-all"
        >
          <PlusCircle size={15} />
          استراتيجية جديدة
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card-premium p-4 space-y-3">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={26} className="text-red-400" />
          </div>
          <p className="text-[14px] font-semibold text-slate-700 mb-3">تعذر تحميل الاستراتيجيات</p>
          <button onClick={load} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[13px] font-semibold hover:bg-indigo-700 transition-colors">
            إعادة المحاولة
          </button>
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Wand2 size={28} className="text-violet-400" />}
          title="لا توجد استراتيجيات محفوظة بعد"
          subtitle="افتح أي منتج واضغط «أنشئ خطة تسويق» لتوليد خطة كاملة، أو ابدأ من صفحة المنتجات مباشرة."
          action={
            <Link href="/products" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-l from-violet-600 to-indigo-600 text-white rounded-xl text-[13px] font-bold hover:shadow-lg transition-all">
              <Package size={15} />
              تصفح المنتجات
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((s) => {
            const plan = parsePlan(s)
            const snapshot = (() => {
              try {
                const p = JSON.parse(s.productSnapshot)
                return p && typeof p === "object" ? p : null
              } catch { return null }
            })()
            const image = s.product?.image || snapshot?.image
            const price = s.product?.price ?? snapshot?.price
            return (
              <div key={s.id} className="card-premium overflow-hidden flex flex-col">
                <button onClick={() => setViewing(s)} className="block relative group">
                  <div className="aspect-[16/10] bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">
                    {image ? (
                      <img src={image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={34} className="text-slate-300" />
                      </div>
                    )}
                  </div>
                  <span className="absolute top-3 right-3 text-[10px] font-bold text-white bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg">
                    {s.scenario === "conservative" ? "متحفظ" : s.scenario === "optimistic" ? "متفائل" : "واقعي"}
                  </span>
                </button>
                <div className="p-4 flex flex-col flex-1">
                  <p className="text-[13px] font-bold text-slate-800 line-clamp-2 min-h-[36px] leading-relaxed">{s.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {s.product?.nameAr || snapshot?.nameAr || ""} · {formatDate(s.updatedAt)}
                    {typeof price === "number" && <span className="tabular-nums"> · {price.toLocaleString("ar-EG")} ج.م</span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setViewing(s)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <Eye size={13} /> فتح الخطة
                    </button>
                    {plan ? (
                      <CopyButton text={strategyToText(plan)} label="نسخ" className="bg-slate-50 text-slate-600 hover:bg-slate-100" />
                    ) : null}
                    <button
                      onClick={() => setDeleting(s)}
                      disabled={deletingId === s.id}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label="حذف"
                    >
                      {deletingId === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* View plan */}
      <BottomSheet
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title || "الاستراتيجية"}
        icon={Wand2}
        tint="#7c3aed"
        maxWidth="max-w-2xl"
      >
        {viewing && parsePlan(viewing) ? (
          <StrategyPlan strategy={parsePlan(viewing)!} />
        ) : (
          <div className="text-center py-14">
            <AlertCircle size={30} className="text-slate-300 mx-auto mb-3" />
            <p className="text-[13px] text-slate-500">تعذر عرض محتوى هذه الخطة</p>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="حذف الاستراتيجية"
        message={`هل أنت متأكد من حذف «${deleting?.title || ""}»؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
      />
    </div>
  )
}
