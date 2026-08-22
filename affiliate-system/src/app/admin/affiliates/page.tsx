"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Users,
  UserCheck,
  ShoppingCart,
  Coins,
  Wallet,
  Banknote,
  Search,
  Loader2,
  Eye,
  Ban,
  CheckCircle2,
  PauseCircle,
  Copy,
  MoreVertical,
  X,
  Download,
  Plus,
  Bell,
  Phone,
  MessageCircle,
  Calendar,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Edit3,
  Link2,
  FilterX,
  UserPlus,
  KeyRound,
} from "lucide-react"
import { formatCurrency, formatDate, getStatusColor, getStatusText } from "@/lib/utils"
import { useToast } from "@/components/Toast"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import Pagination from "@/components/Pagination"
import ConfirmDialog from "@/components/ConfirmDialog"

const PER_PAGE = 12

const STATUS_OPTIONS = [
  { key: "", label: "الكل", icon: Users },
  { key: "ACTIVE", label: "نشط", icon: CheckCircle2 },
  { key: "INACTIVE", label: "غير نشط", icon: PauseCircle },
  { key: "SUSPENDED", label: "معلق", icon: Ban },
]

const SEARCH_FIELDS = [
  { key: "all", label: "بحث في كل الحقول" },
  { key: "name", label: "الاسم" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "phone", label: "رقم الهاتف" },
  { key: "referral", label: "كود الإحالة" },
]

const NOTIF_TYPES = [
  { value: "INFO", label: "معلومات", color: "bg-blue-50 text-blue-600" },
  { value: "SYSTEM", label: "إشعار نظام", color: "bg-purple-50 text-purple-600" },
  { value: "ORDER", label: "طلبات", color: "bg-green-50 text-green-600" },
  { value: "WITHDRAWAL", label: "سحب", color: "bg-yellow-50 text-yellow-600" },
]

const STAT_CARDS = [
  { key: "total", label: "إجمالي المسوقين", icon: Users, tint: "#4f46e5", text: "text-indigo-600", format: (n: number) => n.toLocaleString("ar-EG") },
  { key: "active", label: "النشطين", icon: UserCheck, tint: "#059669", text: "text-emerald-600", format: (n: number) => n.toLocaleString("ar-EG") },
  { key: "totalOrders", label: "إجمالي الطلبات", icon: ShoppingCart, tint: "#2563eb", text: "text-blue-600", format: (n: number) => n.toLocaleString("ar-EG") },
  { key: "totalCommissions", label: "إجمالي العمولات", icon: Coins, tint: "#7c3aed", text: "text-violet-600", format: (n: number) => formatCurrency(n) },
  { key: "totalOwed", label: "الرصيد المستحق", icon: Wallet, tint: "#d97706", text: "text-amber-600", format: (n: number) => formatCurrency(n) },
  { key: "totalWithdrawn", label: "المسحوب", icon: Banknote, tint: "#64748b", text: "text-slate-600", format: (n: number) => formatCurrency(n) },
]

const toWhatsApp = (phone: string) => {
  const digits = phone.replace(/[^\d]/g, "")
  const intl = digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? "2" + digits : digits
  return `https://wa.me/${intl}`
}

