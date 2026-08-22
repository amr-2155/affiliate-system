"use client"
import { useEffect, useState } from "react"
import { Bell, Send, Loader2, Users, Check, Search, Inbox, Link2 } from "lucide-react"
import { useToast } from "@/components/Toast"
import { usePermissions } from "@/lib/rbac"
import { RequirePerms } from "@/components/admin/RequirePerms"
import NotificationCenter from "@/components/NotificationCenter"
import ConfirmDialog from "@/components/ConfirmDialog"

interface Affiliate {
  id: string
  name: string
  email: string
  status: string
}

const NOTIF_TYPES = [
  { value: "INFO", label: "معلومات", color: "bg-blue-50 text-blue-600" },
  { value: "SYSTEM", label: "إشعار نظام", color: "bg-purple-50 text-purple-600" },
  { value: "ORDER", label: "طلبات", color: "bg-green-50 text-green-600" },
  { value: "EARNINGS", label: "أرباح", color: "bg-violet-50 text-violet-600" },
  { value: "WITHDRAWAL", label: "سحب", color: "bg-yellow-50 text-yellow-600" },
  { value: "STOCK", label: "مخزون", color: "bg-red-50 text-red-600" },
  { value: "REWARD", label: "مكافآت", color: "bg-yellow-50 text-yellow-700" },
  { value: "AFFILIATE", label: "مسوق جديد", color: "bg-orange-50 text-orange-600" },
]

const PLACEHOLDER_LINKS = [
  { label: "بدون رابط", value: "" },
  { label: "صفحة الطلبات", value: "/orders" },
  { label: "صفحة السحوبات", value: "/withdrawals" },
  { label: "لوحة التحكم", value: "/dashboard" },
  { label: "صفحة المنتجات", value: "/products" },
]

