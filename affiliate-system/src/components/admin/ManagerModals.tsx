"use client"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Mail,
  Phone,
  User,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  Crown,
  UserCog,
  ShieldCheck,
  CheckCircle2,
  PauseCircle,
  Loader2,
  Trash2,
  Activity,
  Calendar,
  Clock,
  BadgeCheck,
  Info,
  Shield,
  ListChecks,
  Ban,
  Unlock,
  Sparkles,
} from "lucide-react"
import Modal, { ModalSection } from "@/components/admin/Modal"
import PermissionsPicker from "@/components/admin/PermissionsPicker"
import Avatar from "@/components/admin/Avatar"
import Badge from "@/components/admin/Badge"
import { useToast } from "@/components/Toast"
import { formatDate, formatDateTime } from "@/lib/utils"
import { PERMISSIONS } from "@/lib/permissions"

const ACTIONS_LABELS: Record<string, string> = {
  ACCOUNT_CREATED: "تم إنشاء الحساب",
  ACCOUNT_UPDATED: "تم تعديل البيانات",
  PASSWORD_CHANGED: "تم تغيير كلمة المرور",
  PERMISSIONS_UPDATED: "تم تحديث الصلاحيات",
  LOGIN: "تسجيل دخول",
  ORDERS_ASSIGNED: "تم إسناد طلبات",
  AUTO_DISTRIBUTED: "توزيع تلقائي",
}

const ACTION_TINTS: Record<string, string> = {
  ACCOUNT_CREATED: "#059669",
  ACCOUNT_UPDATED: "#2563eb",
  PASSWORD_CHANGED: "#d97706",
  PERMISSIONS_UPDATED: "#7c3aed",
  LOGIN: "#0891b2",
  ORDERS_ASSIGNED: "#db2777",
  AUTO_DISTRIBUTED: "#7c3aed",
}

