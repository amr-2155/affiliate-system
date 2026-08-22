"use client"
import { useEffect, useState } from "react"
import {
  User, Mail, Phone, Key, Loader2, Package, Wallet, Bell, Pencil, Shield,
  ShieldCheck, CalendarDays, Coins, ShoppingCart, ArrowLeft, Activity,
} from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/components/Toast"
import CopyButton from "@/components/CopyButton"
import EmptyState from "@/components/EmptyState"
import { resolveNotificationHref } from "@/components/NotificationUI"
import Link from "next/link"

interface Profile {
  id: string
  name: string
  email: string
  phone?: string
  avatar?: string
  role: string
  status: string
  commissionRate: number
  balance: number
  totalEarnings: number
  referralCode: string
  createdAt: string
  _count: { orders: number; favorites: number }
}

interface ActivityItem {
  kind: "order" | "withdrawal" | "notification"
  id: string
  title: string
  desc: string
  time: string
  href: string | null
}

interface OrderLite { id: string; orderNumber: string; customerName: string; total: number; createdAt: string }
interface WithdrawalLite { id: string; amount: number; method: string; createdAt: string }
interface NotificationLite { id: string; title: string; message: string; createdAt: string; link?: string | null; relatedId?: string | null; type: string; read: boolean }

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "تحويل بنكي",
  VODAFONE_CASH: "فودافون كاش",
  INSTAPAY: "إنستاباي",
  OTHER: "أخرى",
}

const ACTIVITY_META = {
  order: { icon: Package, tint: "#2563eb", bg: "from-blue-500 to-indigo-600" },
  withdrawal: { icon: Wallet, tint: "#d97706", bg: "from-amber-500 to-orange-600" },
  notification: { icon: Bell, tint: "#7c3aed", bg: "from-purple-500 to-fuchsia-600" },
}

function timeAgo(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "الآن"
  if (mins < 60) return `منذ ${mins} دقيقة`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `منذ ${hrs} ساعة`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `منذ ${days} يوم`
  return formatDate(date)
}

