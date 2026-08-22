"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import {
  ShoppingCart, Trash2, Plus, Minus, Package, ArrowRight, Loader2, MapPin,
  Phone, User, Mail, FileText, Link as LinkIcon, Edit2, Check, X, Shield, Truck,
  Clock, ChevronDown, Search as SearchIcon, History, AlertCircle, CheckCircle2,
  Eye, BadgePercent, Banknote, Info, ChevronUp, Wallet,
} from "lucide-react"
import { useAppStore } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"
import { getCitySuggestions } from "@/lib/egypt-cities"
import Link from "next/link"
import { useToast } from "@/components/Toast"

interface ShippingRate {
  governorate: string
  rate: number
  freeAbove: number | null
  estimatedDays: number
}

interface CartForm {
  customerName: string
  customerPhone: string
  customerEmail: string
  customerAddress: string
  customerCity: string
  customerGovernorate: string
  notes: string
}

interface OrderLike {
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  customerAddress: string
  customerCity: string
  customerGovernorate?: string | null
}

const EMPTY_FORM: CartForm = {
  customerName: "", customerPhone: "", customerEmail: "",
  customerAddress: "", customerCity: "", customerGovernorate: "", notes: "",
}

const PHONE_RE = /^01[0125]\d{8}$/

function cleanPhone(p: string) {
  return p.replace(/[\s\-()]/g, "")
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="flex items-center gap-1 text-[11px] font-medium text-red-500 mt-1.5 animate-slide-in">
      <AlertCircle size={12} className="shrink-0" />
      {msg}
    </p>
  )
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-0.5 text-[12px] font-semibold text-slate-600 mb-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      <FieldError msg={error} />
    </div>
  )
}

