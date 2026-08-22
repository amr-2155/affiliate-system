"use client"
import { useEffect, useState } from "react"
import { Plus, Trash2, Loader2, Tag } from "lucide-react"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import { useToast } from "@/components/Toast"
import ConfirmDialog from "@/components/ConfirmDialog"

export default function AdminCategoriesPage() {
  const perms = usePermissions()
  const can = perms.can
  const { toast } = useToast()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: "", nameAr: "", slug: "", icon: "" })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = () => {
    setLoading(true)
    fetch("/api/categories").then(r => r.json()).then(d => {
      setCategories(Array.isArray(d) ? d : []); setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.nameAr || !form.slug) return
    setSaving(true)
    const res = await fetch("/api/admin/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    if (res.ok) {
      toast("تمت إضافة التصنيف بنجاح", "success")
      setForm({ name: "", nameAr: "", slug: "", icon: "" })
    } else {
      const d = await res.json()
      toast(d.error || "تعذر إضافة التصنيف", "error")
    }
    setSaving(false)
    fetchData()
  }

  const handleDelete = async (id: string) => {
    setDeleting(true)
    const res = await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" })
    if (res.ok) {
      toast("تم حذف التصنيف بنجاح", "success")
    } else {
      const d = await res.json()
      toast(d.error || "تعذر حذف التصنيف", "error")
    }
    setDeleting(false)
    setDeleteTarget(null)
    fetchData()
  }

  return (
    <RequirePerms perm="categories.view">
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4f46e5, #818cf8)" }}>
          <Tag size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">إدارة التصنيفات</h1>
          <p className="text-[12px] text-slate-500">{loading ? "جاري التحميل..." : `${categories.length} تصنيف في المتجر`}</p>
        </div>
      </div>

      {can("categories.create") && (
        <div className="card-premium p-5">
          <h3 className="text-[14px] font-bold text-slate-800 mb-3">إضافة تصنيف جديد</h3>
          <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
            <input value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} placeholder="الاسم بالعربي *" required className="input-premium flex-1" />
            <input value={form.name} onChange={e => { setForm({...form, name: e.target.value}); if (!form.slug) setForm(f => ({...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")})) }} placeholder="الاسم بالإنجليزي *" required className="input-premium flex-1" dir="ltr" />
            <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} placeholder="Slug *" required className="input-premium sm:w-36" dir="ltr" />
            <input value={form.icon} onChange={e => setForm({...form, icon: e.target.value})} placeholder="أيقونة" className="input-premium sm:w-20 text-center" />
            <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-2 px-5 text-[13px] disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {saving ? "جاري..." : "إضافة"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card-premium p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="w-24 h-3 bg-slate-100 rounded-lg" />
                  <div className="w-16 h-2 bg-slate-100 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Tag size={32} className="text-slate-300" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">لا توجد تصنيفات</p>
          <p className="text-slate-400 text-sm">أضف أول تصنيف لتنظيم منتجاتك</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl shrink-0">
                  {c.icon || "📁"}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{c.nameAr}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{c.name} · {c._count?.products || 0} منتج</p>
                </div>
              </div>
              {can("categories.delete") && (
                <button onClick={() => setDeleteTarget(c)} disabled={deleting} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                  {deleting && deleteTarget?.id === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id) }}
        title="حذف التصنيف"
        message={`هل أنت متأكد من حذف تصنيف «${deleteTarget?.nameAr}»؟`}
        confirmText="حذف"
      />
    </div>
    </RequirePerms>
  )
}