export function timeAgo(date?: string | Date | null): string {
  if (!date) return ""
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "الآن"
  if (mins < 60) return `منذ ${mins} د`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} س`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `منذ ${days} يوم`
  const months = Math.floor(days / 30)
  if (months < 12) return `منذ ${months} شهر`
  return `منذ ${Math.floor(months / 12)} سنة`
}

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let s = 0
  if (pw.length >= 6) s++
  if (pw.length >= 10) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s++
  const map = [
    { label: "ضعيفة", color: "#f43f5e" },
    { label: "ضعيفة", color: "#f43f5e" },
    { label: "متوسطة", color: "#f59e0b" },
    { label: "جيدة", color: "#22c55e" },
    { label: "قوية", color: "#059669" },
  ]
  return { score: s, ...map[s] }
}

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
  const bytes = new Uint8Array(14)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join("")
}

function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
      {error && <p className="text-[11px] font-semibold text-red-500 mt-1">{error}</p>}
    </div>
  )
}

const inputCls = (error?: string) => `input-premium ${error ? "input-error" : ""}`

const PRIMARY_BTN = "inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm shadow-indigo-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
const GHOST_BTN = "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-colors disabled:opacity-50"

interface Row { id?: string; name?: string; email?: string; phone?: string | null; status?: string; lastLogin?: string | null; createdAt?: string; isSuperAdmin?: boolean; permissions?: string[] }

/* ═══════════════════════════  إضافة / تعديل مدير  ═══════════════════════════ */
export function ManagerModal({ row, onClose, onSaved }: { row: Row | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const isEdit = !!row?.id
  const isSuper = !!row?.isSuperAdmin

  const [name, setName] = useState(row?.name || "")
  const [phone, setPhone] = useState(row?.phone || "")
  const [email, setEmail] = useState(row?.email || "")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState(row?.status || "ACTIVE")
  const [permissions, setPermissions] = useState<string[]>(row?.permissions || [])
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const initialPermissions = useMemo(() => (row?.permissions || []).slice().sort(), [row])
  const strength = passwordStrength(password)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = "الاسم الكامل مطلوب"
    else if (name.trim().length < 3) e.name = "الاسم قصير جداً"
    if (phone.trim() && !/^[+\d][\d\s\-]{7,14}$/.test(phone.trim())) e.phone = "رقم الهاتف غير صحيح"
    if (!isEdit) {
      if (!email.trim()) e.email = "البريد الإلكتروني مطلوب"
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "صيغة البريد الإلكتروني غير صحيحة"
      if (!password) e.password = "كلمة المرور مطلوبة"
      else if (password.length < 6) e.password = "كلمة المرور 6 أحرف على الأقل"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const permsChanged = JSON.stringify(initialPermissions) !== JSON.stringify(permissions.slice().sort())
      const payload = isEdit
        ? { name: name.trim(), phone: phone.trim(), status, ...(!isSuper && permsChanged ? { permissions } : {}) }
        : { name: name.trim(), phone: phone.trim(), status, permissions, email: email.trim(), password }
      const res = await fetch(isEdit ? `/api/admin/managers/${row?.id}` : "/api/admin/managers", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(isEdit ? "تم تحديث المدير بنجاح" : "تم إضافة المدير بنجاح", "success")
        onSaved()
        onClose()
      } else {
        toast(data.error || "حدث خطأ، حاول مرة أخرى", "error")
      }
    } catch {
      toast("خطأ في الاتصال بالخادم", "error")
    }
    setSaving(false)
  }

  return (
    <Modal
      title={isEdit ? "تعديل المدير" : "إضافة مدير جديد"}
      subtitle={isEdit ? `تعديل بيانات ${row?.name}` : "إنشاء حساب مدير بصلاحيات محددة"}
      icon={isEdit ? <UserCog size={16} /> : <User size={16} />}
      gradient={isEdit ? "linear-gradient(135deg, #1e40af, #3b82f6)" : "linear-gradient(135deg, #312e81, #6366f1)"}
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button type="button" onClick={onClose} className={GHOST_BTN}>
            إلغاء
          </button>
          <button type="button" onClick={submit} disabled={saving} className={PRIMARY_BTN}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : isEdit ? <CheckCircle2 size={15} /> : <User size={15} />}
            {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة المدير"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* البيانات الشخصية */}
        <ModalSection title="البيانات الشخصية" subtitle="الاسم وبيانات الاتصال" icon={<User size={15} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="الاسم الكامل" required error={errors.name}>
              <input value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: "" })) }} className={inputCls(errors.name)} placeholder="اسم المدير" />
            </Field>
            <Field label="رقم الهاتف" error={errors.phone} hint="اختياري">
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                <input value={phone} onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors((p) => ({ ...p, phone: "" })) }} dir="ltr" className={`${inputCls(errors.phone)} pl-9`} placeholder="01XXXXXXXXX" />
              </div>
            </Field>
          </div>
        </ModalSection>

        {/* بيانات تسجيل الدخول */}
        <ModalSection title="بيانات تسجيل الدخول" subtitle={isEdit ? "البريد لا يمكن تغييره" : "البريد وكلمة المرور لتسجيل الدخول"} icon={<KeyRound size={15} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="البريد الإلكتروني" required={!isEdit} error={errors.email}>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  disabled={isEdit}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: "" })) }}
                  dir="ltr"
                  className={`${inputCls(errors.email)} pl-9 ${isEdit ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""}`}
                  placeholder="name@example.com"
                />
              </div>
            </Field>
            {!isEdit ? (
              <Field label="كلمة المرور" required error={errors.password}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: "" })) }}
                      dir="ltr"
                      className={`${inputCls(errors.password)} pl-9 font-mono`}
                      placeholder="6 أحرف على الأقل"
                    />
                    <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 transition-colors text-slate-400">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPassword(generatePassword())}
                    title="توليد كلمة مرور عشوائية"
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
                  >
                    <Sparkles size={13} /> توليد
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength.score ? "" : "bg-slate-100"}`} style={i < strength.score ? { background: strength.color } : undefined} />
                      ))}
                    </div>
                    <p className="text-[10px] font-semibold mt-1" style={{ color: strength.color }}>قوة كلمة المرور: {strength.label}</p>
                  </div>
                )}
              </Field>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl bg-sky-50 border border-sky-100">
                <Info size={14} className="text-sky-500 shrink-0" />
                <p className="text-[11px] font-semibold text-sky-700">تغيير كلمة المرور يتم من خيار «تغيير كلمة المرور»</p>
              </div>
            )}
          </div>
        </ModalSection>

        {/* الدور */}
        <ModalSection title="الدور" subtitle="صلاحية المدير على مستوى النظام" icon={<ShieldCheck size={15} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all ${!isSuper ? "border-indigo-500 bg-indigo-50/50" : "border-slate-100"}`}>
              <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0"><UserCog size={16} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                  مدير
                  {!isSuper && <Badge variant="indigo">الحالي</Badge>}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">صلاحيات مخصصة حسب ما تحدده في قسم الصلاحيات.</p>
              </div>
            </div>
            <div className={`flex items-start gap-3 p-4 rounded-xl border-2 ${isSuper ? "border-violet-500 bg-violet-50/50" : "border-slate-100 opacity-60"}`}>
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isSuper ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-400"}`}><Crown size={16} /></span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                  مدير عام
                  {isSuper && <Badge variant="violet">الحالي</Badge>}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed flex items-start gap-1">
                  <Lock size={11} className="mt-0.5 shrink-0" />
                  يملك جميع الصلاحيات تلقائياً ولا يُنشأ من هذه الصفحة.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">حالة الحساب</label>
            <div className="flex gap-2">
              {[
                { key: "ACTIVE", label: "نشط", icon: CheckCircle2, activeCls: "border-emerald-500 bg-emerald-50/60 text-emerald-700", iconCls: "text-emerald-500" },
                { key: "INACTIVE", label: "غير نشط", icon: PauseCircle, activeCls: "border-slate-300 bg-slate-50 text-slate-600", iconCls: "text-slate-400" },
              ].map((o) => (
                <button
                  key={o.key}
                  type="button"
                  disabled={isSuper && o.key === "INACTIVE"}
                  onClick={() => setStatus(o.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all border-2 ${
                    status === o.key ? o.activeCls : "border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <o.icon size={13} className={status === o.key ? o.iconCls : ""} />
                  {o.label}
                </button>
              ))}
            </div>
            {isSuper && <p className="text-[10px] text-slate-400 mt-1.5">لا يمكن تعطيل المدير العام.</p>}
          </div>
        </ModalSection>

        {/* الصلاحيات */}
        <ModalSection
          title="الصلاحيات"
          subtitle={isSuper ? "المدير العام يملك جميع الصلاحيات" : "حدد الموديولات والصلاحيات المسموحة"}
          icon={<ListChecks size={15} />}
          badge={<Badge variant={isSuper ? "violet" : permissions.length > 0 ? "indigo" : "neutral"}>{isSuper ? "الكل" : `${permissions.length} صلاحية`}</Badge>}
        >
          <PermissionsPicker value={permissions} onChange={setPermissions} locked={isSuper} />
        </ModalSection>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════  عرض مدير  ═══════════════════════════ */
export function ViewManagerModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const [activities, setActivities] = useState<any[] | null>(null)

  useEffect(() => {
    if (!row.id) return
    fetch(`/api/admin/managers/${row.id}/activity`)
      .then((r) => r.json())
      .then((d) => setActivities(Array.isArray(d) ? d : []))
      .catch(() => setActivities([]))
  }, [row.id])

  const granted = useMemo(() => PERMISSIONS.filter((p) => row.permissions?.includes(p.key)), [row])
  const isActive = row.status === "ACTIVE"

  return (
    <Modal
      title="عرض المدير"
      subtitle={`ملف ${row.name}`}
      icon={<User size={16} />}
      gradient="linear-gradient(135deg, #0e7490, #06b6d4)"
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={GHOST_BTN}>إغلاق</button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white">
          <Avatar name={row.name} isSuperAdmin={row.isSuperAdmin} size="xl" status={row.status} showStatus />
          <div className="flex-1 text-center sm:text-right">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h3 className="text-[16px] font-extrabold text-slate-900">{row.name}</h3>
              {row.isSuperAdmin && <Badge variant="violet" icon={<Crown size={11} />}>مدير عام</Badge>}
            </div>
            <p className="text-[12px] text-slate-400 mt-1" dir="ltr">{row.email}</p>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2.5">
              <Badge variant={isActive ? "success" : "neutral"} dot>{isActive ? "نشط" : "غير نشط"}</Badge>
              <Badge variant="indigo" icon={<Shield size={11} />}>{granted.length} صلاحية</Badge>
            </div>
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "رقم الهاتف", value: row.phone || "—", icon: Phone, ltr: !!row.phone },
            { label: "آخر تسجيل دخول", value: row.lastLogin ? formatDateTime(row.lastLogin) : "لم يسجل بعد", icon: Clock },
            { label: "تاريخ الإنشاء", value: formatDate(row.createdAt as any), icon: Calendar },
            { label: "عدد الصلاحيات", value: String(granted.length), icon: ListChecks },
            { label: "عدد الأنشطة", value: activities === null ? "..." : String(activities.length), icon: Activity },
            { label: "الحالة", value: isActive ? "نشط" : "غير نشط", icon: isActive ? CheckCircle2 : PauseCircle },
          ].map((m) => (
            <div key={m.label} className="bg-slate-50 rounded-xl p-3.5">
              <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                <m.icon size={11} /> {m.label}
              </p>
              <p className={`text-[12px] font-bold text-slate-700 truncate ${m.ltr ? "dir-ltr text-left" : ""}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Permissions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5"><BadgeCheck size={14} className="text-indigo-500" /> الصلاحيات الممنوحة</p>
            <span className="text-[11px] font-semibold text-slate-400">{granted.length} / {PERMISSIONS.length}</span>
          </div>
          {granted.length === 0 ? (
            <p className="text-[12px] text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">لا توجد صلاحيات مخصصة</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {granted.map((p) => (
                <span key={p.key} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-semibold">
                  <CheckCircle2 size={11} /> {p.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div>
          <p className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5 mb-2"><Activity size={14} className="text-violet-500" /> آخر الأنشطة</p>
          {activities === null ? (
            <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-slate-400">
              <Loader2 size={14} className="animate-spin text-indigo-500" /> جاري التحميل...
            </div>
          ) : activities.length === 0 ? (
            <p className="text-[12px] text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">لا يوجد نشاط مسجل بعد</p>
          ) : (
            <div className="space-y-0">
              {activities.slice(0, 5).map((a, i) => (
                <div key={a.id} className="flex gap-3 pb-3">
                  <div className="flex flex-col items-center">
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: ACTION_TINTS[a.action] || "#6366f1" }} />
                    {i < Math.min(activities.length, 5) - 1 && <span className="w-px flex-1 bg-slate-100 my-1" />}
                  </div>
                  <div className="pb-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-700">{ACTIONS_LABELS[a.action] || a.action}</p>
                    {a.details && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{a.details}</p>}
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Clock size={10} /> {timeAgo(a.createdAt)} · {formatDateTime(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════  الصلاحيات فقط  ═══════════════════════════ */
export function PermissionsModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [permissions, setPermissions] = useState<string[]>(row?.permissions || [])
  const [saving, setSaving] = useState(false)
  const isSuper = !!row?.isSuperAdmin

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/managers/${row?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast("تم تحديث الصلاحيات بنجاح", "success")
        onSaved()
        onClose()
      } else {
        toast(data.error || "حدث خطأ، حاول مرة أخرى", "error")
      }
    } catch {
      toast("خطأ في الاتصال بالخادم", "error")
    }
    setSaving(false)
  }

  return (
    <Modal
      title="إدارة الصلاحيات"
      subtitle={`صلاحيات ${row?.name}`}
      icon={<ListChecks size={16} />}
      gradient="linear-gradient(135deg, #6d28d9, #8b5cf6)"
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button type="button" onClick={onClose} className={GHOST_BTN}>إلغاء</button>
          {!isSuper && (
            <button type="button" onClick={submit} disabled={saving} className={PRIMARY_BTN}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <ListChecks size={15} />}
              {saving ? "جاري الحفظ..." : "حفظ الصلاحيات"}
            </button>
          )}
        </div>
      }
    >
      <PermissionsPicker value={permissions} onChange={setPermissions} locked={isSuper} />
      <p className="text-[11px] text-slate-400 mt-4 flex items-start gap-1.5">
        <Info size={13} className="shrink-0 mt-0.5 text-slate-300" />
        الصلاحيات تحدد الوصول الفعلي للمدير داخل لوحة التحكم. المدير العام يملك جميع الصلاحيات تلقائياً.
      </p>
    </Modal>
  )
}

/* ═══════════════════════════  تغيير كلمة المرور  ═══════════════════════════ */
export function PasswordModal({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const strength = passwordStrength(password)

  const submit = async () => {
    if (password.length < 6) { setError("كلمة المرور 6 أحرف على الأقل"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/managers/${row?.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast("تم تغيير كلمة المرور بنجاح", "success")
        onSaved()
        onClose()
      } else {
        toast(data.error || "حدث خطأ، حاول مرة أخرى", "error")
      }
    } catch {
      toast("خطأ في الاتصال بالخادم", "error")
    }
    setSaving(false)
  }

  return (
    <Modal
      title="تغيير كلمة المرور"
      subtitle={`حساب ${row?.name}`}
      icon={<KeyRound size={16} />}
      gradient="linear-gradient(135deg, #92400e, #f59e0b)"
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button type="button" onClick={onClose} className={GHOST_BTN}>إلغاء</button>
          <button type="button" onClick={submit} disabled={saving} className={PRIMARY_BTN}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
            {saving ? "جاري التغيير..." : "تغيير كلمة المرور"}
          </button>
        </div>
      }
    >
      <Field label="كلمة المرور الجديدة" required error={error} hint="6 أحرف على الأقل">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError("") }}
              dir="ltr"
              className={`${inputCls(error)} pl-9 font-mono`}
              placeholder="••••••••"
              autoFocus
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 transition-colors text-slate-400">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setPassword(generatePassword())}
            title="توليد كلمة مرور عشوائية"
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1 transition-colors shrink-0"
          >
            <Sparkles size={13} /> توليد
          </button>
        </div>
        {password && (
          <div className="mt-2.5">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength.score ? "" : "bg-slate-100"}`} style={i < strength.score ? { background: strength.color } : undefined} />
              ))}
            </div>
            <p className="text-[10px] font-semibold mt-1" style={{ color: strength.color }}>قوة كلمة المرور: {strength.label}</p>
          </div>
        )}
      </Field>
    </Modal>
  )
}