export default function AdminNotificationsPage() {
  const { toast } = useToast()
  const perms = usePermissions()
  const can = perms.can
  const [tab, setTab] = useState<"send" | "inbox">("send")
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [type, setType] = useState("INFO")
  const [link, setLink] = useState("")
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all")
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendConfirm, setSendConfirm] = useState<string[] | undefined>(undefined)

  useEffect(() => {
    fetch("/api/admin/affiliates")
      .then(r => r.json())
      .then(d => { setAffiliates(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = search.trim()
    ? affiliates.filter(a => a.name.includes(search.trim()) || a.email.includes(search.trim().toLowerCase()))
    : affiliates

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelected(prev => {
      const next = new Set(prev)
      filtered.forEach(a => next.add(a.id))
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  const doSend = async (targetIds: string[] | undefined) => {
    setSending(true)
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, message, type, link: link || undefined, targetIds }),
      })
      const data = await res.json()
      if (res.ok) {
        toast(`تم إرسال الرسالة إلى ${data.count} مسوق`, "success")
        setTitle("")
        setMessage("")
        setLink("")
        setSelected(new Set())
      } else {
        toast(data.error || "حدث خطأ", "error")
      }
    } catch {
      toast("خطأ في الاتصال", "error")
    }
    setSending(false)
  }

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast("اكتب العنوان والرسالة", "error")
      return
    }
    if (targetMode === "selected" && selected.size === 0) {
      toast("اختر مسوق واحد على الأقل", "error")
      return
    }
    const targetIds = targetMode === "selected" ? Array.from(selected) : undefined
    setSendConfirm(targetIds)
  }

  const activeAffiliates = affiliates.filter(a => a.status === "ACTIVE").length

  return (
    <RequirePerms perm="notifications.view">
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
          <Bell size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">الرسائل والإشعارات</h1>
          <p className="text-[12px] text-slate-500">أرسل رسائل للمسوقين وتابع جميع الإشعارات</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-100 shadow-sm p-1.5 w-fit">
        <button
          onClick={() => setTab("send")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-all ${tab === "send" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <Send size={14} />
          إرسال رسالة
        </button>
        <button
          onClick={() => setTab("inbox")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-bold transition-all ${tab === "inbox" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
        >
          <Inbox size={14} />
          صندوق الإشعارات
        </button>
      </div>

      {tab === "send" ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Compose */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center"><Send size={16} className="text-indigo-600" /></div>
                <div>
                  <h2 className="text-[14px] font-bold text-slate-900">إنشاء رسالة</h2>
                  <p className="text-[11px] text-slate-400">تظهر للمسوقين في صفحة الإشعارات</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">عنوان الرسالة *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: مناسبة خاصة" className="input-premium" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">نص الرسالة *</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="اكتب نص الرسالة هنا..." className="input-premium resize-none" />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">الصفحة المرتبطة (اختياري)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Link2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={link} onChange={e => setLink(e.target.value)} placeholder="/orders  أو  /admin/orders/123" dir="ltr" className="input-premium pr-9" />
                    </div>
                    <select value={link} onChange={e => setLink(e.target.value)} className="input-premium sm:w-44">
                      {PLACEHOLDER_LINKS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">عند الضغط على الإشعار سيُفتح هذا الرابط مباشرة</p>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">نوع الإشعار</label>
                  <div className="flex flex-wrap gap-2">
                    {NOTIF_TYPES.map(t => (
                      <button key={t.value} type="button" onClick={() => setType(t.value)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all border ${type === t.value ? `${t.color} border-transparent shadow-sm` : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center"><Users size={16} className="text-indigo-600" /></div>
                <div>
                  <h2 className="text-[14px] font-bold text-slate-900">المستلمون</h2>
                  <p className="text-[11px] text-slate-400">{affiliates.length} مسوق ({activeAffiliates} نشط)</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setTargetMode("all")}
                    className={`p-4 rounded-xl border-2 text-right transition-all ${targetMode === "all" ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"}`}>
                    <p className="text-[13px] font-bold text-slate-800">جميع المسوقين</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">إرسال لكل المسوقين النشطين</p>
                  </button>
                  <button type="button" onClick={() => setTargetMode("selected")}
                    className={`p-4 rounded-xl border-2 text-right transition-all ${targetMode === "selected" ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-slate-300"}`}>
                    <p className="text-[13px] font-bold text-slate-800">اختيار مسوقين محددين</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{selected.size} مختار</p>
                  </button>
                </div>

                {targetMode === "selected" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الإيميل..." className="input-premium pr-9" />
                      </div>
                      <button type="button" onClick={selectAllFiltered} className="px-3 py-2 text-[12px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">تحديد الكل</button>
                      <button type="button" onClick={clearSelection} className="px-3 py-2 text-[12px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">مسح</button>
                    </div>
                    {loading ? (
                      <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>
                    ) : filtered.length === 0 ? (
                      <p className="text-center py-8 text-[13px] text-slate-400">لا يوجد مسوقين مطابقين</p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {filtered.map(a => (
                          <label key={a.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selected.has(a.id) ? "bg-indigo-50/60" : "hover:bg-slate-50"}`}>
                            <input
                              type="checkbox"
                              checked={selected.has(a.id)}
                              onChange={() => toggleSelect(a.id)}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                            />
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
                              {a.name?.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-slate-800 truncate">{a.name}</p>
                              <p className="text-[11px] text-slate-500 truncate">{a.email}</p>
                            </div>
                            {selected.has(a.id) && <Check size={15} className="text-indigo-600" />}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Send card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden sticky top-5">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-[14px] font-bold text-slate-900">ملخص الإرسال</h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between"><span className="text-slate-500">المستلمون</span><span className="font-semibold text-slate-800">{targetMode === "all" ? `الكل (${activeAffiliates})` : `${selected.size} مسوق`}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">النوع</span><span className="font-semibold text-slate-800">{NOTIF_TYPES.find(t => t.value === type)?.label}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">الرابط</span><span className="font-semibold text-slate-800 truncate max-w-[120px]" dir="ltr">{link || "—"}</span></div>
                </div>
                {can("notifications.send") && (
                <button onClick={handleSend} disabled={sending}
                  className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed">
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {sending ? "جاري الإرسال..." : "إرسال الرسالة"}
                </button>
                )}
                <p className="text-[11px] text-slate-400 text-center">سيظهر الإشعار للمسوقين فور تحديث صفحتهم</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <NotificationCenter />
      )}

      <ConfirmDialog
        open={!!sendConfirm}
        onClose={() => setSendConfirm(undefined)}
        onConfirm={() => { doSend(sendConfirm); setSendConfirm(undefined) }}
        title="تأكيد الإرسال"
        message={`سيتم إرسال الرسالة إلى ${sendConfirm ? `${sendConfirm.length} مسوق` : "جميع المسوقين"}. متابعة؟`}
        confirmText="إرسال"
      />
    </div>
    </RequirePerms>
  )
}
