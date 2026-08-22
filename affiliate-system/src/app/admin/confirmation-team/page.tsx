"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  PauseCircle,
  Ban,
  Target,
  Search,
  Loader2,
  MoreVertical,
  X,
  Plus,
  Trash2,
  Edit3,
  Lock,
  Clock,
  KeyRound,
  FilterX,
  ListChecks,
  Sparkles,
  Inbox,
  Eye,
} from "lucide-react"
import { formatDate, formatDateTime, formatCurrency, getStatusText } from "@/lib/utils"
import { useToast } from "@/components/Toast"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import Pagination from "@/components/Pagination"
import ConfirmDialog from "@/components/ConfirmDialog"

const PER_PAGE = 10

const STATUS_OPTIONS = [
  { key: "", label: "الكل", icon: Users },
  { key: "ACTIVE", label: "نشط", icon: CheckCircle2 },
  { key: "INACTIVE", label: "غير نشط", icon: PauseCircle },
]

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-indigo-50 text-indigo-700",
  SHIPPED: "bg-purple-50 text-purple-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  COLLECTED: "bg-teal-50 text-teal-700",
  CANCELLED: "bg-red-50 text-red-700",
  RETURNED: "bg-orange-50 text-orange-700",
}

function StatCard({ label, value, icon: Icon, tint, sub }: { label: string; value: string; icon: any; tint: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400">{label}</p>
          <p className="text-xl sm:text-2xl font-extrabold mt-1 truncate tabular-nums text-slate-900">{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tint}12` }}>
          <Icon size={18} style={{ color: tint }} />
        </div>
      </div>
    </div>
  )
}

function ActionsMenu({ row, onEdit, onPassword, onAssign, onView, onToggle, onDelete, can }: {
  row: any
  onEdit: (r: any) => void
  onPassword: (r: any) => void
  onAssign: (r: any) => void
  onView: (r: any) => void
  onToggle: (r: any) => void
  onDelete: (r: any) => void
  can: (p: string) => boolean
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
  const items: { key: string; label: string; icon: any; tint: string; danger?: boolean; onClick: () => void }[] = []
  if (can("confirmation.view")) items.push({ key: "view", label: "الطلبات والنشاط", icon: Eye, tint: "#2563eb", onClick: () => { onView(row); setOpen(false) } })
  if (can("confirmation.assign")) items.push({ key: "assign", label: "إسناد طلبات", icon: ListChecks, tint: "#7c3aed", onClick: () => { onAssign(row); setOpen(false) } })
  if (can("confirmation.update")) {
    items.push(
      { key: "edit", label: "تعديل البيانات", icon: Edit3, tint: "#4f46e5", onClick: () => { onEdit(row); setOpen(false) } },
      { key: "password", label: "تغيير كلمة المرور", icon: Lock, tint: "#d97706", onClick: () => { onPassword(row); setOpen(false) } },
      { key: "toggle", label: isActive ? "تعطيل الحساب" : "تفعيل الحساب", icon: isActive ? Ban : CheckCircle2, tint: isActive ? "#dc2626" : "#059669", danger: isActive, onClick: () => { onToggle(row); setOpen(false) } },
    )
  }
  if (can("confirmation.delete")) items.push({ key: "delete", label: "حذف الموظف", icon: Trash2, tint: "#dc2626", danger: true, onClick: () => { onDelete(row); setOpen(false) } })

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all" aria-label="إجراءات">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl border border-slate-100 shadow-lg shadow-slate-200/50 z-20 py-1.5 max-h-80 overflow-y-auto">
          {items.map(item => (
            <button
              key={item.key}
              onClick={item.onClick}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] font-semibold text-right transition-colors hover:bg-slate-50 ${item.danger ? "text-red-600" : "text-slate-700"}`}
            >
              <item.icon size={14} style={{ color: item.tint }} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MemberModal({ row, onClose, onSaved }: { row: any; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [name, setName] = useState(row?.name || "")
  const [phone, setPhone] = useState(row?.phone || "")
  const [email, setEmail] = useState(row?.email || "")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState(row?.status || "ACTIVE")
  const [saving, setSaving] = useState(false)

  const isEdit = !!row?.id

  const submit = async () => {
    if (!name.trim()) { toast("الاسم مطلوب", "error"); return }
    if (!isEdit && (!email.trim() || !password)) { toast("البريد وكلمة المرور مطلوبة", "error"); return }
    if (!isEdit && password.length < 6) { toast("كلمة المرور 6 أحرف على الأقل", "error"); return }
    setSaving(true)
    try {
      const res = await fetch(isEdit ? `/api/admin/confirmation/${row.id}` : "/api/admin/confirmation", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { name, phone, status } : { name, phone, email, password, status }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(isEdit ? "تم تحديث الموظف" : "تم إضافة الموظف", "success")
        onSaved()
        onClose()
      } else {
        toast(data.error || "حدث خطأ", "error")
      }
    } catch { toast("خطأ في الاتصال", "error") }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="h-20 rounded-t-2xl relative overflow-hidden" style={{ background: "linear-gradient(135deg, #065f46, #10b981)" }}>
          <button onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={16} /></button>
          <div className="absolute bottom-3 right-5 text-white">
            <h2 className="text-[16px] font-extrabold">{isEdit ? "تعديل موظف تأكيد" : "إضافة موظف تأكيد"}</h2>
            <p className="text-[11px] text-white/70">{isEdit ? "تعديل بيانات الموظف" : "إنشاء حساب جديد لفريق التأكيدات"}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الاسم الكامل *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-premium" placeholder="اسم الموظف" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">رقم الهاتف</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} dir="ltr" className="input-premium" placeholder="01XXXXXXXXX" />
          </div>
          {!isEdit && (
            <>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">البريد الإلكتروني *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" className="input-premium" placeholder="name@example.com" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">كلمة المرور *</label>
                <div className="flex gap-2">
                  <input value={password} onChange={e => setPassword(e.target.value)} dir="ltr" className="input-premium flex-1 font-mono" placeholder="6 أحرف على الأقل" />
                  <button
                    onClick={() => {
                      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                      setPassword(Array.from(crypto.getRandomValues(new Uint8Array(8)), b => chars[b % chars.length]).join(""))
                    }}
                    className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0"
                  >
                    <KeyRound size={13} /> توليد
                  </button>
                </div>
              </div>
            </>
          )}
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">حالة الحساب</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.filter(s => s.key).map(o => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setStatus(o.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-all border-2 ${
                    status === o.key ? "border-emerald-500 bg-emerald-50/60 text-emerald-700" : "border-slate-100 text-slate-500 hover:border-slate-200"
                  }`}
                >
                  <o.icon size={13} />
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={submit} disabled={saving}
            className="btn-primary w-full py-3 text-[13px] flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة الموظف"}
          </button>
        </div>
      </div>
    </div>
  )
}

function MemberPasswordModal({ row, onClose, onSaved }: { row: any; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (password.length < 6) { toast("كلمة المرور 6 أحرف على الأقل", "error"); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/confirmation/${row.id}/password`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { toast("تم تغيير كلمة المرور", "success"); onSaved(); onClose() }
      else toast(data.error || "حدث خطأ", "error")
    } catch { toast("خطأ في الاتصال", "error") }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="h-20 rounded-t-2xl relative overflow-hidden" style={{ background: "linear-gradient(135deg, #92400e, #f59e0b)" }}>
          <button onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={16} /></button>
          <div className="absolute bottom-3 right-5 text-white">
            <h2 className="text-[16px] font-extrabold">تغيير كلمة المرور</h2>
            <p className="text-[11px] text-white/70">{row.name}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">كلمة المرور الجديدة *</label>
            <div className="flex gap-2">
              <input value={password} onChange={e => setPassword(e.target.value)} dir="ltr" className="input-premium flex-1 font-mono" placeholder="6 أحرف على الأقل" />
              <button
                onClick={() => {
                  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                  setPassword(Array.from(crypto.getRandomValues(new Uint8Array(8)), b => chars[b % chars.length]).join(""))
                }}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0"
              >
                <KeyRound size={13} /> توليد
              </button>
            </div>
          </div>
          <button onClick={submit} disabled={saving} className="btn-primary w-full py-3 text-[13px] flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
            {saving ? "جاري التغيير..." : "تغيير كلمة المرور"}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteMemberModal({ row, onClose, onDeleted }: { row: any; onClose: () => void; onDeleted: () => void }) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/confirmation/${row.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { toast("تم حذف الموظف", "success"); onDeleted(); onClose() }
      else toast(data.error || "حدث خطأ", "error")
    } catch { toast("خطأ في الاتصال", "error") }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <h2 className="text-[16px] font-extrabold text-slate-900">حذف الموظف</h2>
          <p className="text-[12px] text-slate-500 mt-1.5">
            هل أنت متأكد من حذف «{row.name}»؟ لا يمكن التراجع عن هذا الإجراء.
          </p>
          <div className="flex gap-2 mt-5">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">إلغاء</button>
            <button onClick={submit} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-colors">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {saving ? "جاري الحذف..." : "حذف"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AssignModal({ row, onClose, onDone }: { row: any; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)

  const loadOrders = () => {
    setLoading(true)
    fetch(`/api/admin/confirmation/assign?status=PENDING&search=${encodeURIComponent(search)}`)
      .then(r => r.json())
      .then(d => setOrders(d?.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadOrders() }, [search])

  const toggleOrder = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === orders.length) setSelected(new Set())
    else setSelected(new Set(orders.map(o => o.id)))
  }

  const assign = async () => {
    if (selected.size === 0) { toast("اختر طلباً واحداً على الأقل", "error"); return }
    setAssigning(true)
    try {
      const res = await fetch("/api/admin/confirmation/assign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selected), verifierId: row.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(`تم إسناد ${data.assigned} طلب إلى ${row.name}`, "success")
        onDone()
        onClose()
      } else toast(data.error || "حدث خطأ", "error")
    } catch { toast("خطأ في الاتصال", "error") }
    setAssigning(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="h-20 rounded-t-2xl relative overflow-hidden shrink-0" style={{ background: "linear-gradient(135deg, #5b21b6, #8b5cf6)" }}>
          <button onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={16} /></button>
          <div className="absolute bottom-3 right-5 text-white">
            <h2 className="text-[16px] font-extrabold">إسناد طلبات</h2>
            <p className="text-[11px] text-white/70">إسناد طلبات معلقة إلى {row.name}</p>
          </div>
        </div>
        <div className="p-4 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث برقم الطلب أو اسم العميل..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> جاري التحميل...
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-10">
              <Inbox size={28} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">لا توجد طلبات معلقة غير مسندة</p>
              <p className="text-[11px] text-slate-400 mt-1">جميع الطلبات المعلقة موزعة أو لا يوجد طلبات</p>
            </div>
          ) : (
            <>
              <button onClick={selectAll} className="flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                <CheckCircle2 size={13} />
                {selected.size === orders.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                <span className="text-slate-400 font-semibold">({selected.size}/{orders.length})</span>
              </button>
              <div className="space-y-1.5 mt-1">
                {orders.map(o => (
                  <button
                    key={o.id}
                    onClick={() => toggleOrder(o.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all ${
                      selected.has(o.id) ? "border-violet-500 bg-violet-50/50" : "border-slate-100 hover:border-slate-200"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${selected.has(o.id) ? "bg-violet-600 border-violet-600" : "border-slate-300"}`}>
                      {selected.has(o.id) && <CheckCircle2 size={13} className="text-white" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold font-mono text-slate-800" dir="ltr">{o.orderNumber}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${ORDER_STATUS_COLORS[o.status] || "bg-slate-100 text-slate-600"}`}>{getStatusText(o.status)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{o.customerName} · {o.customerPhone}</p>
                    </div>
                    <span className="text-[12px] font-bold text-slate-800 tabular-nums shrink-0">{formatCurrency(o.total)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="p-4 border-t border-slate-100 shrink-0">
          <button onClick={assign} disabled={assigning || selected.size === 0}
            className="btn-primary w-full py-3 text-[13px] flex items-center justify-center gap-2 disabled:opacity-50">
            {assigning ? <Loader2 size={15} className="animate-spin" /> : <ListChecks size={15} />}
            {assigning ? "جاري الإسناد..." : `إسناد ${selected.size} طلب إلى ${row.name}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function ViewModal({ row, onClose }: { row: any; onClose: () => void }) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/admin/confirmation/${row.id}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
  }, [row.id])

  const successRate = row.successRate ?? 0
  const successColor = successRate >= 70 ? "text-emerald-600" : successRate >= 40 ? "text-amber-600" : "text-red-600"

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="h-20 rounded-t-2xl relative overflow-hidden shrink-0" style={{ background: "linear-gradient(135deg, #065f46, #10b981)" }}>
          <button onClick={onClose} className="absolute top-3 left-3 p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"><X size={16} /></button>
          <div className="absolute bottom-3 right-5 text-white">
            <h2 className="text-[16px] font-extrabold">{row.name}</h2>
            <p className="text-[11px] text-white/70">{row.email} · موظف تأكيد</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {!data ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> جاري التحميل...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Mini stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-xl px-3 py-3">
                  <p className="text-[10px] font-semibold text-slate-400">الطلبات المسندة</p>
                  <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">{row.assignedOrders}</p>
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-3">
                  <p className="text-[10px] font-semibold text-slate-400">الطلبات المؤكدة</p>
                  <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">{row.confirmedOrders}</p>
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-3">
                  <p className="text-[10px] font-semibold text-slate-400">نسبة النجاح</p>
                  <p className={`text-xl font-extrabold mt-1 tabular-nums ${successColor}`}>{successRate}%</p>
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-3">
                  <p className="text-[10px] font-semibold text-slate-400">آخر تسجيل دخول</p>
                  <p className="text-[13px] font-bold text-slate-700 mt-1">{row.lastLogin ? formatDateTime(row.lastLogin) : "—"}</p>
                </div>
              </div>

              {/* Assigned orders */}
              <div>
                <h3 className="text-[13px] font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <ListChecks size={14} className="text-violet-500" />
                  الطلبات المسندة ({data.assignedOrders.length})
                </h3>
                {data.assignedOrders.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl text-sm text-slate-400">لا توجد طلبات مسندة</div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {data.assignedOrders.map((o: any) => (
                      <div key={o.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                        <span className="text-[12px] font-bold font-mono text-slate-800" dir="ltr">{o.orderNumber}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${ORDER_STATUS_COLORS[o.status] || "bg-slate-100 text-slate-600"}`}>{getStatusText(o.status)}</span>
                        <span className="text-[11px] text-slate-500 truncate flex-1">{o.customerName}</span>
                        <span className="text-[11px] font-bold text-slate-700 tabular-nums shrink-0">{formatCurrency(o.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirmed orders */}
              <div>
                <h3 className="text-[13px] font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  الطلبات المؤكدة ({data.confirmedOrders.length})
                </h3>
                {data.confirmedOrders.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl text-sm text-slate-400">لا توجد طلبات مؤكدة بعد</div>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {data.confirmedOrders.map((o: any) => (
                      <div key={o.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                        <span className="text-[12px] font-bold font-mono text-slate-800" dir="ltr">{o.orderNumber}</span>
                        <span className="text-[10px] text-slate-500">{formatDate(o.confirmedAt)}</span>
                        <span className="text-[11px] text-slate-500 truncate flex-1">{o.customerName}</span>
                        <span className="text-[11px] font-bold text-slate-700 tabular-nums shrink-0">{formatCurrency(o.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity */}
              <div>
                <h3 className="text-[13px] font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-500" />
                  آخر النشاطات
                </h3>
                {data.activities.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl text-sm text-slate-400">لا يوجد نشاط مسجل</div>
                ) : (
                  <div className="space-y-1.5">
                    {data.activities.slice(0, 8).map((a: any) => (
                      <div key={a.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 text-[11px]">
                        <span className="font-bold text-slate-700">{a.action}</span>
                        {a.details && <span className="text-slate-500 truncate flex-1">{a.details}</span>}
                        <span className="text-slate-400 shrink-0">{formatDateTime(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminConfirmationPage() {
  const { toast } = useToast()
  const perms = usePermissions()
  const can = perms.can
  const [members, setMembers] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [editRow, setEditRow] = useState<any>(null)
  const [passwordRow, setPasswordRow] = useState<any>(null)
  const [assignRow, setAssignRow] = useState<any>(null)
  const [viewRow, setViewRow] = useState<any>(null)
  const [deleteRow, setDeleteRow] = useState<any>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [autoDistributing, setAutoDistributing] = useState(false)
  const [statusTarget, setStatusTarget] = useState<any>(null)
  const [confirmAutoDistribute, setConfirmAutoDistribute] = useState(false)

  const load = () => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter) params.set("status", statusFilter)
    params.set("page", String(page))
    params.set("limit", String(PER_PAGE))
    setLoading(true)
    Promise.all([
      fetch(`/api/admin/confirmation?${params}`).then(r => r.json()),
      fetch("/api/admin/confirmation/stats").then(r => r.json()),
    ]).then(([list, st]) => {
      setMembers(list?.members || [])
      setTotal(list?.total || 0)
      setTotalPages(Math.max(1, list?.pages || 1))
      setStats(st || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, search, statusFilter])

  const toggleStatus = async (row: any) => {
    const next = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setUpdating(row.id)
    try {
      const res = await fetch(`/api/admin/confirmation/${row.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { toast(next === "ACTIVE" ? "تم تفعيل الحساب" : "تم تعطيل الحساب", "success"); load() }
      else toast(data.error || "حدث خطأ", "error")
    } catch { toast("خطأ في الاتصال", "error") }
    setUpdating(null)
  }

  const requestToggleStatus = (row: any) => {
    const next = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    if (next === "ACTIVE") toggleStatus(row)
    else setStatusTarget(row)
  }

  const autoDistribute = async () => {
    setAutoDistributing(true)
    try {
      const res = await fetch("/api/admin/confirmation/assign", { method: "PUT" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(data.assigned > 0 ? `تم توزيع ${data.assigned} طلب على ${data.verifiers} موظف` : "لا توجد طلبات معلقة للتوزيع", data.assigned > 0 ? "success" : "warning")
        load()
      } else toast(data.error || "حدث خطأ", "error")
    } catch { toast("خطأ في الاتصال", "error") }
    setAutoDistributing(false)
  }

  const requestAutoDistribute = () => setConfirmAutoDistribute(true)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter(m => [m.name, m.email, m.phone].some(v => String(v || "").toLowerCase().includes(q)))
  }, [members, search])

  const hasFilters = !!(search || statusFilter)

  const lastActivityLabel = (m: any) => {
    if (!m.lastActivity) return "لا نشاط بعد"
    const [action, iso] = m.lastActivity.split(" · ")
    return `${action} · ${formatDateTime(iso)}`
  }

  return (
    <RequirePerms perm="confirmation.view">
      <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #065f46, #10b981)" }}>
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">فريق التأكيدات</h1>
            <p className="text-[12px] text-slate-500">{total} موظف تأكيد في الفريق</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {can("confirmation.assign") && (
            <button
              onClick={requestAutoDistribute}
              disabled={autoDistributing}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-violet-50 text-violet-600 rounded-xl text-[12px] font-semibold hover:bg-violet-100 disabled:opacity-50 transition-colors border border-violet-100"
            >
              {autoDistributing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              توزيع تلقائي
            </button>
          )}
          {can("confirmation.create") && (
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-4 py-2.5 text-[12px]">
              <Plus size={15} /> إضافة موظف جديد
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {!loading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="إجمالي الفريق" value={stats.total.toLocaleString("ar-EG")} icon={Users} tint="#059669" sub={`${stats.active} نشط`} />
          <StatCard label="طلبات معلقة" value={stats.pendingOrders.toLocaleString("ar-EG")} icon={Inbox} tint="#d97706" sub="بانتظار الإسناد أو التأكيد" />
          <StatCard label="الطلبات المسندة" value={stats.assignedOrders.toLocaleString("ar-EG")} icon={ListChecks} tint="#7c3aed" />
          <StatCard label="متوسط نسبة النجاح" value={`${stats.avgSuccess}%`} icon={Target} tint="#2563eb" sub={`${stats.confirmedOrders} طلب مؤكد`} />
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم، البريد، أو رقم الهاتف..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 transition-colors">
                <X size={14} className="text-slate-400" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {STATUS_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setStatusFilter(key); setPage(1) }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all border ${
                  statusFilter === key ? "bg-emerald-600 text-white border-transparent shadow-sm shadow-emerald-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-100"
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button onClick={() => { setSearch(""); setStatusFilter(""); setPage(1) }}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-[12px] font-semibold hover:bg-red-100 transition-colors">
              <FilterX size={14} /> مسح
            </button>
          )}
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-slate-300" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">{hasFilters ? "لا توجد نتائج مطابقة" : "لا يوجد موظفون في الفريق"}</p>
          <p className="text-slate-400 text-sm">{hasFilters ? "جرّب تغيير معايير البحث" : "ابدأ بإضافة أول موظف تأكيد"}</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-right px-4 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الموظف</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الطلبات المسندة</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">المؤكدة</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">نسبة النجاح</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">آخر نشاط</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">تاريخ الانضمام</th>
                    <th className="text-right px-3 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">الحالة</th>
                    <th className="px-3 py-3.5 w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[14px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #065f46, #10b981)" }}>
                            {(m.name || "؟").charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold text-slate-800 truncate">{m.name}</p>
                            <p className="text-[11px] text-slate-400 truncate" dir="ltr">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-700 tabular-nums">
                          <ListChecks size={12} className="text-violet-400" />
                          {m.assignedOrders.toLocaleString("ar-EG")}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-700 tabular-nums">
                          <CheckCircle2 size={12} className="text-emerald-500" />
                          {m.confirmedOrders.toLocaleString("ar-EG")}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${m.successRate >= 70 ? "bg-emerald-500" : m.successRate >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, m.successRate)}%` }}
                            />
                          </div>
                          <span className={`text-[12px] font-bold tabular-nums ${m.successRate >= 70 ? "text-emerald-600" : m.successRate >= 40 ? "text-amber-600" : "text-red-600"}`}>
                            {m.successRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[11px] text-slate-500 truncate block max-w-[160px]">{lastActivityLabel(m)}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="text-[12px] text-slate-500">{formatDate(m.createdAt)}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg ${m.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                          {m.status === "ACTIVE" ? <CheckCircle2 size={11} /> : <PauseCircle size={11} />}
                          {m.status === "ACTIVE" ? "نشط" : "غير نشط"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center justify-end">
                          {updating === m.id ? <Loader2 size={16} className="animate-spin text-emerald-500 mx-2" /> : (
                            <ActionsMenu
                              row={m}
                              onEdit={setEditRow}
                              onPassword={setPasswordRow}
                              onAssign={setAssignRow}
                              onView={setViewRow}
                              onToggle={requestToggleStatus}
                              onDelete={setDeleteRow}
                              can={can}
                            />
                          )}
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
            {filtered.map(m => (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[15px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg, #065f46, #10b981)" }}>
                      {(m.name || "؟").charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 truncate">{m.name}</p>
                      <p className="text-[11px] text-slate-400 truncate" dir="ltr">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md ${m.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {m.status === "ACTIVE" ? "نشط" : "غير نشط"}
                    </span>
                    <ActionsMenu
                      row={m}
                      onEdit={setEditRow}
                      onPassword={setPasswordRow}
                      onAssign={setAssignRow}
                      onView={setViewRow}
                      onToggle={requestToggleStatus}
                      onDelete={setDeleteRow}
                      can={can}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400">مسندة</p>
                    <p className="text-[15px] font-extrabold text-slate-800 tabular-nums mt-0.5">{m.assignedOrders}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400">مؤكدة</p>
                    <p className="text-[15px] font-extrabold text-slate-800 tabular-nums mt-0.5">{m.confirmedOrders}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl px-3 py-2">
                    <p className="text-[10px] font-semibold text-slate-400">النجاح</p>
                    <p className={`text-[15px] font-extrabold tabular-nums mt-0.5 ${m.successRate >= 70 ? "text-emerald-600" : m.successRate >= 40 ? "text-amber-600" : "text-red-600"}`}>{m.successRate}%</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-50 flex items-center gap-1.5">
                  <Clock size={11} className="text-slate-400 shrink-0" />
                  <span className="truncate">{lastActivityLabel(m)}</span>
                </p>
              </div>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {showAdd && <MemberModal row={null} onClose={() => setShowAdd(false)} onSaved={load} />}
      {editRow && <MemberModal row={editRow} onClose={() => setEditRow(null)} onSaved={load} />}
      {passwordRow && <MemberPasswordModal row={passwordRow} onClose={() => setPasswordRow(null)} onSaved={load} />}
      {assignRow && <AssignModal row={assignRow} onClose={() => setAssignRow(null)} onDone={load} />}
      {viewRow && <ViewModal row={viewRow} onClose={() => setViewRow(null)} />}
      {deleteRow && <DeleteMemberModal row={deleteRow} onClose={() => setDeleteRow(null)} onDeleted={load} />}

      <ConfirmDialog
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => { if (statusTarget) toggleStatus(statusTarget) }}
        title="تعطيل الحساب"
        message={`هل تريد تعطيل حساب «${statusTarget?.name}»؟ لن تُسند له طلبات جديدة حتى إعادة التفعيل.`}
        confirmText="تعطيل"
      />

      <ConfirmDialog
        open={confirmAutoDistribute}
        onClose={() => setConfirmAutoDistribute(false)}
        onConfirm={() => { setConfirmAutoDistribute(false); autoDistribute() }}
        title="توزيع تلقائي"
        message="توزيع جميع الطلبات المعلقة تلقائياً على الموظفين النشطين؟"
        confirmText="توزيع"
      />
      </div>
    </RequirePerms>
  )
}
