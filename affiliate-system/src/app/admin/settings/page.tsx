"use client"
import { useEffect, useState, useMemo } from "react"
import { applyTheme } from "@/components/ThemeProvider"
import { useToast } from "@/components/Toast"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import {
  Settings, Loader2, Save, RotateCcw, UserRound, Store, Paintbrush, Bell, ShieldCheck,
  History, Upload, Image, Globe, Phone, MessageCircle, Link2, Truck, CreditCard,
  KeyRound, Lock, Eye, Check, AlertTriangle, Users, ExternalLink, Mail, Clock, BadgeCheck,
  Zap, PhoneCall, CalendarClock,
} from "lucide-react"

/* ─────────────────────────── بيانات الأقسام ─────────────────────────── */

const TABS = [
  { id: "account", label: "الحساب", desc: "بياناتك الشخصية", icon: UserRound },
  { id: "store", label: "المتجر", desc: "الهوية والتواصل والشحن", icon: Store },
  { id: "appearance", label: "المظهر", desc: "الألوان والثيم", icon: Paintbrush },
  { id: "notifications", label: "الإشعارات", desc: "تنبيهات النظام", icon: Bell },
  { id: "confirmation", label: "تأكيد الطلبات", desc: "مهلة التأكيد والإلغاء التلقائي", icon: CalendarClock },
  { id: "security", label: "الأمان", desc: "كلمة المرور والنشاط", icon: ShieldCheck },
  { id: "activity", label: "السجلات", desc: "سجل النشاط والصلاحيات", icon: History },
]

const PRESETS = [
  { name: "أزرق كلاسيكي", desc: "تصميم احترافي متوازن", colors: { "brand-primary": "#1e40af", "brand-primary-light": "#3b82f6", "brand-primary-dark": "#1e3a8a", "brand-accent": "#f59e0b", "brand-accent-light": "#fbbf24", "brand-bg": "#f0f4f8", "brand-text": "#0f172a", "brand-text-secondary": "#64748b", "brand-surface": "#ffffff", "brand-success": "#059669", "brand-danger": "#dc2626" } },
  { name: "أخضر طبيعي", desc: "بيئي منعش", colors: { "brand-primary": "#047857", "brand-primary-light": "#10b981", "brand-primary-dark": "#065f46", "brand-accent": "#f97316", "brand-accent-light": "#fdba74", "brand-bg": "#f0fdf4", "brand-text": "#0f172a", "brand-text-secondary": "#64748b", "brand-surface": "#ffffff", "brand-success": "#059669", "brand-danger": "#dc2626" } },
  { name: "بنفسجي عصري", desc: "عصري وجرئ", colors: { "brand-primary": "#6d28d9", "brand-primary-light": "#8b5cf6", "brand-primary-dark": "#5b21b6", "brand-accent": "#ec4899", "brand-accent-light": "#f9a8d4", "brand-bg": "#faf5ff", "brand-text": "#0f172a", "brand-text-secondary": "#64748b", "brand-surface": "#ffffff", "brand-success": "#059669", "brand-danger": "#dc2626" } },
  { name: "كحلي فاخر", desc: "رسمي وفاخر", colors: { "brand-primary": "#0f172a", "brand-primary-light": "#334155", "brand-primary-dark": "#020617", "brand-accent": "#d97706", "brand-accent-light": "#fcd34d", "brand-bg": "#f8fafc", "brand-text": "#0f172a", "brand-text-secondary": "#64748b", "brand-surface": "#ffffff", "brand-success": "#059669", "brand-danger": "#dc2626" } },
  { name: "سماوي", desc: "هادئ ومريح للعين", colors: { "brand-primary": "#0369a1", "brand-primary-light": "#0ea5e9", "brand-primary-dark": "#075985", "brand-accent": "#14b8a6", "brand-accent-light": "#5eead4", "brand-bg": "#f0f9ff", "brand-text": "#0f172a", "brand-text-secondary": "#64748b", "brand-surface": "#ffffff", "brand-success": "#059669", "brand-danger": "#dc2626" } },
]

const COLOR_GROUPS = [
  {
    title: "الألوان الأساسية",
    fields: [
      { key: "brand-primary", label: "الأساسي", desc: "الأزرار والعناصر النشطة" },
      { key: "brand-primary-light", label: "الأساسي الفاتح", desc: "التدرجات وتأثيرات hover" },
      { key: "brand-primary-dark", label: "الأساسي الداكن", desc: "النصوص فوق الألوان الفاتحة" },
      { key: "brand-accent", label: "اللون الثانوي", desc: "التنبيهات والرموز" },
      { key: "brand-accent-light", label: "الثانوي الفاتح", desc: "تدرجات اللون الثانوي" },
    ],
  },
  {
    title: "الخلفيات والنصوص",
    fields: [
      { key: "brand-bg", label: "خلفية الصفحة", desc: "خلفية صفحات النظام" },
      { key: "brand-surface", label: "لون السطح", desc: "خلفية الكروت والحاويات" },
      { key: "brand-text", label: "النص الرئيسي", desc: "العناوين والنصوص الأساسية" },
      { key: "brand-text-secondary", label: "النص الثانوي", desc: "النصوص المساعدة" },
    ],
  },
  {
    title: "ألوان الحالة",
    fields: [
      { key: "brand-success", label: "نجاح", desc: "الحالات الإيجابية" },
      { key: "brand-danger", label: "خطأ / حذف", desc: "الحالات السلبية" },
    ],
  },
]

