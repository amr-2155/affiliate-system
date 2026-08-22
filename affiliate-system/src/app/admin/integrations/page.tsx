"use client"
import { useEffect, useState } from "react"
import {
  Plug, Loader2, Plus, Trash2, Pencil, Webhook, KeyRound, Truck, Copy, Check,
  RefreshCw, ExternalLink, Eye, EyeOff, Zap, History, Save, Power,
} from "lucide-react"
import { useToast } from "@/components/Toast"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import ConfirmDialog from "@/components/ConfirmDialog"

const TABS = [
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "api-keys", label: "مفاتيح API", icon: KeyRound },
  { id: "shipping", label: "مزوّدو الشحن", icon: Truck },
  { id: "n8n", label: "n8n", icon: Zap },
] as const

const ORDER_EVENTS_LABELS: Record<string, string> = {
  "order.created": "إنشاء طلب",
  "order.confirmation_required": "بانتظار التأكيد",
  "order.confirmed": "تأكيد الطلب",
  "order.rejected": "رفض الطلب",
  "order.shipped": "شحن الطلب",
  "order.delivered": "تسليم الطلب",
  "order.cancelled": "إلغاء الطلب",
  "order.auto_cancelled": "إلغاء تلقائي",
}

export default function AdminIntegrationsPage() {
  const { toast } = useToast()
  const perms = usePermissions()
  const can = perms.can
  const [tab, setTab] = useState<"webhooks" | "api-keys" | "shipping" | "n8n">("webhooks")

  return (
    <RequirePerms perm="integrations.view">
      <div className="space-y-5 pb-16">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-600 to-purple-500 shadow-sm shadow-violet-200">
            <Plug size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">مركز التكاملات</h1>
            <p className="text-[12px] text-slate-500">Webhooks ومفاتيح API ومزوّدو الشحن وn8n في مكان واحد</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all shrink-0 border
                  ${active ? "bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200" : "bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600"}`}>
                <Icon size={15} />
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === "webhooks" && <WebhooksTab canManage={can("webhooks.manage")} canLogs={can("integrations.logs")} toast={toast} />}
        {tab === "api-keys" && <ApiKeysTab canManage={can("api_keys.manage")} toast={toast} />}
        {tab === "shipping" && <ShippingTab canManage={can("integrations.manage")} toast={toast} />}
        {tab === "n8n" && <N8nTab canManage={can("integrations.manage")} toast={toast} />}
      </div>
    </RequirePerms>
  )
}

const inputCls = "w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all bg-white"

function Card({ title, desc, icon: Icon, children, action }: { title: string; desc: string; icon: any; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
          <Icon size={16} className="text-violet-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-[14px] font-bold text-slate-900">{title}</h2>
          <p className="text-[11px] text-slate-400">{desc}</p>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Badge({ tone, children }: { tone: "ok" | "err" | "warn" | "off"; children: React.ReactNode }) {
  const map = {
    ok: "bg-emerald-50 text-emerald-700 border-emerald-100",
    err: "bg-red-50 text-red-700 border-red-100",
    warn: "bg-amber-50 text-amber-700 border-amber-100",
    off: "bg-slate-100 text-slate-500 border-slate-200",
  }
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${map[tone]}`}>{children}</span>
}

/* ─────────────────────────── Webhooks ─────────────────────────── */

