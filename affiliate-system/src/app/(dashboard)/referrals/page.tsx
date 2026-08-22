"use client"
import { useCallback, useEffect, useState } from "react"
import { Store, PlusCircle, Loader2, Package, CheckCircle2, Clock, TrendingUp, ShieldAlert, Phone, MapPin, Globe, MessageCircle, ChevronDown, ChevronUp, Wallet, Timer, Gift } from "lucide-react"
import BottomSheet from "@/components/BottomSheet"
import EmptyState from "@/components/EmptyState"
import { useToast } from "@/components/Toast"
import { SUPPLIER_STATUS_META, formatDateSmart } from "@/lib/supplier-referrals"
import { formatCurrency } from "@/lib/utils"

interface BonusEntry {
  id: string
  amount: number
  status: string
  createdAt: string
  orderNumber: string
}

interface SupplierReferral {
  id: string
  supplierName: string
  brandName: string
  phone: string
  whatsapp: string | null
  city: string
  productType: string
  storeUrl: string | null
  expectedProducts: number
  notes: string | null
  contactMethod: string
  status: string
  displayStatus: string
  rejectReason: string | null
  activationDate: string | null
  campaignEndDate: string | null
  createdAt: string
  earned: number
  paid: number
  qualifyingCount: number
  daysLeft: number
  bonusLedger: BonusEntry[]
}

interface SettingsPayload {
  enabled: boolean
  bonusPerOrder: number
  includeCollected: boolean
  minEligibleOrders: number
  maxBonusPerSupplier: number | null
  campaignStart: string | null
  campaignEnd: string | null
  durationDays: number
}

const PRODUCT_TYPES = [
  "أجهزة إلكترونية", "موبايلات وملحقاتها", "منتجات منزلية", "أدوات مطبخ", "أزياء", "عطور وهدايا",
  "مستحضرات تجميل", "منتجات رياضية", "أثاث", "ألعاب أطفال", "مواد غذائية", "أخرى",
]

const CONTACT_METHODS = ["واتساب", "مكالمة هاتفية", "البريد الإلكتروني"]

const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-shadow"

const labelCls = "block text-[11px] font-bold text-slate-600 mb-1.5"

const TERMINAL = ["REJECTED", "EXPIRED"]

function StatusBadge({ status }: { status: string }) {
  const meta = SUPPLIER_STATUS_META[status] || SUPPLIER_STATUS_META.PENDING
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  )
}