export default function ProfilePage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "" })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data)
        setForm({ name: data.name || "", phone: data.phone || "" })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    Promise.all([
      fetch("/api/orders?limit=6").then((r) => r.json()),
      fetch("/api/withdrawals").then((r) => r.json()),
      fetch("/api/notifications?limit=6").then((r) => r.json()),
    ])
      .then(([o, w, n]) => {
        const orders: ActivityItem[] = (o.orders || []).map((x: OrderLite) => ({
          kind: "order",
          id: x.id,
          title: `طلب ${x.orderNumber}`,
          desc: `${x.customerName} — ${formatCurrency(x.total)}`,
          time: x.createdAt,
          href: `/orders?view=${x.id}`,
        }))
        const wds: ActivityItem[] = (Array.isArray(w) ? w : []).map((x: WithdrawalLite) => ({
          kind: "withdrawal",
          id: x.id,
          title: "طلب سحب",
          desc: `${formatCurrency(x.amount)} — ${METHOD_LABELS[x.method] || x.method}`,
          time: x.createdAt,
          href: "/withdrawals",
        }))
        const nots: ActivityItem[] = (n.notifications || []).map((x: NotificationLite) => ({
          kind: "notification",
          id: x.id,
          title: x.title,
          desc: x.message,
          time: x.createdAt,
          href: resolveNotificationHref(x),
        }))
        setActivity(
          [...orders, ...wds, ...nots]
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 10)
        )
      })
      .catch(() => {})
  }, [])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const data = await res.json()
        setProfile((prev) => (prev ? { ...prev, ...data } : null))
        setEditing(false)
        toast("تم تحديث الملف الشخصي", "success")
      } else {
        toast("حدث خطأ أثناء التحديث", "error")
      }
    } catch {
      toast("حدث خطأ في الاتصال", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast("كلمتا المرور غير متطابقتين", "error")
      return
    }
    if (passwordForm.newPassword.length < 6) {
      toast("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "error")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm),
      })
      if (res.ok) {
        toast("تم تغيير كلمة المرور بنجاح", "success")
        setShowPasswordForm(false)
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      } else {
        const data = await res.json()
        toast(data.error || "حدث خطأ", "error")
      }
    } catch {
      toast("حدث خطأ في الاتصال", "error")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card-premium p-6 space-y-4 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-slate-100" />
            <div className="h-4 w-40 bg-slate-100 rounded-lg" />
            <div className="h-3 w-56 bg-slate-50 rounded-lg" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((j) => <div key={j} className="h-16 bg-slate-50 rounded-xl" />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!profile) {
    return (
      <EmptyState
        icon={<AlertCircleIcon />}
        title="حدث خطأ في تحميل البيانات"
        subtitle="حاول إعادة التحميل مرة أخرى"
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #059669, #34d399)" }}>
          <User size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">الملف الشخصي</h1>
          <p className="text-[12px] text-slate-500">بياناتك، كلمة المرور، وآخر أنشطتك</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="card-premium overflow-hidden">
        <div className="h-20 bg-gradient-to-l from-indigo-600/90 via-blue-600 to-emerald-600/80" />
        <div className="px-6 pb-6 -mt-10">
          <div className="flex items-end justify-between gap-4">
            <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-3xl font-extrabold text-white" style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)" }}>
              {profile.name.charAt(0)}
            </div>
            <button
              onClick={() => setEditing((e) => !e)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              <Pencil size={13} />
              {editing ? "إلغاء" : "تعديل"}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-extrabold text-slate-900">{profile.name}</h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${profile.role === "ADMIN" ? "bg-purple-50 text-purple-700 ring-1 ring-purple-200/60" : "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60"}`}>
              {profile.role === "ADMIN" ? "مدير" : "مسوق"}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <CalendarDays size={12} /> عضو منذ {formatDate(profile.createdAt)}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
              <ShoppingCart size={15} className="mx-auto text-blue-500" />
              <p className="text-lg font-extrabold text-slate-900 tabular-nums mt-1">{profile._count.orders}</p>
              <p className="text-[10px] text-slate-400">طلب</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
              <Coins size={15} className="mx-auto text-emerald-500" />
              <p className="text-lg font-extrabold text-slate-900 tabular-nums mt-1">{formatCurrency(profile.totalEarnings)}</p>
              <p className="text-[10px] text-slate-400">إجمالي الأرباح</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
              <Wallet size={15} className="mx-auto text-amber-500" />
              <p className="text-lg font-extrabold text-slate-900 tabular-nums mt-1">{formatCurrency(profile.balance)}</p>
              <p className="text-[10px] text-slate-400">الرصيد المتاح</p>
            </div>
          </div>

          {/* Referral */}
          <div className="mt-4 rounded-xl bg-gradient-to-l from-indigo-50 to-blue-50 border border-blue-100 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-indigo-700">كود الإحالة — شارك رصيد نجاحك</p>
              <p className="text-lg font-extrabold text-indigo-900 font-mono tabular-nums" dir="ltr">{profile.referralCode}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <CopyButton text={profile.referralCode} label="نسخ الكود" />
              <span className="text-[10px] text-indigo-500 font-semibold">عمولتك {profile.commissionRate}%</span>
            </div>
          </div>

          {/* Contact info */}
          {editing ? (
            <div className="mt-5 space-y-3">
              <div className="relative">
                <User size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-premium pr-9"
                  placeholder="الاسم"
                />
              </div>
              <div className="relative">
                <Phone size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input-premium pr-9"
                  placeholder="رقم الهاتف"
                  dir="ltr"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  حفظ التغييرات
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <Mail size={15} className="text-slate-400 shrink-0" />
                <span className="text-[13px] text-slate-700" dir="ltr">{profile.email}</span>
              </div>
              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <Phone size={15} className="text-slate-400 shrink-0" />
                <span className="text-[13px] text-slate-700" dir="ltr">{profile.phone || "غير محدد"}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password */}
      <div className="card-premium p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Key size={15} /></span>
            تغيير كلمة المرور
          </h3>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="text-[12px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            {showPasswordForm ? "إلغاء" : "تغيير"}
          </button>
        </div>

        {showPasswordForm && (
          <div className="space-y-3 mt-4">
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="input-premium w-full"
              placeholder="كلمة المرور الحالية"
            />
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="input-premium w-full"
              placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
            />
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="input-premium w-full"
              placeholder="تأكيد كلمة المرور"
            />
            <button
              onClick={handleChangePassword}
              disabled={saving}
              className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
              {saving ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </button>
          </div>
        )}
      </div>

      {/* Activity feed */}
      <div className="card-premium overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Activity size={15} /></span>
            <h3 className="text-[14px] font-bold text-slate-900">آخر الأنشطة</h3>
          </div>
          <Link href="/orders" className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
            كل الطلبات <ArrowLeft size={12} />
          </Link>
        </div>

        {activity.length === 0 ? (
          <EmptyState
            icon={<Activity size={26} className="text-slate-300" />}
            title="لا توجد أنشطة بعد"
            subtitle="طلباتك وعمليات السحب والإشعارات ستظهر هنا"
          />
        ) : (
          <div className="divide-y divide-slate-50">
            {activity.map((a) => {
              const meta = ACTIVITY_META[a.kind]
              const Icon = meta.icon
              const content = (
                <div className="flex items-start gap-3 px-5 py-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.bg} text-white flex items-center justify-center shrink-0 shadow-sm`}>
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-slate-800 truncate">{a.title}</p>
                    <p className="text-[12px] text-slate-500 truncate">{a.desc}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 pt-0.5">{timeAgo(a.time)}</span>
                </div>
              )
              return a.href ? (
                <Link key={`${a.kind}-${a.id}`} href={a.href} className="block hover:bg-slate-50 transition-colors">
                  {content}
                </Link>
              ) : (
                <div key={`${a.kind}-${a.id}`}>{content}</div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function AlertCircleIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}