const ACTIVITY_MODULES = [
  { label: "الكل", value: "" },
  { label: "الإعدادات", value: "settings" },
  { label: "الحساب", value: "profile" },
  { label: "السحوبات", value: "withdrawals" },
  { label: "المديرون", value: "managers" },
  { label: "فريق التأكيد", value: "confirmation" },
]

const MODULE_LABELS: Record<string, string> = {
  settings: "الإعدادات",
  profile: "الحساب",
  withdrawals: "السحوبات",
  managers: "المديرون",
  confirmation: "فريق التأكيد",
}

const ACTIVITY_META: Record<string, { icon: any; tint: string; bg: string }> = {
  SETTINGS_UPDATED: { icon: Settings, tint: "text-indigo-600", bg: "bg-indigo-50" },
  SHIPPING_RATES_UPDATED: { icon: Truck, tint: "text-indigo-600", bg: "bg-indigo-50" },
  PASSWORD_CHANGED: { icon: KeyRound, tint: "text-amber-600", bg: "bg-amber-50" },
  PROFILE_UPDATED: { icon: UserRound, tint: "text-sky-600", bg: "bg-sky-50" },
  WITHDRAWAL_APPROVED: { icon: BadgeCheck, tint: "text-emerald-600", bg: "bg-emerald-50" },
  WITHDRAWAL_REJECTED: { icon: AlertTriangle, tint: "text-red-600", bg: "bg-red-50" },
  WITHDRAWAL_COMPLETED: { icon: BadgeCheck, tint: "text-emerald-600", bg: "bg-emerald-50" },
  ACCOUNT_CREATED: { icon: UserRound, tint: "text-emerald-600", bg: "bg-emerald-50" },
  ACCOUNT_UPDATED: { icon: UserRound, tint: "text-blue-600", bg: "bg-blue-50" },
  ACCOUNT_DELETED: { icon: UserRound, tint: "text-red-600", bg: "bg-red-50" },
  AUTO_DISTRIBUTED: { icon: History, tint: "text-purple-600", bg: "bg-purple-50" },
  ORDER_ASSIGNED: { icon: History, tint: "text-purple-600", bg: "bg-purple-50" },
}