/* ═══════════════════════════  حذف مدير  ═══════════════════════════ */
export function DeleteManagerModal({ row, onClose, onDeleted }: { row: Row; onClose: () => void; onDeleted: () => void }) {
  const { toast } = useToast()
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const matched = confirm.trim() === row?.name

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/managers/${row?.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast("تم حذف المدير نهائياً", "success")
        onDeleted()
        onClose()
      } else {
        toast(data.error || "حدث خطأ، حاول مرة أخرى", "error")
      }
    } catch {
      toast("خطأ في الاتصال بالخادم", "error")
    }
    setSaving(false)
  }

  return (
    <Modal
      title="حذف المدير"
      subtitle="إجراء لا يمكن التراجع عنه"
      icon={<Trash2 size={16} />}
      gradient="linear-gradient(135deg, #b91c1c, #ef4444)"
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button type="button" onClick={onClose} className={GHOST_BTN}>إلغاء</button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !matched}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-red-600 to-red-500 shadow-sm shadow-red-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            {saving ? "جاري الحذف..." : "حذف نهائي"}
          </button>
        </div>
      }
    >
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} className="text-red-500" />
        </div>
        <p className="text-[13px] text-slate-600 leading-relaxed">
          سيتم حذف حساب «<span className="font-bold text-slate-900">{row?.name}</span>» نهائياً مع كل بياناته وسجل نشاطه.
        </p>
        <div className="mt-5 text-right">
          <Field label={`اكتب اسم المدير للتأكيد: ${row?.name}`} required>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls(confirm && !matched ? "error" : undefined)} placeholder="اكتب اسم المدير هنا" />
          </Field>
          {confirm && !matched && <p className="text-[11px] font-semibold text-red-500 mt-1">الاسم غير مطابق</p>}
        </div>
      </div>
    </Modal>
  )
}