function StatCard({ label, value, icon: Icon, tint, text }: { label: string; value: string; icon: any; tint: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400">{label}</p>
          <p className={`text-xl sm:text-2xl font-extrabold mt-1 truncate tabular-nums ${text}`}>{value}</p>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tint}12` }}>
          <Icon size={18} style={{ color: tint }} />
        </div>
      </div>
    </div>
  )
}

function SortHeader({ label, myKey, sortKey, sortDir, onSort }: { label: string; myKey: string; sortKey: string; sortDir: "asc" | "desc"; onSort: () => void }) {
  const active = sortKey === myKey
  return (
    <button onClick={onSort} className="inline-flex items-center gap-1 hover:text-slate-700 transition-colors" title="فرز">
      {label}
      {active ? (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
    </button>
  )
}

function ActionsMenu({ row, onView, onToggleStatus, onNotify, onCopyLink, can }: {
  row: any
  onView: (r: any) => void
  onToggleStatus: (r: any) => void
  onNotify: (r: any) => void
  onCopyLink: (r: any) => void
  can: (key: string) => boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const isActive = row.status === "ACTIVE"
  const items = [
    { key: "view", label: "عرض التفاصيل", icon: Eye, tint: "#4f46e5", onClick: () => { onView(row); setOpen(false) } },
    ...(can("affiliates.update") ? [{ key: "edit", label: "تعديل", icon: Edit3, tint: "#2563eb", onClick: () => { onView(row); setOpen(false) } }] : []),
    { key: "orders", label: "عرض الطلبات", icon: ShoppingCart, tint: "#2563eb", onClick: () => { setOpen(false); window.location.href = "/admin/orders" } },
    { key: "profits", label: "عرض الأرباح والعمولات", icon: Coins, tint: "#7c3aed", onClick: () => { onView(row); setOpen(false) } },
    ...(can("affiliates.update") ? [{
      key: "toggle", label: isActive ? "تعليق الحساب" : "تفعيل الحساب", icon: isActive ? Ban : CheckCircle2,
      tint: isActive ? "#dc2626" : "#059669", danger: isActive,
      onClick: () => { onToggleStatus(row); setOpen(false) },
    }] : []),
    ...(can("notifications.send") ? [{ key: "notify", label: "إرسال إشعار", icon: Bell, tint: "#d97706", onClick: () => { onNotify(row); setOpen(false) } }] : []),
    { key: "copy", label: "نسخ رابط الإحالة", icon: Link2, tint: "#64748b", onClick: () => { onCopyLink(row); setOpen(false) } },
  ]

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all" aria-label="إجراءات">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-xl border border-slate-100 shadow-lg shadow-slate-200/50 z-20 py-1.5 max-h-80 overflow-y-auto">
          {items.map(item => (
            <button key={item.key} onClick={item.onClick}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-semibold text-right transition-colors hover:bg-slate-50 ${item.danger ? "text-red-600" : "text-slate-700"}`}>
              <item.icon size={14} style={{ color: item.tint }} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
      <p className="text-[10px] font-semibold text-slate-400">{label}</p>
      <p className="text-[13px] font-bold tabular-nums mt-0.5" style={{ color: tint }}>{value}</p>
    </div>
  )
}

