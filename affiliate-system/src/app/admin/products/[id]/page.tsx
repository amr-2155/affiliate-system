"use client"
import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowRight, Loader2, Upload, X, Plus, Trash2, Image as ImageIcon, Package,
  Eye, EyeOff, Lock, Unlock, Users, Palette, Ruler, Save, Star, Check,
  FolderDown, ExternalLink, Link2,
} from "lucide-react"
import { formatCurrency, getStatusColor, getStatusText } from "@/lib/utils"
import { useToast } from "@/components/Toast"
import Link from "next/link"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"

interface Variant { id?: string; name: string; type: string; value: string; price?: string; stock: string; sku?: string; image?: string; isActive?: boolean }
interface GalleryImage { id?: string; url: string; alt?: string }

export default function AdminProductDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const perms = usePermissions()
  const can = perms.can
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [affiliates, setAffiliates] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<"basic" | "images" | "variants" | "settings">("basic")
  const mainImageRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const variantImageRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const [form, setForm] = useState({
    nameAr: "", slug: "", sku: "", descriptionAr: "",
    price: "", minPrice: "", costPrice: "", affiliateCostPrice: "", stock: "0", categoryId: "",
    image: "", status: "ACTIVE", isVisible: true,
    autoAssignReviewers: false, lockedToAffiliates: [] as string[],
    mediaUrl: "",
  })
  const [variants, setVariants] = useState<Variant[]>([])
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [newVariant, setNewVariant] = useState<Variant>({ name: "", type: "color", value: "", price: "", stock: "0", sku: "" })
  const [selectedValues, setSelectedValues] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/products/${id}`).then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
      fetch("/api/admin/affiliates").then(r => r.json()),
    ]).then(([prod, cats, affs]) => {
      if (prod?.id) {
        setProduct(prod)
        setForm({
          nameAr: prod.nameAr || "", slug: prod.slug || "",
          sku: prod.sku || "",
          descriptionAr: prod.descriptionAr || "",
          price: prod.price?.toString() || "", minPrice: prod.minPrice?.toString() || "", costPrice: prod.costPrice?.toString() || "", affiliateCostPrice: prod.affiliateCostPrice?.toString() || "",
          stock: prod.stock?.toString() || "0",
          categoryId: prod.categoryId || "", image: prod.image || "",
          status: prod.status || "ACTIVE", isVisible: prod.isVisible !== false,
          autoAssignReviewers: prod.autoAssignReviewers || false,
          lockedToAffiliates: prod.lockedToAffiliates ? JSON.parse(prod.lockedToAffiliates) : [],
          mediaUrl: prod.mediaUrl || "",
        })
        setVariants(prod.variants || [])
        setGallery(prod.galleryImages || [])
      }
      setCategories(Array.isArray(cats) ? cats : [])
      setAffiliates(Array.isArray(affs) ? affs : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    if (form.affiliateCostPrice) {
      const costP = parseFloat(form.costPrice) || 0
      const affCost = parseFloat(form.affiliateCostPrice) || 0
      const sellP = parseFloat(form.price) || 0
      if (affCost - costP < 0) { toast("ربح المنصة أقل من الصفر! عدّل الأسعار.", "error"); return }
      if (sellP - affCost < 0) { toast("عمولة المسوق أقل من الصفر! عدّل الأسعار.", "error"); return }
    }
    if (!form.sku.trim()) { toast("أدخل SKU للمنتج", "error"); return }
    setSaving(true)
    try {
      const payload = { ...form, name: form.nameAr, variants, galleryImages: gallery }
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) { toast("تم الحفظ", "success"); router.push("/admin/products") }
      else { const d = await res.json(); toast(d.error || "خطأ", "error") }
    } catch { toast("خطأ في الحفظ", "error") }
    setSaving(false)
  }

  const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      if (res.ok) { const { url } = await res.json(); setGallery(prev => [...prev, { url, alt: file.name }]) }
    }
    setUploading(false)
    if (galleryRef.current) galleryRef.current.value = ""
  }

  const handleVariantImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("folder", "products")
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    if (res.ok) { const { url } = await res.json(); const v = [...variants]; v[index] = { ...v[index], image: url }; setVariants(v) }
    setUploading(false)
  }

  const addVariant = () => {
    const values = newVariant.type === "color" || newVariant.type === "size" ? selectedValues : [newVariant.value]
    if (values.length === 0) return
    const nameMap: Record<string, string> = { color: "اللون", size: "المقاس", material: "المادة", other: "" }
    const name = newVariant.name || nameMap[newVariant.type] || newVariant.type
    const toAdd = values.map(v => ({ name, type: newVariant.type, value: v, price: newVariant.price, stock: newVariant.stock, sku: newVariant.sku }))
    setVariants(prev => [...prev, ...toAdd])
    setSelectedValues([])
    setNewVariant({ name: newVariant.name, type: newVariant.type, value: "", price: "", stock: "0", sku: "" })
  }

  const toggleValue = (val: string) => {
    setSelectedValues(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  const ALL_COLORS = ["أبيض","أسود","أحمر","أزرق","أخضر","أصفر","برتقالي","وردي","بنفسجي","بني","رمادي","كحلي","بيج","ذهبي","فضي","نيلي","سماوي","زيتي","مرجاني","كريمي","ماروني","كاكاوي"]
  const ALL_SIZES = ["XXS","XS","S","M","L","XL","2XL","3XL","4XL","28","29","30","31","32","33","34","36","38","40","42","صغير","متوسط","كبير","كبير جداً"]
  const COLOR_HEX: Record<string, string> = {
    "أبيض": "#fff", "أسود": "#000", "أحمر": "#ef4444", "أزرق": "#3b82f6", "أخضر": "#22c55e",
    "أصفر": "#eab308", "برتقالي": "#f97316", "وردي": "#ec4899", "بنفسجي": "#a855f7", "بني": "#92400e",
    "رمادي": "#9ca3af", "كحلي": "#1e3a5f", "بيج": "#d4b896", "ذهبي": "#d4a017", "فضي": "#c0c0c0",
    "نيلي": "#1e40af", "سماوي": "#0ea5e9", "زيتي": "#65a30d", "مرجاني": "#f97316", "كريمي": "#fde68a", "ماروني": "#7f1d1d", "كاكاوي": "#4a5568",
  }

  const removeVariant = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index))
  }

  const updateVariant = (index: number, field: string, value: string) => {
    const v = [...variants]; v[index] = { ...v[index], [field]: value }; setVariants(v)
  }

  const toggleAffiliateLock = (affiliateId: string) => {
    setForm(f => ({
      ...f,
      lockedToAffiliates: f.lockedToAffiliates.includes(affiliateId)
        ? f.lockedToAffiliates.filter(id => id !== affiliateId)
        : [...f.lockedToAffiliates, affiliateId],
    }))
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 rounded-xl animate-spin" style={{ border: "3px solid #e2e8f0", borderTopColor: "#3b82f6" }} /></div>
  if (!product?.id) return <div className="text-center py-16 text-slate-500">المنتج غير موجود</div>

  return (
    <RequirePerms perm="products.view">
    <div className="space-y-5 animate-fadeIn">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="p-2 rounded-xl hover:bg-white transition-colors text-slate-600"><ArrowRight size={20} /></Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">تعديل المنتج</h1>
            <p className="text-[12px] text-slate-500">{product.nameAr}</p>
          </div>
        </div>
        {can("products.update") && (
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 px-6">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            حفظ التعديلات
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200/60">
        {[
          { key: "basic", label: "البيانات الأساسية", icon: Package },
          { key: "images", label: "الصور", icon: ImageIcon },
          { key: "variants", label: "المتغيرات", icon: Palette },
          { key: "settings", label: "الإعدادات", icon: Lock },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all flex-1 justify-center
              ${activeTab === tab.key ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
            <tab.icon size={15} />{tab.label}
          </button>
        ))}
      </div>

      {/* Basic Info */}
      {activeTab === "basic" && (
        <div className="card-premium p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الاسم بالعربي *</label>
              <input value={form.nameAr} onChange={e => {
                const val = e.target.value
                setForm(f => ({ ...f, nameAr: val, slug: f.slug ? f.slug : val.replace(/\s+/g, "-").toLowerCase() }))
              }} className="input-premium" required />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الـ Slug *</label>
              <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="input-premium" dir="ltr" required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">SKU * <span className="text-[10px] font-normal text-slate-400">(للربط مع المنصات الخارجية مثل Easy Orders)</span></label>
              <div className="flex gap-2">
                <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="input-premium flex-1" dir="ltr" placeholder="مثال: PRD-001" required />
                <button type="button" onClick={() => setForm(f => ({ ...f, sku: `SKU-${Date.now().toString(36).toUpperCase().slice(-6)}` }))}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[12px] font-semibold rounded-lg transition-colors whitespace-nowrap">
                  توليد تلقائي
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">التصنيف *</label>
              <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="input-premium" required>
                <option value="">اختر التصنيف</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">سعر التكلفة الأساسي</label>
              <input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} className="input-premium" dir="ltr" />
              <p className="text-[10px] text-slate-400 mt-1">تكلفة المنتج عليك</p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">سعر المنتج *</label>
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="input-premium" dir="ltr" required />
              <p className="text-[10px] text-slate-400 mt-1">ربحك = سعر المنتج - التكلفة</p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">أقل سعر بيع للمستهلك</label>
              <input type="number" value={form.minPrice} onChange={e => setForm({ ...form, minPrice: e.target.value })} className="input-premium" dir="ltr" placeholder="سعر البيع للمستهلك" />
              <p className="text-[10px] text-slate-400 mt-1">ربح المسوق = أقل سعر - سعر المنتج</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">سعر تكلفة المسوق</label>
              <input type="number" value={form.affiliateCostPrice} onChange={e => setForm({ ...form, affiliateCostPrice: e.target.value })} className="input-premium" dir="ltr" placeholder="سعر بيع المنتج للمسوق" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">المخزون</label>
              <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="input-premium" dir="ltr" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الحالة</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input-premium">
                <option value="ACTIVE">نشط</option><option value="INACTIVE">غير نشط</option><option value="ARCHIVED">مؤرشف</option><option value="OUT_OF_STOCK">نفد المخزون</option>
              </select>
            </div>
          </div>
          {/* Live Pricing Calculation */}
          {(() => {
            const costP = parseFloat(form.costPrice) || 0
            const sellP = parseFloat(form.price) || 0
            const minP = parseFloat(form.minPrice) || 0
            const systemProfit = sellP - costP
            const affiliateProfit = minP - sellP
            const hasMinPrice = form.minPrice !== ""
            if (!sellP && !hasMinPrice) return null
            return (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                <p className="text-[12px] font-bold text-slate-700 mb-2">حساب الأرباح الشفاف</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg border ${systemProfit < 0 ? "border-red-300 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <p className="text-[11px] text-slate-500">ربح المنصة (أنت)</p>
                    <p className={`text-lg font-extrabold ${systemProfit < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(systemProfit)}</p>
                    <p className="text-[10px] text-slate-400">{sellP} - {costP}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${affiliateProfit < 0 ? "border-red-300 bg-red-50" : "border-indigo-200 bg-indigo-50"}`}>
                    <p className="text-[11px] text-slate-500">ربح المسوق (أقل عمولة)</p>
                    <p className={`text-lg font-extrabold ${affiliateProfit < 0 ? "text-red-600" : "text-indigo-600"}`}>{formatCurrency(affiliateProfit)}</p>
                    <p className="text-[10px] text-slate-400">{minP} - {sellP}</p>
                  </div>
                </div>
                {(systemProfit < 0 || affiliateProfit < 0) && (
                  <div className="flex items-center gap-2 text-[12px] font-semibold text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    <span>⚠️</span>
                    <span>{systemProfit < 0 ? "ربح المنصة أقل من الصفر! " : ""}{affiliateProfit < 0 ? "ربح المسوق أقل من الصفر!" : ""}</span>
                  </div>
                )}
              </div>
            )
          })()}
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الوصف بالعربي</label>
            <textarea value={form.descriptionAr} onChange={e => setForm({ ...form, descriptionAr: e.target.value })} rows={3} className="input-premium" />
          </div>

          {/* Product Media URL */}
          <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/50 to-fuchsia-50/30 p-5 space-y-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #8b5cf6, #a78bfa)" }}>
                <FolderDown size={17} className="text-white" />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-slate-700">رابط ميديا المنتج</h3>
                <p className="text-[11px] text-slate-400">ضع هنا رابط الصور والفيديوهات والملفات التسويقية التي تريد إتاحتها للمسوق.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.mediaUrl}
                  onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))}
                  placeholder="https://drive.google.com/..."
                  dir="ltr"
                  className="input-premium pr-9 text-[13px]"
                />
              </div>
              {form.mediaUrl && (
                <a
                  href={form.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-700 text-[12px] font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <ExternalLink size={13} />
                  معاينة الرابط
                </a>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">أضف رابط الصور أو الفيديوهات أو الملفات التسويقية الخاصة بهذا المنتج ليتمكن المسوق من الوصول إليها.</p>
          </div>
        </div>
      )}

      {/* Images Tab */}
      {activeTab === "images" && (
        <div className="space-y-5">
          {/* Main Image */}
          <div className="card-premium p-5">
            <h3 className="text-[13px] font-bold text-slate-500 mb-3 uppercase tracking-wider">الصورة الأساسية</h3>
            <p className="text-[11px] text-slate-400 mb-3">الأبعاد المثالية: 318 × 288 بكسل</p>
            <div className="flex items-start gap-5">
              {form.image ? (
                <div className="relative">
                  <img src={form.image} alt="" className="w-40 h-36 rounded-xl object-cover border-2 border-slate-200" />
                  <button onClick={() => setForm(f => ({ ...f, image: "" }))} className="absolute -top-2 -left-2 p-1 bg-red-500 text-white rounded-lg"><X size={12} /></button>
                </div>
              ) : (
                <label className="w-40 h-36 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
                  {uploading ? <Loader2 size={24} className="animate-spin text-blue-500" /> : <><Upload size={24} className="text-slate-400" /><span className="text-[11px] text-slate-400 mt-1">ارفع الصورة</span></>}
                  <input ref={mainImageRef} type="file" accept="image/*" onChange={handleMainImageUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Gallery */}
          <div className="card-premium p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">صور المنتج الإضافية</h3>
              <label className="btn-primary text-[12px] px-4 py-2 flex items-center gap-2 cursor-pointer">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                إضافة صور
                <input ref={galleryRef} type="file" accept="image/*" multiple onChange={handleGalleryUpload} className="hidden" />
              </label>
            </div>
            {gallery.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                <ImageIcon size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-400 text-[13px]">لا توجد صور إضافية</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {gallery.map((img, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden aspect-square">
                    <img src={img.url} alt={img.alt || ""} className="w-full h-full object-cover" />
                    <button onClick={() => setGallery(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-2 left-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Variants Tab */}
      {activeTab === "variants" && (
        <div className="space-y-5">
          {/* Add Variant Form */}
          <div className="card-premium p-5">
            <h3 className="text-[13px] font-bold text-slate-500 mb-4 uppercase tracking-wider">إضافة متغيرات جديدة</h3>
            <div className="grid grid-cols-2 gap-3">
              <select value={newVariant.type} onChange={e => {
                const type = e.target.value
                const nameMap: Record<string, string> = { color: "اللون", size: "المقاس", material: "المادة", other: "" }
                setNewVariant({ ...newVariant, type, name: nameMap[type] || newVariant.name, value: "" })
                setSelectedValues([])
              }} className="input-premium text-[13px]">
                <option value="color">🎨 ألوان</option><option value="size">📏 مقاسات</option><option value="material">🧶 مادة</option><option value="other">📝 أخرى</option>
              </select>
              <input value={newVariant.name} onChange={e => setNewVariant({ ...newVariant, name: e.target.value })} placeholder="الاسم (تلقائي)" className="input-premium text-[13px]" />
            </div>
            {(newVariant.type === "color" || newVariant.type === "size") && (
              <div className="mt-3">
                <p className="text-[11px] text-slate-400 mb-2">اضغط على العناصر المطلوبة (يمكن اختيار أكثر من واحد)</p>
                <div className="flex flex-wrap gap-2">
                  {(newVariant.type === "color" ? ALL_COLORS : ALL_SIZES).map(val => {
                    const sel = selectedValues.includes(val)
                    if (newVariant.type === "color") {
                      const bg = COLOR_HEX[val] || "#6b7280"
                      const isLight = ["#fff", "#fde68a", "#d4b896"].includes(bg)
                      return (
                        <button key={val} type="button" onClick={() => toggleValue(val)}
                          className={`relative w-9 h-9 rounded-lg border-2 transition-all ${sel ? "border-blue-500 shadow-md scale-110" : "border-slate-200 hover:border-slate-400"}`}
                          style={{ backgroundColor: bg }}>
                          {sel && <Check size={12} className="absolute inset-0 m-auto" style={{ color: isLight ? "#333" : "#fff" }} />}
                        </button>
                      )
                    }
                    return (
                      <button key={val} type="button" onClick={() => toggleValue(val)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border-2 transition-all ${sel ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                        {val}
                      </button>
                    )
                  })}
                </div>
                {selectedValues.length > 0 && (
                  <p className="text-[11px] text-blue-600 font-semibold mt-2">مختار: {selectedValues.join("، ")}</p>
                )}
              </div>
            )}
            {newVariant.type !== "color" && newVariant.type !== "size" && (
              <input value={newVariant.value} onChange={e => setNewVariant({ ...newVariant, value: e.target.value })} placeholder="القيمة" className="input-premium text-[13px] mt-3" />
            )}
            <div className="grid grid-cols-3 gap-3 mt-3">
              <input type="number" value={newVariant.price} onChange={e => setNewVariant({ ...newVariant, price: e.target.value })} placeholder="السعر (اختياري)" className="input-premium text-[13px]" dir="ltr" />
              <input type="number" value={newVariant.stock} onChange={e => setNewVariant({ ...newVariant, stock: e.target.value })} placeholder="المخزون لكل واحد" className="input-premium text-[13px]" dir="ltr" />
              <input value={newVariant.sku || ""} onChange={e => setNewVariant({ ...newVariant, sku: e.target.value })} placeholder="SKU" className="input-premium text-[13px]" dir="ltr" />
            </div>
            <button onClick={addVariant} disabled={newVariant.type === "color" || newVariant.type === "size" ? selectedValues.length === 0 : !newVariant.value}
              className="btn-primary text-[13px] w-full mt-3 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              <Plus size={14} /> إضافة {selectedValues.length > 0 ? `(${selectedValues.length})` : ""}
            </button>
          </div>

          {/* Variants List */}
          <div className="card-premium p-5">
            <h3 className="text-[13px] font-bold text-slate-500 mb-4 uppercase tracking-wider">المتغيرات الحالية ({variants.length})</h3>
            {variants.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                <Palette size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="text-slate-400 text-[13px]">لا توجد متغيرات بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {variants.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    {v.image ? (
                      <img src={v.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <label className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-300 transition-colors">
                        <Upload size={14} className="text-slate-400" />
                        <input ref={el => { variantImageRefs.current[i] = el }} type="file" accept="image/*" onChange={e => handleVariantImageUpload(i, e)} className="hidden" />
                      </label>
                    )}
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input value={v.name} onChange={e => updateVariant(i, "name", e.target.value)} className="input-premium text-[12px] py-1.5" placeholder="الاسم" />
                      <input value={v.value} onChange={e => updateVariant(i, "value", e.target.value)} className="input-premium text-[12px] py-1.5" placeholder="القيمة" />
                      <input type="number" value={v.stock} onChange={e => updateVariant(i, "stock", e.target.value)} className="input-premium text-[12px] py-1.5" dir="ltr" placeholder="المخزون" />
                      <input type="number" value={v.price || ""} onChange={e => updateVariant(i, "price", e.target.value)} className="input-premium text-[12px] py-1.5" dir="ltr" placeholder="السعر" />
                    </div>
                    <div className="flex items-center gap-1">
                      <select value={v.type} onChange={e => updateVariant(i, "type", e.target.value)} className="input-premium text-[11px] py-1.5 w-20">
                        <option value="color">لون</option><option value="size">مقاس</option><option value="material">مادة</option><option value="other">أخرى</option>
                      </select>
                      <button onClick={() => removeVariant(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-5">
          {/* Visibility */}
          <div className="card-premium p-5">
            <h3 className="text-[13px] font-bold text-slate-500 mb-4 uppercase tracking-wider">إعدادات الظهور</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  {form.isVisible ? <Eye size={18} className="text-emerald-500" /> : <EyeOff size={18} className="text-red-500" />}
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">ظهور المنتج</p>
                    <p className="text-[11px] text-slate-500">{form.isVisible ? "المنتج ظاهر للمسوقين" : "المنتج مخفي عن المسوقين"}</p>
                  </div>
                </div>
                <div className={`w-12 h-7 rounded-full transition-colors relative ${form.isVisible ? "bg-emerald-500" : "bg-slate-300"}`} onClick={() => setForm(f => ({ ...f, isVisible: !f.isVisible }))}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-transform ${form.isVisible ? "right-1" : "right-6"}`} />
                </div>
              </label>

              <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3">
                  <Star size={18} className={form.autoAssignReviewers ? "text-amber-500" : "text-slate-400"} />
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">التعيين التلقائي للمراجعين</p>
                    <p className="text-[11px] text-slate-500">تعيين مراجعين تلقائياً لهذا المنتج</p>
                  </div>
                </div>
                <div className={`w-12 h-7 rounded-full transition-colors relative ${form.autoAssignReviewers ? "bg-amber-500" : "bg-slate-300"}`} onClick={() => setForm(f => ({ ...f, autoAssignReviewers: !f.autoAssignReviewers }))}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-transform ${form.autoAssignReviewers ? "right-1" : "right-6"}`} />
                </div>
              </label>
            </div>
          </div>

          {/* Lock to Affiliates */}
          <div className="card-premium p-5">
            <h3 className="text-[13px] font-bold text-slate-500 mb-3 uppercase tracking-wider flex items-center gap-2">
              <Lock size={15} /> قفل المنتج لمسوقين محددين
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">اترك القائمة فارغة ليكون متاحاً للجميع، أو اختر مسوقين محددين</p>
            {affiliates.length === 0 ? (
              <p className="text-[13px] text-slate-400">لا يوجد مسوقين</p>
            ) : (
              <div className="space-y-2">
                {affiliates.map((a: any) => (
                  <label key={a.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${form.lockedToAffiliates.includes(a.id) ? "bg-blue-50 border border-blue-200" : "bg-slate-50 hover:bg-slate-100 border border-transparent"}`}>
                    <input
                      type="checkbox"
                      checked={form.lockedToAffiliates.includes(a.id)}
                      onChange={() => toggleAffiliateLock(a.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
                      {a.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800">{a.name}</p>
                      <p className="text-[11px] text-slate-500">{a.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </RequirePerms>
  )
}