function WebhooksTab({ canManage, canLogs, toast }: any) {
  const [list, setList] = useState<any[]>([])
  const [events, setEvents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: "", url: "", secret: "", enabled: true, events: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState<any>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/admin/webhooks")
      const d = await r.json()
      if (r.ok) {
        setList(d.webhooks || [])
        setEvents(d.events || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleEvent = (ev: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }))
  }

  const save = async () => {
    if (!form.name.trim() || !form.url.trim() || form.events.length === 0) {
      toast("أكمل الاسم والرابط وحدثاً واحداً على الأقل", "error")
      return
    }
    setSaving(true)
    try {
      const r = await fetch(editing ? `/api/admin/webhooks/${editing.id}` : "/api/admin/webhooks", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (r.ok) {
        toast(editing ? "تم التحديث" : "تم الإنشاء", "success")
        setShowForm(false)
        setEditing(null)
        setForm({ name: "", url: "", secret: "", enabled: true, events: [] })
        load()
      } else toast(d.error || "حدث خطأ", "error")
    } catch {
      toast("حدث خطأ", "error")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!toDelete) return
    const r = await fetch(`/api/admin/webhooks/${toDelete.id}`, { method: "DELETE" })
    if (r.ok) toast("تم الحذف", "success")
    else toast("حدث خطأ", "error")
    setToDelete(null)
    load()
  }

  const test = async (id: string) => {
    setTesting(id)
    try {
      const r = await fetch(`/api/admin/webhooks/${id}`, { method: "POST" })
      const d = await r.json()
      if (r.ok) toast(d.ok ? `متصل (HTTP ${d.status || "—"})` : `فشل: ${d.error || d.status || ""}`, d.ok ? "success" : "error")
      else toast(d.error || "حدث خطأ", "error")
      load()
    } catch {
      toast("حدث خطأ", "error")
    } finally {
      setTesting(null)
    }
  }

  const openDeliveries = async (id: string) => {
    setDeliveriesFor(id)
    setDeliveries([])
    const r = await fetch(`/api/admin/webhooks/${id}/deliveries`)
    if (r.ok) {
      const d = await r.json()
      setDeliveries(d.deliveries || [])
    }
  }

  return (
    <div className="space-y-4">
      <Card title="الويب هوكس" desc="أرسل أحداث الطلبات إلى خدمات خارجية عبر HTTP POST موقّع"
        icon={Webhook}
        action={canManage && (
          <button onClick={() => { setEditing(null); setForm({ name: "", url: "", secret: "", enabled: true, events: [] }); setShowForm((s) => !s) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-[12px] font-semibold hover:bg-violet-700 transition-colors">
            {showForm ? <span>إلغاء</span> : <><Plus size={13} /> إضافة</>}
          </button>
        )}>

        {showForm && (
          <div className="mb-5 p-4 rounded-2xl border border-violet-100 bg-violet-50/40 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">الاسم</label>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: إشعارات n8n" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">الرابط (URL)</label>
                <input dir="ltr" className={inputCls} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/hook" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Secret (HMAC-SHA256)</label>
                <input dir="ltr" className={inputCls} value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} placeholder="اختياري" />
              </div>
              <div className="flex items-end">
                <button onClick={() => setForm({ ...form, enabled: !form.enabled })}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-white transition-colors">
                  <Power size={14} className={form.enabled ? "text-emerald-600" : "text-slate-400"} />
                  {form.enabled ? "مفعّل" : "معطّل"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-2">الأحداث</label>
              <div className="flex flex-wrap gap-2">
                {events.map((ev) => (
                  <button key={ev} onClick={() => toggleEvent(ev)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors
                      ${form.events.includes(ev) ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-500 border-slate-200 hover:border-violet-300"}`}>
                    {ORDER_EVENTS_LABELS[ev] || ev}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-[13px] font-semibold hover:bg-violet-700 disabled:opacity-40 transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editing ? "حفظ التعديلات" : "إنشاء Webhook"}
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <p className="text-center text-[13px] text-slate-400 py-8">لا توجد Webhooks بعد</p>
        ) : (
          <div className="space-y-2">
            {list.map((w) => (
              <div key={w.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                      <Webhook size={16} className="text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                        {w.name}
                        {w.enabled ? <Badge tone="ok">مفعّل</Badge> : <Badge tone="off">معطّل</Badge>}
                        {w.lastStatus === "OK" ? <Badge tone="ok">آخر إرسال OK</Badge> : w.lastStatus === "ERROR" ? <Badge tone="err">آخر إرسال فشل</Badge> : null}
                      </p>
                      <p dir="ltr" className="text-[11px] text-slate-400 truncate text-left">{w.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { setEditing(w); setForm({ name: w.name, url: w.url, secret: w.secret || "", enabled: w.enabled, events: (() => { try { return JSON.parse(w.events) } catch { return [] } })() }); setShowForm(true) }}
                      disabled={!canManage} className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="تعديل">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => test(w.id)} disabled={testing === w.id} className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="اختبار الاتصال">
                      {testing === w.id ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                    </button>
                    {canLogs && (
                      <button onClick={() => openDeliveries(w.id)} className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="سجل التسليم">
                        <History size={15} />
                      </button>
                    )}
                    <button onClick={() => setToDelete(w)} disabled={!canManage} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="حذف">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {w.lastStatusText && <p className="mt-2 text-[11px] text-slate-400">{w.lastStatusText}</p>}
                {w._count?.deliveries > 0 && <p className="mt-1 text-[11px] text-slate-400">{w._count.deliveries} عملية تسليم</p>}

                {deliveriesFor === w.id && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 max-h-56 overflow-y-auto">
                    {deliveries.length === 0 ? (
                      <p className="text-center text-[11px] text-slate-400 py-3">لا توجد تسليمات بعد</p>
                    ) : (
                      <div className="space-y-2">
                        {deliveries.map((d) => (
                          <div key={d.id} className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-white border border-slate-100">
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                {ORDER_EVENTS_LABELS[d.event] || d.event}
                                {d.status === "DELIVERED" ? <Badge tone="ok">{d.responseStatus || "OK"}</Badge>
                                  : d.status === "PENDING" ? <Badge tone="warn">معلق</Badge>
                                  : <Badge tone="err">{d.error || d.status}</Badge>}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{new Date(d.createdAt).toLocaleString("ar-EG")} — محاولات {d.attempts}/{d.maxAttempts}</p>
                            </div>
                            <p dir="ltr" className="text-[10px] text-slate-300 font-mono">{d.idempotencyKey}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        title="حذف Webhook"
        message={`سيتم حذف "${toDelete?.name}" وجميع سجلات تسليمه نهائياً.`}
        confirmText="حذف نهائي"
      />
    </div>
  )
}

/* ─────────────────────────── API Keys ─────────────────────────── */

function ApiKeysTab({ canManage, toast }: any) {
  const [list, setList] = useState<any[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [toDelete, setToDelete] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/admin/api-keys")
      const d = await r.json()
      if (r.ok) {
        setList(d.keys || [])
        setPerms(d.availablePermissions || [])
      }
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const togglePerm = (p: string) => {
    setSelectedPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  const create = async () => {
    if (!name.trim()) { toast("أدخل اسم المفتاح", "error"); return }
    setSaving(true)
    try {
      const r = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), permissions: selectedPerms }),
      })
      const d = await r.json()
      if (r.ok) {
        setRevealed(d.key)
        setShowForm(false)
        setName("")
        setSelectedPerms([])
        load()
      } else toast(d.error || "حدث خطأ", "error")
    } catch {
      toast("حدث خطأ", "error")
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (id: string, enabled: boolean) => {
    const r = await fetch(`/api/admin/api-keys/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    if (r.ok) load()
    else toast("حدث خطأ", "error")
  }

  const remove = async () => {
    if (!toDelete) return
    const r = await fetch(`/api/admin/api-keys/${toDelete.id}`, { method: "DELETE" })
    if (r.ok) toast("تم الحذف", "success")
    else toast("حدث خطأ", "error")
    setToDelete(null)
    load()
  }

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="space-y-4">
      <Card title="مفاتيح API" desc="مصادقة الخدمات الخارجية — يُعرض المفتاح الكامل مرة واحدة فقط"
        icon={KeyRound}
        action={canManage && (
          <button onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-[12px] font-semibold hover:bg-violet-700 transition-colors">
            {showForm ? <span>إلغاء</span> : <><Plus size={13} /> إنشاء مفتاح</>}
          </button>
        )}>

        {revealed && (
          <div className="mb-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
            <p className="text-[12px] font-bold text-emerald-700 mb-2">تم إنشاء المفتاح — انسخه الآن، لن يظهر مرة أخرى:</p>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="flex-1 px-3 py-2 rounded-lg bg-white border border-emerald-200 text-[12px] font-mono text-emerald-800 break-all">{revealed}</code>
              <button onClick={() => copyKey(revealed)} className="p-2.5 bg-white border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors">
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-emerald-600 mt-2">استخدمه مع الرأس <code dir="ltr" className="font-mono">X-API-Key</code> للوصول إلى <code dir="ltr" className="font-mono">/api/v1/*</code></p>
          </div>
        )}

        {showForm && (
          <div className="mb-5 p-4 rounded-2xl border border-violet-100 bg-violet-50/40 space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1">اسم المفتاح</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تكامل n8n" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-2">الصلاحيات</label>
              <div className="flex flex-wrap gap-2">
                {perms.map((p) => (
                  <button key={p} onClick={() => togglePerm(p)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors
                      ${selectedPerms.includes(p) ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-500 border-slate-200 hover:border-violet-300"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={create} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-[13px] font-semibold hover:bg-violet-700 disabled:opacity-40 transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
              إنشاء المفتاح
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <p className="text-center text-[13px] text-slate-400 py-8">لا توجد مفاتيح بعد</p>
        ) : (
          <div className="space-y-2">
            {list.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <KeyRound size={16} className="text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                      {k.name}
                      {k.enabled && !k.revokedAt ? <Badge tone="ok">مفعّل</Badge> : <Badge tone="off">معطّل</Badge>}
                    </p>
                    <p dir="ltr" className="text-[11px] text-slate-400 font-mono text-left">{k.keyPrefix}…</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {k.lastUsedAt ? `آخر استخدام: ${new Date(k.lastUsedAt).toLocaleString("ar-EG")}` : "لم يُستخدم بعد"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => toggle(k.id, !k.enabled)} disabled={!canManage}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                    <Power size={13} className={k.enabled ? "text-emerald-600" : "text-slate-400"} />
                    {k.enabled ? "إيقاف" : "تفعيل"}
                  </button>
                  <button onClick={() => setToDelete(k)} disabled={!canManage} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="حذف">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove}
        title="حذف مفتاح API" message={`سيتم حذف مفتاح "${toDelete?.name}" نهائياً وستفقد أي خدمة تستخدمه الوصول.`}
        confirmText="حذف نهائي" />
    </div>
  )
}

/* ─────────────────────────── Shipping Providers ─────────────────────────── */

function ShippingTab({ canManage, toast }: any) {
  const [list, setList] = useState<any[]>([])
  const [codes, setCodes] = useState<{ code: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", code: "manual", baseUrl: "", apiKey: "", apiSecret: "", enabled: false })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<any>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/admin/shipping-providers")
      const d = await r.json()
      if (r.ok) {
        setList(d.providers || [])
        setCodes(d.availableCodes || [])
      }
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim() || !form.code) { toast("أكمل الاسم والمزود", "error"); return }
    setSaving(true)
    try {
      const r = await fetch("/api/admin/shipping-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (r.ok) {
        toast("تمت الإضافة", "success")
        setShowForm(false)
        setForm({ name: "", code: "manual", baseUrl: "", apiKey: "", apiSecret: "", enabled: false })
        load()
      } else toast(d.error || "حدث خطأ", "error")
    } catch {
      toast("حدث خطأ", "error")
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (id: string, enabled: boolean) => {
    const r = await fetch(`/api/admin/shipping-providers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    if (r.ok) load()
    else toast("حدث خطأ", "error")
  }

  const test = async (id: string) => {
    setTesting(id)
    try {
      const r = await fetch(`/api/admin/shipping-providers/${id}`, { method: "POST" })
      const d = await r.json()
      if (r.ok) toast(d.ok ? `متصل (${d.status || "OK"})` : `فشل: ${d.error || d.status || ""}`, d.ok ? "success" : "error")
      else toast(d.error || "حدث خطأ", "error")
      load()
    } catch {
      toast("حدث خطأ", "error")
    } finally {
      setTesting(null)
    }
  }

  const remove = async () => {
    if (!toDelete) return
    const r = await fetch(`/api/admin/shipping-providers/${toDelete.id}`, { method: "DELETE" })
    const d = await r.json()
    if (r.ok) toast("تم الحذف", "success")
    else toast(d.error || "حدث خطأ", "error")
    setToDelete(null)
    load()
  }

  return (
    <div className="space-y-4">
      <Card title="مزوّدو الشحن" desc="أضف مزوّداً، اختبر اتصاله، وربط الشحنات به من صفحة الطلب"
        icon={Truck}
        action={canManage && (
          <button onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-[12px] font-semibold hover:bg-violet-700 transition-colors">
            {showForm ? <span>إلغاء</span> : <><Plus size={13} /> إضافة</>}
          </button>
        )}>

        {showForm && (
          <div className="mb-5 p-4 rounded-2xl border border-violet-100 bg-violet-50/40 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">الاسم</label>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: شحن Bosta" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">المزوّد</label>
                <select className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}>
                  {codes.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">Base URL</label>
                <input dir="ltr" className={inputCls} value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.example.com" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">API Key</label>
                <input dir="ltr" className={inputCls} value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1">API Secret</label>
                <input dir="ltr" type="password" className={inputCls} value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setForm({ ...form, enabled: !form.enabled })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-white transition-colors">
                <Power size={14} className={form.enabled ? "text-emerald-600" : "text-slate-400"} />
                {form.enabled ? "مفعّل" : "معطّل"}
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-[13px] font-semibold hover:bg-violet-700 disabled:opacity-40 transition-all">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                إضافة المزوّد
              </button>
            </div>
            <p className="text-[11px] text-slate-400">المزوّد اليدوي يعمل بدون أي خدمة خارجية — بقية المزوّدين يتصلون فعلياً بـ REST API.</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : list.length === 0 ? (
          <p className="text-center text-[13px] text-slate-400 py-8">لا توجد مزوّدين بعد</p>
        ) : (
          <div className="space-y-2">
            {list.map((p) => (
              <div key={p.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                      <Truck size={16} className="text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                        {p.name}
                        {p.enabled ? <Badge tone="ok">مفعّل</Badge> : <Badge tone="off">معطّل</Badge>}
                        {p.testStatus === "OK" ? <Badge tone="ok">متصل</Badge> : p.testStatus === "ERROR" ? <Badge tone="err">فشل الاتصال</Badge> : null}
                        <span className="text-[10px] text-slate-400 font-mono">({p.code})</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {p.baseUrl || "بدون URL"} — {p._count?.shipments || 0} شحنة
                        {p.testStatusText && p.testStatus === "ERROR" && <span className="text-red-500"> — {p.testStatusText}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => toggle(p.id, !p.enabled)} disabled={!canManage}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                      <Power size={13} className={p.enabled ? "text-emerald-600" : "text-slate-400"} />
                      {p.enabled ? "إيقاف" : "تفعيل"}
                    </button>
                    <button onClick={() => test(p.id)} disabled={testing === p.id || !canManage} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                      {testing === p.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      اختبار
                    </button>
                    <button onClick={() => setToDelete(p)} disabled={!canManage} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="حذف">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={remove}
        title="حذف مزوّد الشحن" message={`حذف "${toDelete?.name}"؟ لا يمكن حذف مزوّد لديه شحنات مسجلة.`}
        confirmText="حذف" />
    </div>
  )
}

/* ─────────────────────────── n8n ─────────────────────────── */

function N8nTab({ canManage, toast }: any) {
  const [config, setConfig] = useState({ enabled: false, url: "", apiKey: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/admin/integrations/n8n")
      const d = await r.json()
      if (r.ok) setConfig({ enabled: d.enabled, url: d.url || "", apiKey: "" })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      const r = await fetch("/api/admin/integrations/n8n", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, apiKey: config.apiKey || undefined }),
      })
      const d = await r.json()
      if (r.ok) {
        toast("تم الحفظ", "success")
        setConfig((c) => ({ ...c, apiKey: "" }))
      } else toast(d.error || "حدث خطأ", "error")
    } catch {
      toast("حدث خطأ", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card title="تكامل n8n" desc="استقبل أحداث الطلبات في n8n واستجب تلقائياً (مثال: تأكيد/إلغاء)"
        icon={Zap}>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-700">تفعيل n8n</p>
              <p className="text-[11px] text-slate-400">عند التفعيل يستقبل النظام التحديثات الموقّعة من n8n</p>
            </div>
            <button onClick={() => setConfig({ ...config, enabled: !config.enabled })} disabled={!canManage}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mr-3 disabled:opacity-40 ${config.enabled ? "bg-violet-600" : "bg-slate-200"}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${config.enabled ? "right-0.5" : "right-[22px]"}`} />
            </button>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1">رابط n8n (Webhook URL)</label>
            <input dir="ltr" className={inputCls} value={config.url} onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="https://n8n.example.com/webhook/order-events" disabled={!canManage} />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1">مفتاح التوقيع (Secret)</label>
            <div className="relative">
              <input dir="ltr" type={showKey ? "text" : "password"} className={inputCls} value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })} placeholder="مفتاح HMAC مشترك مع n8n"
                disabled={!canManage} />
              <button onClick={() => setShowKey((s) => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button onClick={save} disabled={saving || !canManage}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-[13px] font-semibold hover:bg-violet-700 disabled:opacity-40 transition-all">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            حفظ الإعدادات
          </button>
        </div>
      </Card>

      <Card title="نقطة وصول التحديثات" desc="أرسل تحديثات حالة الطلب إلى هذا الرابط مع التوقيع"
        icon={ExternalLink}>
        <div className="space-y-2">
          <code dir="ltr" className="block px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[12px] font-mono text-slate-600 break-all">
            POST /api/webhooks/inbound
          </code>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            أرسل JSON يحوي <code className="font-mono">orderNumber</code> و <code className="font-mono">status</code> (CONFIRMED, REJECTED, SHIPPED, DELIVERED, COLLECTED, CANCELLED) مع الرأس <code dir="ltr" className="font-mono">x-signature</code> = HMAC-SHA256 للـ Body بمفتاح التوقيع أعلاه. يرفض الطلبات غير الموقّعة.
          </p>
        </div>
      </Card>
    </div>
  )
}