/* ─────────────────────────── الصفحة الرئيسية ─────────────────────────── */

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const perms = usePermissions()
  const can = perms.can

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("account")

  /* الإعدادات العامة */
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [initialSettings, setInitialSettings] = useState<Record<string, string>>({})
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())

  /* الحساب */
  const [profile, setProfile] = useState<any>(null)
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", email: "" })
  const [profileInitial, setProfileInitial] = useState({ name: "", phone: "" })
  const [profileDirty, setProfileDirty] = useState(false)

  /* كلمة المرور */
  const [passForm, setPassForm] = useState({ current: "", next: "", confirm: "" })
  const [savingPass, setSavingPass] = useState(false)

  /* الشحن */
  const [governorates, setGovernorates] = useState<any[]>([])
  const [unify, setUnify] = useState({ price: "", days: "3" })
  const [unifying, setUnifying] = useState(false)

  /* الشعار */
  const [uploading, setUploading] = useState(false)

  /* السجل */
  const [activity, setActivity] = useState<any[]>([])
  const [activityModule, setActivityModule] = useState("")
  const [activityLoading, setActivityLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const dirty = dirtyKeys.size > 0 || profileDirty

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const [sRes, pRes] = await Promise.all([
          fetch("/api/admin/settings"),
          fetch("/api/profile"),
        ])
        const s = await sRes.json()
        if (s && !s.error) {
          setSettings(s)
          setInitialSettings(s)
        }
        const p = await pRes.json()
        if (p && p.id) {
          setProfile(p)
          const pf = { name: p.name || "", phone: p.phone || "", email: p.email || "" }
          setProfileForm(pf)
          setProfileInitial({ name: pf.name, phone: pf.phone })
        }
        const gRes = await fetch("/api/admin/shipping")
        if (gRes.ok) {
          const g = await gRes.json()
          if (Array.isArray(g)) setGovernorates(g)
        }
      } catch {
        toast("تعذر تحميل الإعدادات", "error")
      } finally {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadActivity("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadActivity = async (module?: string) => {
    setActivityModule(module || "")
    setActivityLoading(true)
    try {
      const q = module ? `?module=${module}` : ""
      const r = await fetch(`/api/admin/settings/activity${q}`)
      if (r.ok) {
        const d = await r.json()
        setActivity(d.activities || [])
      }
    } catch {
      setActivity([])
    } finally {
      setActivityLoading(false)
    }
  }

  /* ── تحديثات ── */
  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setDirtyKeys((prev) => new Set(prev).add(key))
  }

  const updateProfile = (patch: Partial<typeof profileForm>) => {
    setProfileForm((prev) => ({ ...prev, ...patch }))
    setProfileDirty(true)
  }

  const applyPreset = (colors: Record<string, string>) => {
    const merged = { ...settings, ...colors }
    setSettings(merged)
    Object.keys(colors).forEach((k) => setDirtyKeys((prev) => new Set(prev).add(k)))
    applyTheme(merged)
  }

  const resetChanges = () => {
    setSettings(initialSettings)
    setDirtyKeys(new Set())
    setProfileForm((prev) => ({ ...prev, ...profileInitial }))
    setProfileDirty(false)
    applyTheme(initialSettings)
    toast("تم تجاهل التغييرات", "info")
  }

  const handleSaveAll = async () => {
    setSaving(true)
    try {
      let ok = true
      if (dirtyKeys.size > 0) {
        const payload = Object.fromEntries([...dirtyKeys].map((k) => [k, settings[k] ?? ""]))
        const r = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!r.ok) ok = false
      }
      if (ok && profileDirty) {
        const r = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: profileForm.name, phone: profileForm.phone }),
        })
        if (!r.ok) ok = false
        else {
          setProfileInitial({ name: profileForm.name, phone: profileForm.phone })
          setProfile((prev: any) => ({ ...prev, name: profileForm.name, phone: profileForm.phone }))
        }
      }
      if (ok) {
        setInitialSettings(settings)
        setDirtyKeys(new Set())
        setProfileDirty(false)
        applyTheme(settings)
        toast("تم حفظ التغييرات بنجاح", "success")
      } else {
        toast("حدث خطأ أثناء الحفظ", "error")
      }
    } catch {
      toast("حدث خطأ", "error")
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (passForm.next.length < 6) {
      toast("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل", "error")
      return
    }
    if (passForm.next !== passForm.confirm) {
      toast("تأكيد كلمة المرور غير متطابق", "error")
      return
    }
    setSavingPass(true)
    try {
      const r = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passForm.current, newPassword: passForm.next }),
      })
      const d = await r.json()
      if (r.ok) {
        setPassForm({ current: "", next: "", confirm: "" })
        toast("تم تغيير كلمة المرور بنجاح", "success")
      } else {
        toast(d.error || "حدث خطأ", "error")
      }
    } catch {
      toast("حدث خطأ", "error")
    } finally {
      setSavingPass(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", "logos")
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (res.ok) {
        const data = await res.json()
        updateSetting("logo-url", data.url)
        toast("تم رفع الشعار", "success")
      } else {
        toast("حدث خطأ في الرفع", "error")
      }
    } catch {
      toast("حدث خطأ", "error")
    } finally {
      setUploading(false)
    }
  }

  const handleUnifyRates = async () => {
    const price = Number(unify.price)
    if (!unify.price || Number.isNaN(price) || price < 0) {
      toast("أدخل سعراً صالحاً", "error")
      return
    }
    setUnifying(true)
    try {
      const r = await fetch("/api/admin/shipping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate: price, estimatedDays: Number(unify.days) || 3 }),
      })
      if (r.ok) {
        const d = await r.json()
        toast(`تم تحديث ${d.updated} محافظة`, "success")
        const g = await (await fetch("/api/admin/shipping")).json()
        if (Array.isArray(g)) setGovernorates(g)
      } else {
        toast("حدث خطأ", "error")
      }
    } catch {
      toast("حدث خطأ", "error")
    } finally {
      setUnifying(false)
    }
  }

  const handleUpdateRate = async (id: string, rate: number, days: number) => {
    try {
      const r = await fetch("/api/shipping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, rate, estimatedDays: days }),
      })
      if (r.ok) {
        setGovernorates((prev) => prev.map((g) => (g.id === id ? { ...g, rate, estimatedDays: days } : g)))
        toast("تم تحديث السعر", "success")
      } else {
        toast("حدث خطأ", "error")
      }
    } catch {
      toast("حدث خطأ", "error")
    }
  }

  if (loading) return <SettingsSkeleton />

  const activeDesc = TABS.find((t) => t.id === activeTab)?.desc || ""

  return (
    <RequirePerms perm="settings.view">
      <div className="space-y-5 pb-32">
        {/* الترويسة */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-indigo-600 to-blue-500 shadow-sm shadow-indigo-200">
              <Settings size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">إعدادات النظام</h1>
              <p className="text-[12px] text-slate-500">إدارة كل إعدادات منصتك في مكان واحد</p>
            </div>
          </div>
          {dirty && (
            <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl">
              <AlertTriangle size={13} />
              توجد تغييرات غير محفوظة
            </div>
          )}
        </div>

        {/* شريط الأقسام */}
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2" style={{ background: "rgba(248,250,252,0.9)", backdropFilter: "blur(12px) saturate(180%)" }}>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all shrink-0 border
                    ${isActive ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"}`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <p className="text-[12px] text-slate-400 -mt-2">{activeDesc}</p>

        {/* المحتوى */}
        {activeTab === "account" && (
          <AccountTab
            profile={profile}
            form={profileForm}
            updateProfile={updateProfile}
          />
        )}

        {activeTab === "store" && (
          <StoreTab
            settings={settings}
            updateSetting={updateSetting}
            uploading={uploading}
            handleLogoUpload={handleLogoUpload}
            canShipping={can("settings.shipping")}
            governorates={governorates}
            unify={unify}
            setUnify={setUnify}
            unifying={unifying}
            handleUnifyRates={handleUnifyRates}
            handleUpdateRate={handleUpdateRate}
          />
        )}

        {activeTab === "appearance" && (
          <AppearanceTab
            settings={settings}
            updateSetting={updateSetting}
            applyPreset={applyPreset}
          />
        )}

        {activeTab === "notifications" && (
          <NotificationsTab settings={settings} updateSetting={updateSetting} />
        )}

        {activeTab === "confirmation" && (
          <ConfirmationTab
            settings={settings}
            updateSetting={updateSetting}
            canUpdate={can("settings.update")}
            toast={toast}
          />
        )}

        {activeTab === "security" && (
          <SecurityTab
            passForm={passForm}
            setPassForm={setPassForm}
            savingPass={savingPass}
            handlePasswordChange={handlePasswordChange}
            activity={activity}
            activityLoading={activityLoading}
            loadActivity={loadActivity}
            activityModule={activityModule}
          />
        )}

        {activeTab === "activity" && (
          <ActivityTab
            activity={activity}
            activityLoading={activityLoading}
            activityModule={activityModule}
            loadActivity={loadActivity}
          />
        )}

        {/* شريط الحفظ السفلي */}
        {dirty && (
          <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/70" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px) saturate(180%)" }}>
            <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                  <AlertTriangle size={12} /> تغييرات غير محفوظة
                </span>
                <span className="hidden sm:block text-[11px] text-slate-400">
                  {dirtyKeys.size} إعداد + {profileDirty ? "بيانات الحساب" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetChanges}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[13px] font-medium hover:bg-slate-50 transition-colors"
                >
                  <RotateCcw size={14} />
                  تجاهل
                </button>
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-sm"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequirePerms>
  )
}

/* ─────────────────────────── تبويب الحساب ─────────────────────────── */

function AccountTab({ profile, form, updateProfile }: any) {
  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard title="بيانات المدير" desc="الاسم ورقم الهاتف — البريد الإلكتروني للدخول" icon={UserRound}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="الاسم">
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateProfile({ name: e.target.value })}
              placeholder="اسم المدير"
              className={inputCls}
            />
          </Field>
          <Field label="رقم الهاتف">
            <input
              type="text"
              value={form.phone}
              onChange={(e) => updateProfile({ phone: e.target.value })}
              placeholder="01xxxxxxxxx"
              dir="ltr"
              className={inputCls}
            />
          </Field>
          <Field label="البريد الإلكتروني">
            <div className="relative">
              <input type="email" value={form.email} readOnly dir="ltr" className={`${inputCls} bg-slate-50 text-slate-400 cursor-not-allowed`} />
              <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">البريد هو اسم المستخدم للدخول ولا يمكن تغييره</p>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="معلومات الحساب" desc="تفاصيل حول حسابك وجلسة الدخول" icon={BadgeCheck}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <InfoTile icon={BadgeCheck} label="الدور" value={profile?.role === "ADMIN" ? "مدير النظام" : profile?.role || "—"} />
          <InfoTile
            icon={Clock}
            label="آخر تسجيل دخول"
            value={profile?.lastLogin ? formatDateTime(profile.lastLogin) : "—"}
          />
          <InfoTile
            icon={History}
            label="عضو منذ"
            value={profile?.createdAt ? formatDate(profile.createdAt) : "—"}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          تعتمد الجلسات على تقنية JWT الآمنة. يمكنك تسجيل الخروج من حسابك في أي وقت من القائمة الجانبية.
        </p>
      </SectionCard>
    </div>
  )
}