/* ═══════════════════════════  تفعيل / تعطيل  ═══════════════════════════ */
export function ToggleStatusModal({ row, onClose, onDone }: { row: Row; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const isActive = row.status === "ACTIVE"
  const next = isActive ? "INACTIVE" : "ACTIVE"

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/managers/${row?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(isActive ? "تم تعطيل الحساب" : "تم تفعيل الحساب", "success")
        onDone()
        onClose()
      } else {
        toast(data.error || "حدث خطأ، حاول مرة أخرى", "error")
      }
    } catch {
      toast("خطأ في الاتصال بالخادم", "error")
    }
    setSaving(false)
  }

  return (
    <Modal
      title={isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
      subtitle={`حساب ${row?.name}`}
      icon={isActive ? <Ban size={16} /> : <Unlock size={16} />}
      gradient={isActive ? "linear-gradient(135deg, #b45309, #f59e0b)" : "linear-gradient(135deg, #047857, #10b981)"}
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <button type="button" onClick={onClose} className={GHOST_BTN}>إلغاء</button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 ${
              isActive ? "bg-gradient-to-r from-amber-600 to-orange-500 shadow-amber-200" : "bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-emerald-200"
            }`}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : isActive ? <Ban size={15} /> : <Unlock size={15} />}
            {saving ? "جاري التنفيذ..." : isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
          </button>
        </div>
      }
    >
      <div className="text-center py-2">
        <p className="text-[13px] text-slate-600 leading-relaxed">
          {isActive ? (
            <>سيصبح المدير <span className="font-bold text-slate-900">{row?.name}</span> غير قادر على تسجيل الدخول، وستبقى بياناته محفوظة.</>
          ) : (
            <>سيتمكن المدير <span className="font-bold text-slate-900">{row?.name}</span> من تسجيل الدخول مرة أخرى فوراً.</>
          )}
        </p>
      </div>
    </Modal>
  )
}