export default function ReferralsPage() {
  const { toast } = useToast()
  const [list, setList] = useState<SupplierReferral[]>([])
  const [settings, setSettings] = useState<SettingsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [form, setForm] = useState({
    supplierName: "", brandName: "", phone: "", whatsapp: "", city: "",
    productType: PRODUCT_TYPES[0], storeUrl: "", expectedProducts: "0", notes: "",
    contactMethod: CONTACT_METHODS[0], confirm: false,
  })

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch("/api/supplier-referrals")
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) throw new Error(d.error)
        setList(Array.isArray(d.referrals) ? d.referrals : [])
        setSettings(d.settings || null)
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

  const setF = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }))

  const requiredFilled = form.supplierName.trim() && form.brandName.trim() && form.phone.trim() && form.city.trim() && form.contactMethod

  const openModal = () => {
    setForm({ supplierName: "", brandName: "", phone: "", whatsapp: "", city: "", productType: PRODUCT_TYPES[0], storeUrl: "", expectedProducts: "0", notes: "", contactMethod: CONTACT_METHODS[0], confirm: false })
    setStep(1)
    setOpen(true)
  }

  const submit = async () => {
    if (!form.confirm || !requiredFilled) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/supplier-referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: form.supplierName, brandName: form.brandName, phone: form.phone,
          whatsapp: form.whatsapp || null, city: form.city, productType: form.productType,
          storeUrl: form.storeUrl || null, expectedProducts: parseInt(form.expectedProducts) || 0,
          notes: form.notes || null, contactMethod: form.contactMethod, dataConfirmed: true,
        }),
      })
      const d = await res.json()
      if (!res.ok || d?.error) throw new Error(d?.error || "حدث خطأ")
      toast("تم إرسال ترشيح المورد بنجاح", "success")
      setOpen(false)
      load()
    } catch (e: any) {
      toast(e?.message || "تعذر إرسال الترشيح", "error")
    } finally {
      setSubmitting(false)
    }
  }

  const activeCount = list.filter((r) => r.displayStatus === "ACTIVE").length
  const pendingBonus = list.reduce((s, r) => s + r.earned, 0)
  const qualifiedTotal = list.reduce((s, r) => s + r.qualifyingCount, 0)

  const targetOrders = () => {
    if (settings?.maxBonusPerSupplier && settings.bonusPerOrder > 0)
      return Math.ceil(settings.maxBonusPerSupplier / settings.bonusPerOrder)
    if (settings?.minEligibleOrders) return settings.minEligibleOrders
    return null
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}>
            <Store size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">موردوك — أضف موردًا واربح</h1>
            <p className="text-[12px] text-slate-500">رشّح موردًا مهتمًا بالانضمام للمنصة واربح بونصًا عن كل طلب تسليم/تحصيل عبره</p>
          </div>
        </div>
        <button
          onClick={openModal}
          disabled={settings?.enabled === false}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-emerald-600 to-teal-600 text-white rounded-xl text-[12px] font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlusCircle size={15} />
          إضافة مورد
        </button>
      </div>

      {settings?.enabled === false && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[12px] text-amber-800 font-medium">
          <ShieldAlert size={16} className="shrink-0" />
          حملة إضافة الموردين متوقفة حاليًا — يمكنك متابعة مورديك الحاليين، لكن لا يمكن تقديم ترشيحات جديدة الآن.
        </div>
      )}

      {/* Stats */}
      {!loading && !error && list.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي مورديك", value: String(list.length), tint: "#059669", icon: Store },
            { label: "موردون نشطون", value: String(activeCount), tint: "#2563eb", icon: CheckCircle2 },
            { label: "طلبات مؤهلة", value: String(qualifiedTotal), tint: "#7c3aed", icon: Package },
            { label: "بونص متاح", value: formatCurrency(pendingBonus), tint: "#d97706", icon: Wallet },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.tint}12` }}>
                  <s.icon size={14} style={{ color: s.tint }} />
                </div>
                <span className="text-[11px] font-bold text-slate-500">{s.label}</span>
              </div>
              <p className="text-lg font-extrabold text-slate-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Campaign banner */}
      {settings && (
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-teal-50 p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-600 shrink-0">
              <Gift size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-extrabold text-slate-900">بونص {formatCurrency(settings.bonusPerOrder)} عن كل طلب مؤهل</p>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                {settings.includeCollected
                  ? "الطلب المؤهل: تسليم (DELIVERED) أو تحصيل (COLLECTED) عبر منتجات موردك أثناء حملته."
                  : "الطلب المؤهل: تسليم فعلي (DELIVERED) عبر منتجات موردك أثناء حملته."}
                {settings.minEligibleOrders > 0 && ` — تبدأ البونصات بعد ${settings.minEligibleOrders} طلب مؤهل.`}
                {settings.campaignStart && ` — بداية الحملة ${formatDateSmart(settings.campaignStart)}.`}
                {settings.campaignEnd && ` — نهاية الحملة ${formatDateSmart(settings.campaignEnd)}.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-emerald-600" />
        </div>
      ) : error ? (
        <EmptyState icon={<Store size={30} className="text-red-400" />} title="تعذر تحميل مورديك" subtitle="حدث خطأ أثناء جلب البيانات" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Store size={30} className="text-slate-300" />}
          title="لا يوجد موردون بعد"
          subtitle="ابدأ بإضافة مورد مهتم بالانضمام للمنصة لتربح بونصًا عن كل طلب مؤهل عبره"
          action={
            <button onClick={openModal} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white text-[12px] font-bold shadow-sm hover:shadow-md transition-all">
              <PlusCircle size={14} /> أضف أول مورد
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {list.map((r) => {
            const isTerminal = TERMINAL.includes(r.displayStatus)
            const target = targetOrders()
            const pct = target ? Math.min(100, Math.round((r.qualifyingCount / target) * 100)) : null
            const isExpanded = expanded === r.id
            return (
              <div key={r.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isTerminal ? "border-slate-200 opacity-90" : "border-slate-100"}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${SUPPLIER_STATUS_META[r.displayStatus]?.color || "#64748b"}15` }}>
                        <Store size={18} style={{ color: SUPPLIER_STATUS_META[r.displayStatus]?.color || "#64748b" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-extrabold text-slate-900 truncate">{r.supplierName}</p>
                        <p className="text-[11px] text-slate-500 truncate">{r.brandName} — {r.city}</p>
                      </div>
                    </div>
                    <StatusBadge status={r.displayStatus} />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1"><Phone size={12} className="text-slate-400" />{r.phone}</span>
                    <span className="flex items-center gap-1"><Package size={12} className="text-slate-400" />{r.productType}</span>
                    {r.expectedProducts > 0 && <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-slate-400" />{r.expectedProducts} منتج متوقع</span>}
                  </div>

                  {/* Progress */}
                  {r.displayStatus === "ACTIVE" ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-500">الطلبات المؤهلة: {r.qualifyingCount}{target ? ` / ${target}` : ""}</span>
                        <span className="text-[10px] font-bold text-slate-400">{pct !== null ? `${pct}%` : "غير محدود"}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-500 transition-all" style={{ width: `${pct ?? 0}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <Wallet size={12} /> متاح: {formatCurrency(r.earned)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                          <Timer size={12} /> {r.daysLeft > 0 ? `متبقي ${r.daysLeft} يوم` : "انتهت الحملة"}
                        </span>
                      </div>
                    </div>
                  ) : r.displayStatus === "REJECTED" ? (
                    <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[11px] text-red-700 font-medium">
                      {r.rejectReason ? `سبب الرفض: ${r.rejectReason}` : "تم رفض هذا الترشيح"}
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                      <Clock size={13} className="text-slate-400" />
                      {r.displayStatus === "PENDING"
                        ? "بانتظار مراجعة الفريق..."
                        : r.displayStatus === "EXPIRED"
                          ? `انتهت حملة المورد في ${formatDateSmart(r.campaignEndDate)}`
                          : `تم التحديث في ${formatDateSmart(r.createdAt)}`}
                    </div>
                  )}
                </div>

                {/* Expand details */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border-t border-slate-50 text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  <span>{isExpanded ? "إخفاء التفاصيل" : "عرض التفاصيل والحد الأدنى"}</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 bg-slate-50/60">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-white rounded-lg border border-slate-100 p-2.5">
                        <p className="text-slate-400 font-medium mb-0.5">إجمالي بونصات مستحقة</p>
                        <p className="font-extrabold text-slate-900">{formatCurrency(r.earned + r.paid)}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-100 p-2.5">
                        <p className="text-slate-400 font-medium mb-0.5">تم صرفه بالفعل</p>
                        <p className="font-extrabold text-slate-900">{formatCurrency(r.paid)}</p>
                      </div>
                    </div>

                    {(r.storeUrl || r.whatsapp || r.notes) && (
                      <div className="space-y-1.5 text-[11px] text-slate-600">
                        {r.storeUrl && <p className="flex items-center gap-1.5"><Globe size={12} className="text-slate-400" />{r.storeUrl}</p>}
                        {r.whatsapp && <p className="flex items-center gap-1.5"><MessageCircle size={12} className="text-slate-400" />واتساب: {r.whatsapp}</p>}
                        {r.notes && <p className="leading-relaxed">{r.notes}</p>}
                      </div>
                    )}

                    {r.activationDate && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <TrendingUp size={11} /> بدأت الحملة {formatDateSmart(r.activationDate)}
                        {r.campaignEndDate && ` — تنتهي ${formatDateSmart(r.campaignEndDate)}`}
                      </p>
                    )}

                    {r.bonusLedger.length > 0 && (
                      <div className="bg-white rounded-lg border border-slate-100 overflow-hidden">
                        <p className="px-3 py-2 text-[11px] font-bold text-slate-600 border-b border-slate-50">سجل البونصات</p>
                        {r.bonusLedger.slice(0, 8).map((b) => (
                          <div key={b.id} className="flex items-center justify-between px-3 py-2 border-b border-slate-50 last:border-0">
                            <span className="text-[11px] text-slate-500">طلب {b.orderNumber} <span className="text-slate-300">·</span> {formatDateSmart(b.createdAt)}</span>
                            <span className={`text-[11px] font-bold ${b.status === "PAID" ? "text-emerald-700" : "text-amber-700"}`}>
                              {formatCurrency(b.amount)} {b.status === "PAID" ? "· مصروف" : "· متاح"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 2-step modal */}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={step === 1 ? "إضافة مورد جديد" : "مراجعة بيانات المورد"}
        icon={Store}
        tint="#059669"
        maxWidth="max-w-xl"
      >
        {step === 1 ? (
          <div className="px-5 py-5 space-y-4">
            <p className="text-[12px] text-slate-500 leading-relaxed">
              أدخل بيانات مورد مهتم فعلًا بالانضمام للمنصة. سيراجعه الفريق ويشعرك فور اتخاذ القرار.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={labelCls}>اسم المورد / المتجر *</label>
                <input className={inputCls} value={form.supplierName} onChange={(e) => setF("supplierName", e.target.value)} placeholder="مثال: متجر التقنية" />
              </div>
              <div>
                <label className={labelCls}>العلامة التجارية *</label>
                <input className={inputCls} value={form.brandName} onChange={(e) => setF("brandName", e.target.value)} placeholder="مثال: TechPro" />
              </div>
              <div>
                <label className={labelCls}>رقم الهاتف *</label>
                <input className={inputCls} dir="ltr" value={form.phone} onChange={(e) => setF("phone", e.target.value)} placeholder="01xxxxxxxxx" />
              </div>
              <div>
                <label className={labelCls}>واتساب (اختياري)</label>
                <input className={inputCls} dir="ltr" value={form.whatsapp} onChange={(e) => setF("whatsapp", e.target.value)} placeholder="نفس الرقم عادة" />
              </div>
              <div>
                <label className={labelCls}>المدينة *</label>
                <input className={inputCls} value={form.city} onChange={(e) => setF("city", e.target.value)} placeholder="مثال: القاهرة" />
              </div>
              <div>
                <label className={labelCls}>نوع المنتجات *</label>
                <select className={inputCls} value={form.productType} onChange={(e) => setF("productType", e.target.value)}>
                  {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>عدد المنتجات المتوقع</label>
                <input className={inputCls} type="number" min="0" value={form.expectedProducts} onChange={(e) => setF("expectedProducts", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>طريقة التواصل المفضلة *</label>
                <select className={inputCls} value={form.contactMethod} onChange={(e) => setF("contactMethod", e.target.value)}>
                  {CONTACT_METHODS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>رابط المتجر / صفحة المنتجات (اختياري)</label>
                <input className={inputCls} dir="ltr" value={form.storeUrl} onChange={(e) => setF("storeUrl", e.target.value)} placeholder="https://..." />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>ملاحظات إضافية (اختياري)</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={form.notes} onChange={(e) => setF("notes", e.target.value)} placeholder="أي تفاصيل تساعد الفريق في تقييم المورد" />
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-3">
              <MapPin size={15} className="text-emerald-600 shrink-0" />
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                ستراجع بيانات المورد وتؤكد إرسالها في الخطوة التالية — لن يُرسل أي ترشيح غير مكتمل أو غير مؤكد.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-5 py-5 space-y-4">
            <p className="text-[12px] text-slate-500 leading-relaxed">تأكد من صحة بيانات المورد قبل إرسال الترشيح:</p>
            <div className="rounded-2xl border border-slate-100 divide-y divide-slate-50 bg-white">
              {[
                ["اسم المورد", form.supplierName],
                ["العلامة التجارية", form.brandName],
                ["رقم الهاتف", form.phone],
                ["المدينة", form.city],
                ["نوع المنتجات", form.productType],
                ["عدد المنتجات المتوقع", form.expectedProducts || "غير محدد"],
                ["طريقة التواصل", form.contactMethod],
                ["رابط المتجر", form.storeUrl || "—"],
                ["ملاحظات", form.notes || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[11px] font-bold text-slate-500">{k}</span>
                  <span className="text-[12px] font-semibold text-slate-800 max-w-[60%] truncate">{v}</span>
                </div>
              ))}
            </div>
            <label className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-3 cursor-pointer">
              <input type="checkbox" checked={form.confirm} onChange={(e) => setF("confirm", e.target.checked)} className="mt-0.5 accent-emerald-600" />
              <span className="text-[11px] text-emerald-900 font-medium leading-relaxed">
                أقر بأن المورد مهتم فعلًا بالانضمام للمنصة ووافقت على مشاركة بياناته، وأتحمل مسؤولية صحة المعلومات المقدمة.
              </span>
            </label>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3 text-[11px] text-amber-800 font-medium flex items-start gap-2">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              لن يُقبل ترشيح مورد سبق ترشيحه من مسوق آخر — الأولوية لأول من رشّح المورد.
            </div>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          {step === 1 ? (
            <>
              <button onClick={() => setOpen(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                إلغاء
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!requiredFilled}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white text-[12px] font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                مراجعة والإرسال <ChevronDown size={14} className="rotate-90" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                رجوع
              </button>
              <button
                onClick={submit}
                disabled={!form.confirm || submitting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white text-[12px] font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                تأكيد وإرسال الترشيح
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