/* ─────────────────────────── تبويب المتجر ─────────────────────────── */

function StoreTab({ settings, updateSetting, uploading, handleLogoUpload, canShipping, governorates, unify, setUnify, unifying, handleUnifyRates, handleUpdateRate }: any) {
  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard title="هوية المنصة" desc="اسم المنصة الذي يظهر في المتجر وصفحات الدخول" icon={Globe}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="اسم المنصة (إنجليزي)">
            <input type="text" value={settings["site-name"] || ""} onChange={(e) => updateSetting("site-name", e.target.value)} dir="ltr" className={inputCls} />
          </Field>
          <Field label="اسم المنصة (عربي)">
            <input type="text" value={settings["site-name-ar"] || ""} onChange={(e) => updateSetting("site-name-ar", e.target.value)} className={inputCls} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="شعار المنصة" desc="يظهر في الترويسة والـ Sidebar وصفحات الدخول" icon={Image}>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-32 h-32 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0"
            style={{ borderColor: settings["logo-url"] ? "#3b82f640" : "#e2e8f0", background: "#f8fafc" }}>
            {settings["logo-url"] ? (
              <img src={settings["logo-url"]} alt="Logo" className="w-full h-full object-contain p-3" />
            ) : (
              <div className="text-center">
                <Image size={28} className="mx-auto text-slate-300 mb-1" />
                <p className="text-[10px] text-slate-300">لا يوجد شعار</p>
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[13px] font-semibold hover:bg-indigo-100 cursor-pointer transition-colors">
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {uploading ? "جاري الرفع..." : "رفع شعار"}
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
              {settings["logo-url"] && (
                <button onClick={() => updateSetting("logo-url", "")}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors">
                  إزالة الشعار
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">PNG, JPG, SVG — حد أقصى 5MB</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="بيانات التواصل" desc="تظهر في صفحات المساعدة وصفحات المتجر" icon={MessageCircle}>
        <div className="space-y-4">
          <Field label="رقم واتساب الدعم">
            <input type="text" value={settings["support-whatsapp"] || ""} onChange={(e) => updateSetting("support-whatsapp", e.target.value)} dir="ltr" className={inputCls} placeholder="01xxxxxxxxx" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="رابط صفحة فيسبوك">
              <input type="text" value={settings["facebook-page-url"] || ""} onChange={(e) => updateSetting("facebook-page-url", e.target.value)} dir="ltr" className={inputCls} placeholder="https://facebook.com/..." />
            </Field>
            <Field label="رابط جروب فيسبوك">
              <input type="text" value={settings["facebook-group-url"] || ""} onChange={(e) => updateSetting("facebook-group-url", e.target.value)} dir="ltr" className={inputCls} placeholder="https://facebook.com/groups/..." />
            </Field>
          </div>
        </div>
      </SectionCard>

      {canShipping && (
        <SectionCard title="أسعار الشحن" desc="تعديل أسعار التوصيل لكل محافظة" icon={Truck}>
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-[13px] font-bold text-slate-700 mb-3">توحيد الأسعار لجميع المحافظات</p>
              <div className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1 w-full">
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">السعر الجديد (ج.م)</label>
                  <input type="number" min="0" value={unify.price} onChange={(e) => setUnify({ ...unify, price: e.target.value })} placeholder="مثال: 50" dir="ltr" className={inputCls} />
                </div>
                <div className="w-full sm:w-36">
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">أيام التوصيل</label>
                  <input type="number" min="1" max="30" value={unify.days} onChange={(e) => setUnify({ ...unify, days: e.target.value })} dir="ltr" className={inputCls} />
                </div>
                <button onClick={handleUnifyRates} disabled={unifying || !unify.price}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shrink-0">
                  {unifying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  توحيد الكل
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {governorates.length === 0 ? (
                <div className="text-center py-6 text-[12px] text-slate-400">لا توجد محافظات</div>
              ) : (
                governorates.map((g: any) => (
                  <RateRow key={g.id} g={g} onUpdate={handleUpdateRate} />
                ))
              )}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

/* ─────────────────────────── تبويب المظهر ─────────────────────────── */

function AppearanceTab({ settings, updateSetting, applyPreset }: any) {
  const [openGroup, setOpenGroup] = useState<number>(0)

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard title="الثيمات الجاهزة" desc="اختر ثيماً جاهزاً ثم عدّل حسب رغبتك" icon={Paintbrush}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {PRESETS.map((preset) => {
            const isActive = preset.colors["brand-primary"] === settings["brand-primary"]
            return (
              <button key={preset.name} onClick={() => applyPreset(preset.colors)}
                className={`group relative p-3.5 rounded-xl border-2 text-right transition-all ${isActive ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-100 hover:border-slate-200 hover:shadow-sm bg-white"}`}>
                {isActive && (
                  <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                    <Check size={10} className="text-white" />
                  </div>
                )}
                <div className="flex gap-1 mb-2">
                  <div className="flex-1 h-6 rounded-md" style={{ background: preset.colors["brand-primary"] }} />
                  <div className="flex-1 h-6 rounded-md" style={{ background: preset.colors["brand-primary-light"] }} />
                  <div className="flex-1 h-6 rounded-md" style={{ background: preset.colors["brand-accent"] }} />
                  <div className="flex-1 h-6 rounded-md" style={{ background: preset.colors["brand-bg"], border: "1px solid #e2e8f0" }} />
                </div>
                <p className="text-[12px] font-bold text-slate-800">{preset.name}</p>
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard title="الألوان المخصصة" desc="عدّل الألوان يدوياً — تُطبق مباشرة على كل النظام" icon={Paintbrush}>
        <div className="divide-y divide-slate-50">
          {COLOR_GROUPS.map((group, gi) => {
            const isExpanded = openGroup === gi
            return (
              <div key={gi}>
                <button onClick={() => setOpenGroup(isExpanded ? -1 : gi)}
                  className="w-full px-2 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors rounded-xl">
                  <span className="text-[13px] font-semibold text-slate-700">{group.title}</span>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex gap-1">
                      {group.fields.map((f) => (
                        <div key={f.key} className="w-4 h-4 rounded-full border border-slate-200" style={{ background: settings[f.key] || "#000" }} />
                      ))}
                    </div>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-2 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {group.fields.map((field) => (
                      <div key={field.key} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="relative shrink-0">
                          <input type="color" value={settings[field.key] || "#000000"}
                            onChange={(e) => updateSetting(field.key, e.target.value)}
                            className="w-11 h-11 rounded-xl border-2 border-slate-200 cursor-pointer" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-700">{field.label}</p>
                          <p className="text-[11px] text-slate-400 truncate">{field.desc}</p>
                        </div>
                        <input type="text" value={settings[field.key] || ""} onChange={(e) => updateSetting(field.key, e.target.value)}
                          className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] font-mono text-center text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all" dir="ltr" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          الوضع الليلي/النهاري يُتحكم به من زر السمة في الشريط العلوي (حفظ تلقائي على جهازك).
        </p>
      </SectionCard>

      <SectionCard title="معاينة مباشرة" desc="شكل النظام بالألوان الحالية" icon={Eye}>
        <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ background: settings["brand-bg"] || "#f0f4f8" }}>
          <div className="flex">
            <div className="w-36 p-2.5 space-y-1 hidden sm:block" style={{ background: "linear-gradient(180deg, #0f172a, #1e293b)" }}>
              <div className="flex items-center gap-2 px-2 py-1.5 mb-1.5">
                {settings["logo-url"] ? <img src={settings["logo-url"]} alt="" className="w-5 h-5 rounded object-contain" /> : <div className="w-5 h-5 rounded" style={{ background: settings["brand-primary-light"] || "#3b82f6" }} />}
                <span className="text-[9px] font-bold text-white truncate">{settings["site-name-ar"] || "المنصة"}</span>
              </div>
              {["الرئيسية", "المنتجات", "الطلبات"].map((item, i) => (
                <div key={item} className={`px-2.5 py-1 rounded-md text-[9px] font-medium ${i === 0 ? "text-white" : "text-white/40"}`}
                  style={i === 0 ? { background: `linear-gradient(135deg, ${(settings["brand-primary"] || "#1e40af")}40, ${(settings["brand-primary-light"] || "#3b82f6")}20)` } : {}}>
                  {item}
                </div>
              ))}
            </div>
            <div className="flex-1 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="w-20 h-2.5 rounded" style={{ background: (settings["brand-text"] || "#0f172a") + "20" }} />
                <div className="w-5 h-5 rounded-full" style={{ background: settings["brand-primary"] || "#1e40af" }} />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[settings["brand-primary"], settings["brand-success"], settings["brand-accent"]].map((c, i) => (
                  <div key={i} className="bg-white rounded-md p-1.5 border border-slate-100">
                    <div className="w-6 h-1 rounded mb-1" style={{ background: (c || "#3b82f6") + "30" }} />
                    <div className="w-8 h-2 rounded" style={{ background: c || "#3b82f6" }} />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <div className="px-3 py-1 rounded-md text-[9px] font-bold text-white" style={{ background: settings["brand-primary"] || "#1e40af" }}>زر رئيسي</div>
                <div className="px-3 py-1 rounded-md text-[9px] font-bold text-white" style={{ background: settings["brand-primary-light"] || "#3b82f6" }}>فرعي</div>
                <div className="px-3 py-1 rounded-md text-[9px] font-bold text-white" style={{ background: settings["brand-accent"] || "#f59e0b" }}>مميز</div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

/* ─────────────────────────── تبويب الإشعارات ─────────────────────────── */

function NotificationsTab({ settings, updateSetting }: any) {
  const rows = [
    { key: "notif-new-order", title: "طلب جديد", desc: "إشعار للمديرين عند إنشاء طلب جديد من مسوق" },
    { key: "notif-new-affiliate", title: "مسوق جديد", desc: "إشعار عند تسجيل مسوق جديد في المنصة" },
    { key: "notif-withdrawal", title: "طلب سحب جديد", desc: "إشعار عند تقديم مسوق لطلب سحب أرباح" },
  ]
  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard title="الإشعارات داخل النظام" desc="التحكم في التنبيهات التي تصلك داخل لوحة التحكم" icon={Bell}>
        <div className="space-y-3">
          {rows.map((row) => (
            <SwitchRow key={row.key} title={row.title} desc={row.desc}
              checked={settings[row.key] !== "false"}
              onChange={(v) => updateSetting(row.key, String(v))} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="مركز الإشعارات" desc="مراجعة كل التنبيهات السابقة" icon={Bell}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-[13px] text-slate-600">تصفح إشعارات الطلبات والسحوبات والتحديثات السابقة</p>
          <a href="/admin/notifications"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[13px] font-semibold hover:bg-indigo-100 transition-colors">
            فتح مركز الإشعارات <ExternalLink size={14} />
          </a>
        </div>
      </SectionCard>
    </div>
  )
}

/* ─────────────────────────── تبويب تأكيد الطلبات ─────────────────────────── */

function ConfirmationTab({ settings, updateSetting, canUpdate, toast }: any) {
  const [runStatus, setRunStatus] = useState<null | { scanned: number; cancelled: number; skipped: number; details: string[]; enabled: boolean; deadlineDays: number; dryRun?: boolean }>(null)
  const [running, setRunning] = useState(false)

  const runJob = async (dryRun: boolean) => {
    setRunning(true)
    try {
      const r = await fetch("/api/admin/jobs/auto-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      })
      const d = await r.json()
      if (r.ok) {
        setRunStatus(d)
        toast(dryRun ? "اكتملت المحاكاة" : "تم تشغيل الوظيفة", "success")
      } else {
        toast(d.error || "حدث خطأ", "error")
      }
    } catch {
      toast("حدث خطأ في التشغيل", "error")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard title="مهلة تأكيد الطلبات" desc="إعدادات الإلغاء التلقائي للطلبات غير المؤكدة" icon={CalendarClock}>
        <div className="space-y-4">
          <SwitchRow title="الإلغاء التلقائي" desc="إلغاء الطلبات تلقائياً عند انتهاء مهلة التأكيد"
            checked={settings["orders-auto-cancel-enabled"] !== "false"}
            onChange={(v) => updateSetting("orders-auto-cancel-enabled", String(v))} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="مدة مهلة التأكيد (أيام)" hint="عدد الأيام قبل إلغاء الطلب تلقائياً — بحد أقصى 3 أيام">
              <input type="number" min="1" max="3" dir="ltr" className={inputCls}
                value={settings["orders-auto-cancel-days"] || "3"}
                onChange={(e) => updateSetting("orders-auto-cancel-days", String(Math.min(3, Math.max(1, parseInt(e.target.value) || 3))))} />
            </Field>
            <Field label="محاولات التأكيد يومياً" hint="عدد محاولات الاتصال بالعميل يومياً">
              <input type="number" min="1" max="10" dir="ltr" className={inputCls}
                value={settings["confirmation-attempts-per-day"] || "3"}
                onChange={(e) => updateSetting("confirmation-attempts-per-day", String(Math.min(10, Math.max(1, parseInt(e.target.value) || 3))))} />
            </Field>
            <Field label="مدة مهلة التأكيد القصوى (أيام)" hint="الحد الأقصى لبقاء الطلب بانتظار التأكيد">
              <input type="number" min="1" max="3" dir="ltr" className={inputCls}
                value={settings["confirmation-duration-days"] || "3"}
                onChange={(e) => updateSetting("confirmation-duration-days", String(Math.min(3, Math.max(1, parseInt(e.target.value) || 3))))} />
            </Field>
          </div>

          <Field label="قنوات التأكيد" hint="القنوات المتاحة لفريق التأكيد — افصل بينها بفاصلة">
            <input type="text" dir="ltr" className={inputCls}
              value={settings["confirmation-channels"] || "WHATSAPP,PHONE"}
              onChange={(e) => updateSetting("confirmation-channels", e.target.value)} />
          </Field>

          <Field label="جدول محاولات التأكيد" hint="أوقات المحاولات اليومية — HH:MM مفصولة بفاصلة">
            <input type="text" dir="ltr" className={inputCls}
              value={settings["confirmation-attempt-schedule"] || "10:00,14:00,18:00"}
              onChange={(e) => updateSetting("confirmation-attempt-schedule", e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="تشغيل يدوي" desc="تشغيل وظيفة الإلغاء التلقائي الآن أو محاكاة النتيجة" icon={Zap}>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => runJob(true)} disabled={running || !canUpdate}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-[13px] font-semibold hover:bg-slate-50 disabled:opacity-40 transition-colors">
            <Eye size={14} /> محاكاة
          </button>
          <button onClick={() => runJob(false)} disabled={running || !canUpdate}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[13px] font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-all">
            {running ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            تشغيل الإلغاء التلقائي
          </button>
        </div>
        {runStatus && (
          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <p className="text-[12px] font-bold text-slate-700">
              النتيجة: {runStatus.scanned} طلب مفحوص — {runStatus.cancelled} ملغي — {runStatus.skipped} متجاوز
              {runStatus.dryRun ? " (محاكاة)" : ""}
            </p>
            <p className="text-[11px] text-slate-500">مفعّل: {runStatus.enabled ? "نعم" : "لا"} — المهلة: {runStatus.deadlineDays} يوم</p>
            {runStatus.details.length > 0 && (
              <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {runStatus.details.slice(0, 30).map((d, i) => (
                  <li key={i} className="text-[11px] text-slate-500">• {d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

/* ─────────────────────────── تبويب الأمان ─────────────────────────── */

function SecurityTab({ passForm, setPassForm, savingPass, handlePasswordChange, activity, activityLoading, loadActivity, activityModule }: any) {
  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard title="تغيير كلمة المرور" desc="استخدم كلمة مرور قوية من 6 أحرف على الأقل" icon={KeyRound}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="كلمة المرور الحالية">
            <input type="password" value={passForm.current} onChange={(e) => setPassForm({ ...passForm, current: e.target.value })} dir="ltr" className={inputCls} placeholder="••••••••" />
          </Field>
          <Field label="كلمة المرور الجديدة">
            <input type="password" value={passForm.next} onChange={(e) => setPassForm({ ...passForm, next: e.target.value })} dir="ltr" className={inputCls} placeholder="••••••••" />
          </Field>
          <Field label="تأكيد كلمة المرور">
            <input type="password" value={passForm.confirm} onChange={(e) => setPassForm({ ...passForm, confirm: e.target.value })} dir="ltr" className={inputCls} placeholder="••••••••" />
          </Field>
        </div>
        <div className="mt-4">
          <button onClick={handlePasswordChange} disabled={savingPass || !passForm.current || !passForm.next}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[13px] font-semibold hover:bg-slate-800 disabled:opacity-40 transition-all">
            {savingPass ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
            {savingPass ? "جاري التغيير..." : "تغيير كلمة المرور"}
          </button>
        </div>
      </SectionCard>

      <SectionCard title="نشاط الحساب الأمني" desc="أحدث العمليات الحساسة على النظام" icon={ShieldCheck}>
        <ActivityList activity={activity} loading={activityLoading} module={activityModule} loadActivity={loadActivity} compact />
      </SectionCard>
    </div>
  )
}

/* ─────────────────────────── تبويب السجلات ─────────────────────────── */

interface ActivityProps {
  activity: any[]
  activityLoading: boolean
  activityModule: string
  loadActivity: (module?: string) => Promise<void>
}

interface ActivityListProps {
  activity: any[]
  loading: boolean
  module: string
  loadActivity: (module?: string) => Promise<void>
  compact?: boolean
}

function ActivityTab({ activity, activityLoading, activityModule, loadActivity }: ActivityProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <SectionCard title="سجل النشاط" desc="كل التغييرات الحساسة على النظام — Audit Log" icon={History}>
        <ActivityList activity={activity} loading={activityLoading} module={activityModule} loadActivity={loadActivity} />
      </SectionCard>

      <SectionCard title="إعدادات الصلاحيات" desc="إدارة المديرين وصلاحيات الوصول لكل قسم" icon={Users}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-[13px] text-slate-600">تحكم في صلاحيات كل مدير وفريق التأكيد من صفحة المديرين</p>
          <a href="/admin/managers"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[13px] font-semibold hover:bg-indigo-100 transition-colors">
            إدارة المديرين والصلاحيات <ExternalLink size={14} />
          </a>
        </div>
      </SectionCard>
    </div>
  )
}

function ActivityList({ activity, loading, module, loadActivity, compact }: ActivityListProps) {
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
        {ACTIVITY_MODULES.map((m) => (
          <button key={m.value || "all"} onClick={() => loadActivity(m.value)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors border
              ${module === m.value ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
            {m.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : activity.length === 0 ? (
        <div className="text-center py-8">
          <History size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-[13px] text-slate-400">لا توجد سجلات</p>
        </div>
      ) : (
        <div className={`space-y-2 overflow-y-auto pr-1 ${compact ? "max-h-[320px]" : "max-h-[480px]"}`}>
          {activity.map((a) => {
            const meta = ACTIVITY_META[a.action] || { icon: History, tint: "text-slate-500", bg: "bg-slate-100" }
            const Icon = meta.icon
            return (
              <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.bg}`}>
                  <Icon size={16} className={meta.tint} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-slate-800">{a.actionLabel}</p>
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">{MODULE_LABELS[a.module] || a.module}</span>
                  </div>
                  <p className="text-[12px] text-slate-500 mt-0.5 truncate">{a.details || "—"}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{a.user} · {formatDateTime(a.createdAt)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── مكونات مساعدة ─────────────────────────── */

const inputCls = "w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white"

function SectionCard({ title, desc, icon: Icon, children }: { title: string; desc: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Icon size={16} className="text-indigo-600" />
        </div>
        <div>
          <h2 className="text-[14px] font-bold text-slate-900">{title}</h2>
          <p className="text-[11px] text-slate-400">{desc}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function SwitchRow({ title, desc, checked, onChange, disabled }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-700">{title}</p>
        <p className="text-[11px] text-slate-400">{desc}</p>
      </div>
      <button onClick={() => onChange(!checked)} disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mr-3 disabled:opacity-40 ${checked ? "bg-indigo-600" : "bg-slate-200"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "right-0.5" : "right-[22px]"}`} />
      </button>
    </div>
  )
}

function RateRow({ g, onUpdate }: { g: any; onUpdate: (id: string, rate: number, days: number) => void }) {
  const [rate, setRate] = useState(String(g.rate))
  const [days, setDays] = useState(String(g.estimatedDays))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setRate(String(g.rate))
    setDays(String(g.estimatedDays))
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.rate, g.estimatedDays])

  const handleSave = async () => {
    setBusy(true)
    await onUpdate(g.id, Number(rate), Number(days))
    setBusy(false)
    setDirty(false)
  }

  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${dirty ? "border-amber-300 bg-amber-50/50" : "border-slate-100 hover:border-slate-200"}`}>
      <span className="text-[13px] font-semibold text-slate-700 w-28 sm:w-36 shrink-0 truncate">{g.governorate}</span>
      <input type="number" min="0" value={rate} onChange={(e) => { setRate(e.target.value); setDirty(true) }}
        className="flex-1 min-w-0 px-3 py-1.5 border border-slate-200 rounded-lg text-[13px] text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all" dir="ltr" />
      <span className="text-[11px] text-slate-400 hidden sm:block">ج.م</span>
      <input type="number" min="1" max="30" value={days} onChange={(e) => { setDays(e.target.value); setDirty(true) }}
        className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-[13px] text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all" dir="ltr" />
      {dirty && (
        <button onClick={handleSave} disabled={busy}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-semibold hover:bg-indigo-700 transition-colors shrink-0 disabled:opacity-40">
          {busy ? <Loader2 size={13} className="animate-spin" /> : "حفظ"}
        </button>
      )}
    </div>
  )
}

function InfoTile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} className="text-slate-400" />
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
      </div>
      <p className="text-[13px] font-bold text-slate-800">{value}</p>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-slate-200 animate-pulse" />
        <div className="space-y-2">
          <div className="h-5 w-40 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-3 w-64 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => <div key={t.id} className="h-10 w-28 bg-slate-200 rounded-xl animate-pulse shrink-0" />)}
      </div>
      <div className="space-y-4">
        <div className="h-40 bg-white border border-slate-100 rounded-2xl shadow-sm animate-pulse" />
        <div className="h-48 bg-white border border-slate-100 rounded-2xl shadow-sm animate-pulse" />
        <div className="h-40 bg-white border border-slate-100 rounded-2xl shadow-sm animate-pulse" />
      </div>
    </div>
  )
}

/* formaters (imported from utils via module scope is not possible in client? it is) */
import { formatDate, formatDateTime } from "@/lib/utils"