function AffiliateModal({ row, onClose, onSave }: {
  row: any
  onClose: () => void
  onSave: (id: string, data: { name: string; phone: string; status: string }) => Promise<boolean>
}) {
  const [name, setName] = useState(row.name || "")
  const [phone, setPhone] = useState(row.phone || "")
  const [status, setStatus] = useState(row.status)
  const [saving, setSaving] = useState(false)

  const options = [
    { key: "ACTIVE", label: "نشط", desc: "المسوق يعمل بشكل طبيعي ويمكنه عرض المنتجات والطلب", icon: CheckCircle2, ring: "border-emerald-500 bg-emerald-50/50", iconColor: "#059669" },
    { key: "INACTIVE", label: "غير نشط", desc: "الحساب متاح لكن غير مفعّل للعمل مؤقتاً", icon: PauseCircle, ring: "border-slate-400 bg-slate-50", iconColor: "#64748b" },
    { key: "SUSPENDED", label: "معلق", desc: "تم تجميد الحساب بالكامل ولا يمكنه الدخول", icon: Ban, ring: "border-red-500 bg-red-50/50", iconColor: "#dc2626" },
  ]

  const submit = async () => {
    if (!name.trim()) return
    setSaving(true)
    const ok = await onSave(row.id, { name: name.trim(), phone: phone.trim(), status })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="h-20 rounded-t-2xl relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
          <button onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={16} /></button>
        </div>
        <div className="px-6 -mt-10 pb-6">
          <div className="flex items-end gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white border-4 border-white shadow-lg" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
              {(row.name || "؟").charAt(0)}
            </div>
            <div className="pb-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900 truncate">{row.name}</h2>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${getStatusColor(row.status)}`}>{getStatusText(row.status)}</span>
              </div>
              <p className="text-[12px] text-slate-500" dir="ltr">{row.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">اسم المسوق</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input-premium" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">رقم الهاتف</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" className="input-premium" placeholder="01XXXXXXXXX" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mt-2.5">
            <MiniStat label="الطلبات" value={row._count.orders.toLocaleString("ar-EG")} tint="#2563eb" />
            <MiniStat label="إجمالي العمولات" value={formatCurrency(row.commissions)} tint="#7c3aed" />
            <MiniStat label="الرصيد المستحق" value={formatCurrency(row.owed)} tint="#d97706" />
            <MiniStat label="المسحوب" value={formatCurrency(row.withdrawn)} tint="#64748b" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 mt-2.5 text-[12px]">
            <div className="bg-slate-50 rounded-xl px-3 py-2.5 col-span-2">
              <p className="text-[10px] font-semibold text-slate-400 mb-1">رابط الإحالة</p>
              <div className="flex items-center gap-2">
                <code className="font-mono text-[12px] text-indigo-700 font-semibold truncate flex-1 min-w-0" dir="ltr">{`${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${row.referralCode}`}</code>
                <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/register?ref=${row.referralCode}`)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-500 transition-colors shrink-0" title="نسخ الرابط"><Link2 size={13} /></button>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-slate-400 mb-0.5">تاريخ الانضمام</p>
              <p className="font-semibold text-slate-700">{formatDate(row.createdAt)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold text-slate-400 mb-0.5">كود الإحالة</p>
              <p className="font-mono text-[11px] font-semibold text-slate-700 truncate" dir="ltr">{row.referralCode}</p>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <h3 className="text-[13px] font-bold text-slate-800 mb-2.5">تغيير حالة المسوق</h3>
            <div className="space-y-2">
              {options.map(o => (
                <button key={o.key} onClick={() => setStatus(o.key)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-right transition-all ${status === o.key ? o.ring + " shadow-sm" : "border-slate-100 hover:border-slate-200"}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${o.iconColor}12` }}>
                    <o.icon size={15} style={{ color: o.iconColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-800">{o.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{o.desc}</p>
                  </div>
                  {status === o.key && <CheckCircle2 size={16} className="mr-auto shrink-0" style={{ color: o.iconColor }} />}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={submit} disabled={saving || !name.trim()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-colors">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
              <button onClick={() => { window.location.href = "/admin/orders" }} className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[13px] font-semibold transition-colors flex items-center gap-1.5">
                <ShoppingCart size={14} /> الطلبات
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddAffiliateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", status: "ACTIVE" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const generatePass = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    setForm(f => ({ ...f, password: Array.from(bytes, b => chars[b % chars.length]).join("") }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.email.trim() || !form.password) { setError("الاسم والبريد وكلمة المرور مطلوبة"); return }
    if (form.password.length < 6) { setError("كلمة المرور 6 أحرف على الأقل"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/affiliates/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(`تم إضافة "${form.name.trim()}" كم مسوق جديد`, "success")
        onCreated()
      } else {
        setError(data.error || "حدث خطأ")
      }
    } catch { setError("خطأ في الاتصال") }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="h-20 rounded-t-2xl relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
          <button onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={16} /></button>
          <div className="absolute bottom-3 right-5 text-white">
            <h2 className="text-[16px] font-extrabold">إضافة مسوق جديد</h2>
            <p className="text-[11px] text-white/70">سيتم إنشاء حساب بالبريد وكلمة المرور التالية</p>
          </div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-[12px] font-semibold px-4 py-2.5 rounded-xl">{error}</div>}
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الاسم الكامل *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-premium" placeholder="اسم المسوق" required />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">البريد الإلكتروني *</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" className="input-premium" placeholder="name@example.com" required />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">رقم الهاتف</label>
            <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" className="input-premium" placeholder="01XXXXXXXXX" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">كلمة المرور *</label>
            <div className="flex gap-2">
              <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} dir="ltr" className="input-premium flex-1 font-mono" placeholder="6 أحرف على الأقل" required />
              <button type="button" onClick={generatePass} className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0">
                <KeyRound size={13} /> توليد
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الحالة</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input-premium">
              <option value="ACTIVE">نشط</option>
              <option value="INACTIVE">غير نشط</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-[13px] flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {saving ? "جاري الإضافة..." : "إضافة المسوق"}
          </button>
        </form>
      </div>
    </div>
  )
}

function NotifyModal({ allIds, initialIds, initialLabel, onClose, onSent }: {
  allIds: string[]
  initialIds: string[]
  initialLabel: string
  onClose: () => void
  onSent: () => void
}) {
  const { toast } = useToast()
  const [mode, setMode] = useState<"specific" | "all">("specific")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [type, setType] = useState("INFO")
  const [sending, setSending] = useState(false)

  const count = mode === "all" ? allIds.length : initialIds.length

  const submit = async () => {
    if (!title.trim() || !message.trim()) { toast("اكتب العنوان والرسالة", "error"); return }
    const targetIds = mode === "all" ? allIds : initialIds
    if (targetIds.length === 0) { toast("لا يوجد مستلمون", "error"); return }
    setSending(true)
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, type, targetIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(`تم إرسال الإشعار إلى ${data.count} مسوق`, "success")
        onSent()
        onClose()
      } else {
        toast(data.error || "حدث خطأ", "error")
      }
    } catch { toast("خطأ في الاتصال", "error") }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="h-20 rounded-t-2xl relative overflow-hidden" style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
          <button onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={16} /></button>
          <div className="absolute bottom-3 right-5 text-white">
            <h2 className="text-[16px] font-extrabold">إرسال إشعار للمسوقين</h2>
            <p className="text-[11px] text-white/70">يظهر الإشعار في صفحة إشعارات المسوق</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("specific")}
              className={`p-3 rounded-xl border-2 text-right transition-all ${mode === "specific" ? "border-indigo-500 bg-indigo-50/50" : "border-slate-100 hover:border-slate-200"}`}>
              <p className="text-[12px] font-bold text-slate-800">{initialLabel}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">المرشحون حالياً ({initialIds.length})</p>
            </button>
            <button type="button" onClick={() => setMode("all")}
              className={`p-3 rounded-xl border-2 text-right transition-all ${mode === "all" ? "border-indigo-500 bg-indigo-50/50" : "border-slate-100 hover:border-slate-200"}`}>
              <p className="text-[12px] font-bold text-slate-800">جميع المسوقين</p>
              <p className="text-[10px] text-slate-500 mt-0.5">({allIds.length})</p>
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5">
            <span>عدد المستلمين</span>
            <span className="font-bold text-slate-800 tabular-nums">{count.toLocaleString("ar-EG")}</span>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">عنوان الإشعار *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="input-premium" placeholder="مثال: مناسبة خاصة" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">نص الإشعار *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} className="input-premium resize-none" placeholder="اكتب نص الإشعار..." />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">النوع</label>
            <div className="flex flex-wrap gap-2">
              {NOTIF_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${type === t.value ? `${t.color} border-transparent shadow-sm` : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={submit} disabled={sending} className="btn-primary w-full py-3 text-[13px] flex items-center justify-center gap-2 disabled:opacity-50">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
            {sending ? "جاري الإرسال..." : "إرسال الإشعار"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminAffiliatesPage() {
  const { toast } = useToast()
  const perms = usePermissions()
  const can = perms.can
  const [affiliates, setAffiliates] = useState<any[]>([])
  const [perUser, setPerUser] = useState<Record<string, any>>({})
  const [totals, setTotals] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchField, setSearchField] = useState("all")
  const [statusFilter, setStatusFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sortKey, setSortKey] = useState("commissions")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [notify, setNotify] = useState<{ ids: string[]; label: string } | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<any>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch("/api/admin/affiliates").then(r => r.json()),
      fetch("/api/admin/affiliates/stats").then(r => r.json()),
    ]).then(([list, stats]) => {
      setAffiliates(Array.isArray(list) ? list : [])
      setPerUser(stats?.perUser || {})
      setTotals(stats?.totals || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null
    const toTs = dateTo ? new Date(dateTo + "T23:59:59.999").getTime() : null
    const fieldMap: Record<string, (a: any) => string> = {
      name: a => a.name || "",
      email: a => a.email || "",
      phone: a => a.phone || "",
      referral: a => a.referralCode || "",
    }
    const filtered = affiliates.filter(a => {
      if (statusFilter && a.status !== statusFilter) return false
      const t = new Date(a.createdAt).getTime()
      if (fromTs && t < fromTs) return false
      if (toTs && t > toTs) return false
      if (!q) return true
      const source = searchField === "all" ? [a.name, a.email, a.phone, a.referralCode] : [fieldMap[searchField](a)]
      return source.some(v => String(v || "").toLowerCase().includes(q))
    })
    const withStats = filtered.map(a => ({ ...a, ...(perUser[a.id] || { commissions: 0, withdrawn: 0, owed: 0 }) }))
    withStats.sort((x, y) => {
      if (sortKey === "name") {
        return x.name.localeCompare(y.name, "ar") * (sortDir === "asc" ? 1 : -1)
      }
      const av = sortKey === "createdAt" ? new Date(x.createdAt).getTime() : sortKey === "orders" ? x._count.orders : x.commissions
      const bv = sortKey === "createdAt" ? new Date(y.createdAt).getTime() : sortKey === "orders" ? y._count.orders : y.commissions
      return (av - bv) * (sortDir === "asc" ? 1 : -1)
    })
    return withStats
  }, [affiliates, perUser, search, searchField, statusFilter, dateFrom, dateTo, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const paged = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const hasFilters = !!(search || statusFilter || dateFrom || dateTo || searchField !== "all")

  useEffect(() => { setPage(1) }, [search, searchField, statusFilter, dateFrom, dateTo, sortKey, sortDir])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const clearFilters = () => {
    setSearch(""); setSearchField("all"); setStatusFilter(""); setDateFrom(""); setDateTo("")
  }

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc") }
  }

  const toggleStatus = async (row: any) => {
    const next = row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
    setUpdating(row.id)
    try {
      const res = await fetch(`/api/admin/affiliates/${row.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) {
        toast(next === "ACTIVE" ? "تم تفعيل الحساب" : "تم تعليق الحساب", "success")
        load()
      } else toast("حدث خطأ في تحديث الحالة", "error")
    } catch { toast("خطأ في الاتصال", "error") }
    setUpdating(null)
  }

  const requestToggleStatus = (row: any) => {
    const next = row.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
    if (next === "ACTIVE") {
      toggleStatus(row)
    } else {
      setStatusTarget(row)
    }
  }

  const saveProfile = async (id: string, data: { name: string; phone: string; status: string }) => {
    try {
      const res = await fetch(`/api/admin/affiliates/${id}/profile`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) { toast("تم تحديث بيانات المسوق", "success"); load(); return true }
      toast(body.error || "حدث خطأ", "error"); return false
    } catch { toast("خطأ في الاتصال", "error"); return false }
  }

  const copyLink = async (row: any) => {
    const url = `${window.location.origin}/register?ref=${row.referralCode}`
    try { await navigator.clipboard.writeText(url); toast("تم نسخ رابط الإحالة", "success") }
    catch { toast("تعذر النسخ", "error") }
  }

  const copyCode = async (row: any) => {
    try { await navigator.clipboard.writeText(row.referralCode || ""); toast("تم نسخ كود الإحالة", "success") }
    catch { toast("تعذر النسخ", "error") }
  }

  const exportCSV = () => {
    const header = "المسوق,البريد,الهاتف,كود الإحالة,الحالة,الطلبات,إجمالي العمولات,الرصيد المستحق,المسحوب,تاريخ الانضمام"
    const lines = rows.map(a => [
      a.name, a.email, a.phone || "", a.referralCode || "",
      getStatusText(a.status), a._count.orders, a.commissions, a.owed, a.withdrawn, formatDate(a.createdAt),
    ].map(v => `"${v}"`).join(","))
    const blob = new Blob(["\uFEFF" + header + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url; link.download = `affiliates-${Date.now()}.csv`; link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <RequirePerms perm="affiliates.view">
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">إدارة المسوقين</h1>
            <p className="text-[12px] text-slate-500">{affiliates.length} مسوق في النظام</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportCSV} disabled={rows.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl text-[12px] font-semibold hover:bg-emerald-100 disabled:opacity-50 transition-colors border border-emerald-100">
            <Download size={14} /> تصدير CSV
          </button>
          {can("notifications.send") && (
            <button onClick={() => setNotify({ ids: rows.map(a => a.id), label: "المسوقون المعروضون" })}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-[12px] font-semibold hover:bg-indigo-100 transition-colors border border-indigo-100">
              <Bell size={14} /> إرسال إشعارات
            </button>
          )}
          {can("affiliates.create") && (
            <button onClick={() => setShowAdd(true)}
              className="btn-primary flex items-center gap-2 px-4 py-2.5 text-[12px]">
              <Plus size={15} /> إضافة مسوق جديد
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {!loading && totals && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {STAT_CARDS.map(c => (
            <StatCard key={c.key} label={c.label} value={c.format(totals[c.key] || 0)} icon={c.icon} tint={c.tint} text={c.text} />
          ))}
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث متقدم بالاسم، البريد، الهاتف، أو كود الإحالة..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          <select value={searchField} onChange={e => setSearchField(e.target.value)}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all">
            {SEARCH_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-500">من</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-[12px] text-slate-700 focus:outline-none [color-scheme:light] w-[110px]" />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-[11px] text-slate-500">إلى</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-[12px] text-slate-700 focus:outline-none [color-scheme:light] w-[110px]" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-[12px] font-semibold hover:bg-red-100 transition-colors">
              <FilterX size={14} /> مسح الفلاتر
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(({ key, label, icon: Icon }) => {
            const count = key ? rows.filter(a => a.status === key).length : rows.length
            return (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all
                  ${statusFilter === key
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100"}`}>
                <Icon size={12} />
                {label}
                <span className={`text-[10px] px-1.5 rounded-md ${statusFilter === key ? "bg-white/20" : "bg-slate-200/70"}`}>{count.toLocaleString("ar-EG")}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
              <div className="flex items-center gap-4">
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
      ) : rows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-slate-300" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">لا يوجد مسوقين</p>
          <p className="text-slate-400 text-sm">{hasFilters ? "جرّب تغيير معايير البحث أو مسح الفلاتر" : "لم يتم تسجيل أي مسوقين بعد"}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-slate-500">{rows.length.toLocaleString("ar-EG")} مسوق · {hasFilters ? "بعد الفلترة" : "مرتبة حسب إجمالي العمولات"}</p>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-right px-4 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><SortHeader label="المسوق" myKey="name" sortKey={sortKey} sortDir={sortDir} onSort={() => handleSort("name")} /></th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الهاتف</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><SortHeader label="الطلبات" myKey="orders" sortKey={sortKey} sortDir={sortDir} onSort={() => handleSort("orders")} /></th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><SortHeader label="إجمالي العمولات (ج.م)" myKey="commissions" sortKey={sortKey} sortDir={sortDir} onSort={() => handleSort("commissions")} /></th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الرصيد المستحق</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">المسحوب</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider"><SortHeader label="تاريخ الانضمام" myKey="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={() => handleSort("createdAt")} /></th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الحالة</th>
                    <th className="px-3 py-3.5 w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[14px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
                            {(a.name || "؟").charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-slate-800 truncate">{a.name}</p>
                            <p className="text-[11px] text-slate-400 truncate" dir="ltr">{a.email}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <code className="text-[10px] font-mono text-slate-400 truncate max-w-[90px]" dir="ltr">{a.referralCode}</code>
                              <button onClick={() => copyCode(a)} className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100" title="نسخ كود الإحالة">
                                <Copy size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        {a.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] text-slate-600 font-medium" dir="ltr">{a.phone}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a href={`tel:${a.phone}`} title="اتصال" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"><Phone size={13} /></a>
                              <a href={toWhatsApp(a.phone)} target="_blank" rel="noopener" title="واتساب" className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all"><MessageCircle size={13} /></a>
                            </div>
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-bold text-slate-700 tabular-nums">{a._count.orders.toLocaleString("ar-EG")}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-bold text-emerald-600 tabular-nums">{formatCurrency(a.commissions)}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] font-bold text-slate-800 tabular-nums">{formatCurrency(a.owed)}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[13px] text-slate-500 tabular-nums">{formatCurrency(a.withdrawn)}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[12px] text-slate-500">{formatDate(a.createdAt)}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-lg ${getStatusColor(a.status)}`}>{getStatusText(a.status)}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center justify-end">
                          {updating === a.id ? <Loader2 size={16} className="animate-spin text-indigo-500 mx-2" /> : <ActionsMenu row={a} onView={setSelected} onToggleStatus={requestToggleStatus} onNotify={r => setNotify({ ids: [r.id], label: r.name })} onCopyLink={copyLink} can={can} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-2.5">
            {paged.map(a => (
              <div key={a.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[15px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
                      {(a.name || "؟").charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 truncate">{a.name}</p>
                      <p className="text-[11px] text-slate-400 truncate" dir="ltr">{a.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getStatusColor(a.status)}`}>{getStatusText(a.status)}</span>
                    <ActionsMenu row={a} onView={setSelected} onToggleStatus={requestToggleStatus} onNotify={r => setNotify({ ids: [r.id], label: r.name })} onCopyLink={copyLink} can={can} />
                  </div>
                </div>
                {a.phone && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-[12px] text-slate-600 font-medium" dir="ltr">{a.phone}</span>
                    <a href={`tel:${a.phone}`} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 transition-colors" title="اتصال"><Phone size={12} /></a>
                    <a href={toWhatsApp(a.phone)} target="_blank" rel="noopener" className="p-1.5 rounded-lg bg-green-50 text-green-600 transition-colors" title="واتساب"><MessageCircle size={12} /></a>
                    <span className="text-[11px] text-slate-400 mr-auto">انضم {formatDate(a.createdAt)}</span>
                  </div>
                )}
                {!a.phone && <p className="text-[11px] text-slate-400 mt-2.5">انضم {formatDate(a.createdAt)}</p>}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-50">
                  <MiniStat label="الطلبات" value={a._count.orders.toLocaleString("ar-EG")} tint="#2563eb" />
                  <MiniStat label="إجمالي العمولات" value={formatCurrency(a.commissions)} tint="#7c3aed" />
                  <MiniStat label="الرصيد المستحق" value={formatCurrency(a.owed)} tint="#d97706" />
                  <MiniStat label="المسحوب" value={formatCurrency(a.withdrawn)} tint="#64748b" />
                </div>
              </div>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {selected && <AffiliateModal row={selected} onClose={() => setSelected(null)} onSave={saveProfile} />}
      {showAdd && <AddAffiliateModal onClose={() => setShowAdd(false)} onCreated={() => { load() }} />}
      {notify && (
        <NotifyModal
          allIds={affiliates.map(a => a.id)}
          initialIds={notify.ids}
          initialLabel={notify.label}
          onClose={() => setNotify(null)}
          onSent={() => {}}
        />
      )}

      <ConfirmDialog
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => { if (statusTarget) toggleStatus(statusTarget) }}
        title="تعليق الحساب"
        message={`هل تريد تعليق حساب «${statusTarget?.name}»؟ سيتم إيقاف ربح العمولات حتى إعادة التفعيل.`}
        confirmText="تعليق"
      />
    </div>
    </RequirePerms>
  )
}