export default function CartPage() {
  const cart = useAppStore((s) => s.cart)
  const addToCart = useAppStore((s) => s.addToCart)
  const removeFromCart = useAppStore((s) => s.removeFromCart)
  const updateCartQuantity = useAppStore((s) => s.updateCartQuantity)
  const updateCartPrice = useAppStore((s) => s.updateCartPrice)
  const clearCart = useAppStore((s) => s.clearCart)
  const cartSubtotal = useAppStore((s) => s.cartSubtotal)
  const { toast } = useToast()

  const [form, setForm] = useState<CartForm>(EMPTY_FORM)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([])
  const [ratesLoading, setRatesLoading] = useState(true)
  const [editingPrice, setEditingPrice] = useState<string | null>(null)
  const [editPriceValue, setEditPriceValue] = useState("")
  const [expandedSummary, setExpandedSummary] = useState(false)
  const [govOpen, setGovOpen] = useState(false)
  const [govSearch, setGovSearch] = useState("")
  const [prefill, setPrefill] = useState<{ loading: boolean; msg: string | null; tone: "success" | "error" | "info" }>({ loading: false, msg: null, tone: "info" })
  const govRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (govRef.current && !govRef.current.contains(e.target as Node)) setGovOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  useEffect(() => {
    fetch("/api/shipping")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setShippingRates(d) })
      .catch(() => {})
      .finally(() => setRatesLoading(false))
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("recreate-order")
      if (!raw) return
      localStorage.removeItem("recreate-order")
      const entries = JSON.parse(raw) as { productId: string; quantity: number }[]
      if (!Array.isArray(entries) || entries.length === 0) return
      fetch("/api/products?limit=100&status=ACTIVE")
        .then((r) => r.json())
        .then((d) => {
          const products = (d.products || []) as Array<{
            id: string
            name: string
            nameAr: string
            price: number
            image?: string
            stock: number
            minPrice?: number | null
            affiliateCostPrice?: number | null
          }>
          for (const entry of entries) {
            const p = products.find((pr) => pr.id === entry.productId)
            if (!p) continue
            addToCart({
              productId: p.id,
              nameAr: p.nameAr,
              name: p.name,
              price: p.price,
              image: p.image,
              stock: p.stock ?? 999,
              minPrice: p.minPrice ?? null,
              affiliateCostPrice: p.affiliateCostPrice ?? null,
            }, entry.quantity || 1)
          }
          toast("تمت إعادة إنشاء الطلب في العربة", "success")
        })
        .catch(() => {})
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("checkout-draft")
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved && typeof saved === "object" && saved.customerName) {
        setForm((f) => ({ ...f, ...saved }))
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (cart.length === 0) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem("checkout-draft", JSON.stringify(form))
      } catch { /* ignore */ }
    }, 400)
    return () => clearTimeout(t)
  }, [form, cart.length])

  const [preview, setPreview] = useState<any>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (cart.length === 0) { setPreview(null); return }
    setPreviewLoading(true)
    const t = setTimeout(() => {
      fetch("/api/orders/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.customPrice !== undefined && i.customPrice !== null ? i.customPrice : i.price,
          })),
          customerGovernorate: form.customerGovernorate,
          customerCity: form.customerCity,
        }),
      })
        .then((r) => r.json())
        .then((d) => { if (!d.error) setPreview(d) })
        .catch(() => {})
        .finally(() => setPreviewLoading(false))
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, form.customerGovernorate, form.customerCity])

  const selectedRate = shippingRates.find((r) => r.governorate === form.customerGovernorate)
  const subtotal = preview?.subtotal ?? cartSubtotal()
  const shippingCost = selectedRate ? (preview?.shippingCost ?? selectedRate.rate) : 0
  const total = selectedRate ? (preview?.total ?? subtotal + shippingCost) : subtotal + shippingCost
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0)

  const commission = preview?.commission ?? 0
  const hasCommissionItems = commission > 0
  const previewItems = preview?.items || []

  const citySuggestions = useMemo(() => getCitySuggestions(form.customerGovernorate), [form.customerGovernorate])

  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    if (!form.customerName.trim()) e.customerName = "اسم العميل مطلوب"
    const ph = cleanPhone(form.customerPhone)
    if (!ph) e.customerPhone = "رقم الهاتف مطلوب"
    else if (!PHONE_RE.test(ph)) e.customerPhone = "رقم غير صحيح — أدخل 11 رقمًا يبدأ بـ 01"
    if (!form.customerGovernorate) e.customerGovernorate = "اختر المحافظة"
    if (!form.customerCity.trim()) e.customerCity = "المدينة / المنطقة مطلوبة"
    if (!form.customerAddress.trim()) e.customerAddress = "العنوان بالتفصيل مطلوب"
    if (form.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) e.customerEmail = "البريد الإلكتروني غير صحيح"
    return e
  }, [form])
  const isFormValid = Object.keys(errors).length === 0
  const fieldError = (key: string) => (touched[key] ? errors[key] : undefined)

  const markTouched = () => setTouched({ customerName: true, customerPhone: true, customerGovernorate: true, customerCity: true, customerAddress: true, customerEmail: true })

  const filteredGovs = govSearch.trim()
    ? shippingRates.filter((r) => r.governorate.startsWith(govSearch.trim()) || r.governorate.includes(govSearch.trim()))
    : shippingRates

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const setField = (key: keyof CartForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const selectGov = (gov: string) => {
    setForm((f) => {
      const suggestions = getCitySuggestions(gov)
      const city = suggestions.length && f.customerCity && !suggestions.includes(f.customerCity) ? "" : f.customerCity
      return { ...f, customerGovernorate: gov, customerCity: city }
    })
    setGovOpen(false)
  }

  const startEditPrice = (key: string, currentPrice: number) => {
    setEditingPrice(key)
    setEditPriceValue(currentPrice.toString())
  }

  const saveEditPrice = (productId: string, variantId?: string) => {
    const val = parseFloat(editPriceValue)
    if (!isNaN(val) && val >= 0) {
      updateCartPrice(productId, val, variantId)
      toast("تم تعديل السعر", "success")
    }
    setEditingPrice(null)
  }

  const loadLastCustomer = async () => {
    setPrefill({ loading: true, msg: null, tone: "info" })
    try {
      const res = await fetch("/api/orders?limit=10")
      const data = await res.json()
      const orders = Array.isArray(data?.orders)
        ? (data.orders as Array<Partial<OrderLike>>)
        : []
      const last = orders.find((o) => o.customerName && o.customerPhone)
      if (!last) {
        setPrefill({ loading: false, msg: "لا توجد طلبات سابقة لتعبئة بيانات العميل", tone: "info" })
        return
      }
      setForm({
        customerName: last.customerName || "",
        customerPhone: last.customerPhone || "",
        customerEmail: last.customerEmail || "",
        customerAddress: last.customerAddress || "",
        customerCity: last.customerCity || "",
        customerGovernorate: last.customerGovernorate || "",
        notes: "",
      })
      setTouched({})
      setPrefill({ loading: false, msg: "تمت تعبئة بيانات آخر عميل", tone: "success" })
    } catch {
      setPrefill({ loading: false, msg: "تعذر تحميل بيانات آخر عميل", tone: "error" })
    }
  }

  useEffect(() => {
    if (!prefill.msg) return
    const t = setTimeout(() => setPrefill((p) => ({ ...p, msg: null })), 4000)
    return () => clearTimeout(t)
  }, [prefill.msg])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) return
    if (!isFormValid) {
      markTouched()
      const first = Object.keys(errors)[0]
      toast(errors[first] || "أكمل البيانات المطلوبة", "error")
      scrollTo("customer-section")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            variantId: i.variantId,
            unitPrice: i.customPrice !== undefined ? i.customPrice : i.price,
          })),
        }),
      })
      if (res.ok) {
        clearCart()
        try { localStorage.removeItem("checkout-draft") } catch { /* ignore */ }
        toast("تم إنشاء الطلب بنجاح", "success")
        window.location.href = "/orders"
      } else {
        const data = await res.json()
        toast(data.error || "حدث خطأ", "error")
      }
    } catch {
      toast("حدث خطأ في الاتصال", "error")
    } finally {
      setSubmitting(false)
    }
  }

  if (cart.length === 0) {
    return (
      <div className="space-y-6">
        <style>{`#cart-page ~ footer { display: none }`}</style>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">العربة</h1>
        </div>
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-20 h-20 rounded-full bg-gradient-to-b from-blue-50 to-indigo-50 flex items-center justify-center mx-auto mb-5 border border-blue-100">
            <ShoppingCart size={36} className="text-blue-300" />
          </div>
          <p className="text-slate-900 font-semibold text-lg mb-1">العربة فاضية</p>
          <p className="text-slate-400 text-sm mb-3">لم تقم بإضافة أي منتجات بعد</p>
          <p className="text-slate-400 text-xs mb-8">أضف منتجات من المتجر ثم عُد هنا لإتمام الطلب خلال دقيقة</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-6">
            <Link href="/products" className="btn-primary inline-flex items-center gap-2 px-6 py-3">
              <span>تصفح المنتجات</span>
              <ArrowRight size={16} />
            </Link>
            <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              العودة للوحة التحكم
            </Link>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-8">
            <Info size={12} />
            <span>اختر المنتج، حدد الكمية، ثم أكمل بيانات العميل</span>
          </div>
        </div>
      </div>
    )
  }

  const customerDone = isFormValid
  const stepsDone = [true, customerDone, false, false]
  const activeStep = stepsDone.findIndex((d) => !d)
  const steps = [
    { label: "المنتجات", icon: ShoppingCart, onClick: () => {} },
    { label: "بيانات العميل", icon: User, onClick: () => scrollTo("customer-section") },
    { label: "المراجعة", icon: Eye, onClick: () => scrollTo("summary-section") },
    { label: "التأكيد", icon: CheckCircle2, onClick: () => scrollTo("submit-section") },
  ]

  return (
    <div id="cart-page" className="space-y-6 pb-24 lg:pb-0">
      <style>{`#cart-page ~ footer { display: none }`}</style>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">إتمام الطلب</h1>
          <p className="text-sm text-slate-500 mt-1">
            <span className="font-semibold text-slate-700">{itemCount}</span> منتج في العربة
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/products"
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors font-medium">
            <LinkIcon size={14} /> إضافة
          </Link>
          <button onClick={() => { clearCart(); toast("تم تفريغ العربة", "info") }}
            className="text-sm text-red-500 hover:text-red-600 transition-colors px-3 py-2 rounded-lg hover:bg-red-50 font-medium">
            تفريغ
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4">
        <ol className="grid grid-cols-4">
          {steps.map((step, i) => {
            const isDone = stepsDone[i]
            const isActive = i === activeStep
            const Icon = step.icon
            return (
              <li key={step.label} className="relative">
                {i > 0 && (
                  <span className={`absolute top-4 right-[calc(50%+16px)] left-[calc(-50%+16px)] h-0.5 -z-0 hidden sm:block ${isDone || i < activeStep ? "bg-blue-500" : "bg-slate-100"}`} />
                )}
                <button
                  type="button"
                  onClick={step.onClick}
                  disabled={i === 0}
                  className="relative z-10 w-full flex flex-col sm:flex-row items-center gap-2 sm:gap-2.5 cursor-default sm:cursor-pointer group"
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    isDone
                      ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20"
                      : isActive
                        ? "bg-blue-50 text-blue-600 border-2 border-blue-500"
                        : "bg-slate-50 text-slate-400 border border-slate-200"
                  }`}>
                    {isDone ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
                  </span>
                  <span className={`text-[11px] sm:text-xs font-semibold transition-colors ${
                    isDone ? "text-blue-600" : isActive ? "text-slate-900" : "text-slate-400"
                  }`}>{step.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-6" id="cart-form">
        {/* ===== Customer Details ===== */}
        <section className="order-last lg:order-none lg:col-span-3 space-y-4">
          <div id="customer-section" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden scroll-mt-4">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <User size={14} />
                </span>
                <h2 className="text-sm font-bold text-slate-900">بيانات العميل</h2>
              </div>
              <button
                type="button"
                onClick={loadLastCustomer}
                disabled={prefill.loading}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {prefill.loading ? <Loader2 size={13} className="animate-spin" /> : <History size={13} />}
                آخر عميل
              </button>
            </div>

            {prefill.msg && (
              <div className={`px-5 py-2.5 text-[12px] font-medium flex items-center gap-1.5 ${
                prefill.tone === "success" ? "bg-emerald-50 text-emerald-700" : prefill.tone === "error" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"
              }`}>
                {prefill.tone === "success" ? <CheckCircle2 size={13} /> : <Info size={13} />}
                {prefill.msg}
              </div>
            )}

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="اسم العميل" required error={fieldError("customerName")}>
                  <div className="relative">
                    <User size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="مثال: أحمد محمد"
                      value={form.customerName}
                      onChange={(e) => setField("customerName", e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, customerName: true }))}
                      className={`input-premium pr-9 ${errors.customerName && touched.customerName ? "input-error" : ""}`}
                    />
                  </div>
                </Field>
              </div>

              <Field label="هاتف العميل" required error={fieldError("customerPhone")}>
                <div className="relative">
                  <Phone size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    placeholder="01xxxxxxxxx"
                    value={form.customerPhone}
                    onChange={(e) => setField("customerPhone", e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, customerPhone: true }))}
                    className={`input-premium pr-9 ${errors.customerPhone && touched.customerPhone ? "input-error" : ""}`}
                  />
                </div>
              </Field>

              <Field label="البريد الإلكتروني" error={fieldError("customerEmail")}>
                <div className="relative">
                  <Mail size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    dir="ltr"
                    placeholder="(اختياري)"
                    value={form.customerEmail}
                    onChange={(e) => setField("customerEmail", e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, customerEmail: true }))}
                    className={`input-premium pr-9 ${errors.customerEmail && touched.customerEmail ? "input-error" : ""}`}
                  />
                </div>
              </Field>

              <div className="sm:col-span-2">
                <Field label="المحافظة" required error={fieldError("customerGovernorate")}>
                  <div className="relative" ref={govRef}>
                    <MapPin size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
                    <button
                      type="button"
                      onClick={() => { setGovOpen((o) => !o); setGovSearch("") }}
                      className={`w-full pr-9 pl-8 py-2.5 bg-white border rounded-xl text-[13px] text-right transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                        form.customerGovernorate
                          ? "border-indigo-300 text-slate-800 font-medium"
                          : errors.customerGovernorate && touched.customerGovernorate
                            ? "border-red-300"
                            : "border-slate-200 text-slate-400"
                      }`}
                    >
                      {ratesLoading ? (
                        <span className="flex items-center gap-2 text-slate-400"><Loader2 size={13} className="animate-spin" /> جاري تحميل المحافظات...</span>
                      ) : (
                        form.customerGovernorate || "اختر المحافظة"
                      )}
                    </button>
                    <ChevronDown size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${govOpen ? "rotate-180" : ""}`} />
                    {govOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="relative border-b border-slate-100">
                          <SearchIcon size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="ابحث عن المحافظة..."
                            value={govSearch}
                            onChange={(e) => setGovSearch(e.target.value)}
                            autoFocus
                            className="w-full pr-9 pl-3 py-2.5 text-[13px] focus:outline-none"
                          />
                        </div>
                        <div className="max-h-52 overflow-y-auto">
                          {ratesLoading ? (
                            <p className="px-4 py-3 text-[12px] text-slate-400">جاري التحميل...</p>
                          ) : filteredGovs.length === 0 ? (
                            <p className="px-4 py-3 text-[12px] text-slate-400">لا توجد نتائج</p>
                          ) : (
                            filteredGovs.map((rate) => (
                              <button
                                key={rate.governorate}
                                type="button"
                                onClick={() => selectGov(rate.governorate)}
                                className={`w-full flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors hover:bg-indigo-50 ${
                                  form.customerGovernorate === rate.governorate ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span>{rate.governorate}</span>
                                  <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Clock size={9} /> {rate.estimatedDays} أيام</span>
                                </span>
                                <span className="text-[11px] text-slate-400 tabular-nums">{formatCurrency(rate.rate)}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="المدينة / المنطقة" required error={fieldError("customerCity")}>
                  <div className="relative">
                    <MapPin size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      list="city-suggestions"
                      placeholder="اختر من الاقتراحات أو اكتب..."
                      value={form.customerCity}
                      onChange={(e) => setField("customerCity", e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, customerCity: true }))}
                      className={`input-premium pr-9 ${errors.customerCity && touched.customerCity ? "input-error" : ""}`}
                    />
                    {citySuggestions.length > 0 && (
                      <datalist id="city-suggestions">
                        {citySuggestions.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    )}
                  </div>
                  {citySuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {citySuggestions.slice(0, 6).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setField("customerCity", c); setTouched((t) => ({ ...t, customerCity: true })) }}
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                            form.customerCity === c ? "bg-blue-600 text-white border-blue-600" : "bg-slate-50 text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="العنوان بالتفصيل" required error={fieldError("customerAddress")}>
                  <div className="relative">
                    <MapPin size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="الشارع، رقم العقار، الدور، علامة مميزة"
                      value={form.customerAddress}
                      onChange={(e) => setField("customerAddress", e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, customerAddress: true }))}
                      className={`input-premium pr-9 ${errors.customerAddress && touched.customerAddress ? "input-error" : ""}`}
                    />
                  </div>
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="ملاحظات" error={undefined}>
                  <div className="relative">
                    <FileText size={15} className="absolute right-3 top-3 text-slate-400" />
                    <textarea
                      placeholder="أي تفاصيل إضافية للطلب (اختياري)"
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      className="input-premium pr-9 resize-none"
                    />
                  </div>
                </Field>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-white rounded-2xl border border-blue-100 shadow-sm px-4 py-3">
            <Banknote size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-slate-500 leading-5">
              الدفع <span className="font-semibold text-slate-700">عند الاستلام</span> — ادفع كاش أو عبر فودافون كاش عند وصول الطلب.
            </p>
          </div>
        </section>

        {/* ===== Order Summary ===== */}
        <aside id="summary-section" className="order-first lg:order-none lg:col-span-2 lg:sticky lg:top-5 lg:self-start scroll-mt-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedSummary((e) => !e)}
              className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Package size={14} />
                </span>
                <h2 className="text-sm font-bold text-slate-900">ملخص الطلب</h2>
              </div>
              <div className="flex items-center gap-2 lg:hidden">
                <span className="text-[11px] text-slate-500 tabular-nums">{itemCount} منتجات · {formatCurrency(total)}</span>
                {expandedSummary ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
              </div>
            </button>

            <div className={`px-5 pb-5 space-y-4 ${expandedSummary ? "block" : "hidden"} lg:block`}>
              {/* Items */}
              <div className="divide-y divide-slate-50 -mx-2">
                {cart.map((item) => {
                  const effectivePrice = item.customPrice !== undefined && item.customPrice !== null ? item.customPrice : item.price
                  const itemTotal = effectivePrice * item.quantity
                  const itemKey = `${item.productId}:${item.variantId || ""}`
                  const isEditing = editingPrice === itemKey
                  const itemComm = previewItems.find((p: any) => p.productId === item.productId)?.commission || 0

                  return (
                    <div key={itemKey} className="py-3 px-2">
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-100">
                          {item.image ? (
                            <img src={item.image} alt={item.nameAr} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package size={18} className="text-slate-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-[13px] font-semibold text-slate-900 truncate">{item.nameAr}</h3>
                              {item.variantName && (
                                <p className="text-[11px] text-blue-500 font-medium mt-0.5">{item.variantName}</p>
                              )}
                              <div className="mt-1 flex items-center gap-1.5">
                                {isEditing ? (
                                  <span className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      value={editPriceValue}
                                      onChange={(e) => setEditPriceValue(e.target.value)}
                                      className="w-20 px-2 py-1 border border-blue-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      autoFocus
                                      onKeyDown={(e) => { if (e.key === "Enter") saveEditPrice(item.productId, item.variantId); if (e.key === "Escape") setEditingPrice(null) }}
                                    />
                                    <button type="button" onClick={() => saveEditPrice(item.productId, item.variantId)} className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Check size={13} /></button>
                                    <button type="button" onClick={() => setEditingPrice(null)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={13} /></button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditPrice(itemKey, effectivePrice)}
                                    className="flex items-center gap-1 text-[13px] text-blue-600 hover:text-blue-800 font-bold tabular-nums transition-colors"
                                  >
                                    {formatCurrency(effectivePrice)}
                                    {item.customPrice !== undefined && item.customPrice !== item.price && (
                                      <span className="text-[10px] text-slate-400 font-normal line-through">{formatCurrency(item.price)}</span>
                                    )}
                                    <Edit2 size={11} className="opacity-40" />
                                  </button>
                                )}
                              </div>
                              {itemComm > 0 && (
                                <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg tabular-nums">
                                  <BadgePercent size={11} /> عمولتك: {formatCurrency(itemComm)}
                                </p>
                              )}
                            </div>
                            <p className="text-[13px] font-bold text-slate-900 tabular-nums shrink-0">{formatCurrency(itemTotal)}</p>
                          </div>

                          <div className="flex items-center justify-between mt-2.5 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl p-1 border border-slate-100">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.productId, item.quantity - 1, item.variantId)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white hover:shadow-sm active:scale-90 transition-all text-slate-600"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="w-7 text-center text-[13px] font-bold tabular-nums">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.productId, item.quantity + 1, item.variantId)}
                                disabled={item.quantity >= item.stock}
                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white hover:shadow-sm active:scale-90 transition-all text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => { removeFromCart(item.productId, item.variantId); toast("تم حذف المنتج", "info") }}
                              className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
                            >
                              <Trash2 size={13} />
                              حذف
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Totals */}
              <div className="border-t border-slate-100 pt-4 space-y-2.5">
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500">المجموع الفرعي</span>
                  <span className="font-semibold text-slate-800 tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Truck size={13} className="text-slate-400" />
                    الشحن
                    {form.customerGovernorate && <span className="text-slate-400 text-[11px]">({form.customerGovernorate})</span>}
                  </span>
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {form.customerGovernorate
                      ? selectedRate ? formatCurrency(selectedRate.rate) : <span className="text-slate-400 text-[11px]">تحديد...</span>
                      : <span className="text-slate-400">—</span>}
                  </span>
                </div>
                {selectedRate && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                    <span className="flex items-center gap-1.5"><Clock size={11} /> التوصيل خلال {selectedRate.estimatedDays} أيام عمل</span>
                    <span>يُحدد السعر تلقائيًا حسب المحافظة</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
                <span className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  الإجمالي
                  {previewLoading && <Loader2 size={13} className="animate-spin text-blue-400" />}
                </span>
                <span className="text-2xl font-extrabold text-blue-600 tabular-nums">{formatCurrency(total)}</span>
              </div>

              {hasCommissionItems ? (
                <div className="border-t border-emerald-100 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
                      <BadgePercent size={13} />
                      عمولة المسوق (فرق السعر)
                    </span>
                    <span className="text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(commission)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                      <Wallet size={13} className="text-slate-400" />
                      صافي المستحق للمسوق
                    </span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">{formatCurrency(commission)}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Info size={11} /> تُحتسب من فرق سعر البيع وسعر التكلفة، وتُضاف لرصيدك بعد تحصيل الطلب
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                    <BadgePercent size={13} className="text-slate-400" />
                    عمولة المسوق
                  </span>
                  <span className="text-sm font-bold text-slate-800 tabular-nums">{formatCurrency(0)}</span>
                </div>
              )}

              {/* Desktop submit */}
              <div id="submit-section" className="pt-1 hidden lg:block scroll-mt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full py-3.5 text-[15px] flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {submitting ? "جاري إنشاء الطلب..." : `تأكيد الطلب — ${formatCurrency(total)}`}
                </button>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-3">
                  <Shield size={12} />
                  <span>بيانات العميل آمنة ولن يتم مشاركتها</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </form>

      {/* ===== Mobile sticky bar ===== */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 leading-tight">الإجمالي <span className="tabular-nums">({itemCount} منتجات)</span></p>
            <p className="text-lg font-extrabold text-blue-600 tabular-nums leading-tight">{formatCurrency(total)}</p>
          </div>
          <button
            type="submit"
            form="cart-form"
            disabled={submitting}
            className="btn-primary flex-1 max-w-[240px] py-3 text-[15px] flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {submitting ? "جاري الإنشاء..." : "تأكيد الطلب"}
          </button>
        </div>
      </div>
    </div>
  )
}
