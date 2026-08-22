"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { User, Mail, Phone, Lock, ArrowLeft } from "lucide-react"
import AuthShell from "@/components/auth/AuthShell"
import AuthField from "@/components/auth/AuthField"
import AuthSubmitButton from "@/components/auth/AuthSubmitButton"
import AuthErrorBanner from "@/components/auth/AuthErrorBanner"

interface FieldErrors {
  name?: string
  email?: string
  phone?: string
  password?: string
  confirmPassword?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function RegisterForm({ refCode }: { refCode?: string }) {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)

  const set = (key: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }))
    if (errors[key as keyof FieldErrors]) setErrors((p) => ({ ...p, [key]: undefined }))
  }

  const validate = (): FieldErrors => {
    const e: FieldErrors = {}
    if (!form.name.trim()) e.name = "أدخل الاسم الكامل"
    if (!form.email.trim()) e.email = "أدخل البريد الإلكتروني"
    else if (!EMAIL_RE.test(form.email.trim())) e.email = "صيغة البريد الإلكتروني غير صحيحة"
    if (!form.phone.trim()) e.phone = "أدخل رقم الهاتف"
    else if (form.phone.replace(/\D/g, "").length < 10) e.phone = "أدخل رقم هاتف صحيح"
    if (!form.password) e.password = "أدخل كلمة المرور"
    else if (form.password.length < 6) e.password = "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
    if (!form.confirmPassword) e.confirmPassword = "أعد إدخال كلمة المرور"
    else if (form.confirmPassword !== form.password) e.confirmPassword = "كلمتا المرور غير متطابقتين"
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError("")
    const v = validate()
    setErrors(v)
    if (Object.keys(v).length > 0) return

    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ref: refCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setServerError(data.error || "حدث خطأ أثناء التسجيل")
        setLoading(false)
        return
      }
      const result = await signIn("credentials", { email: form.email, password: form.password, redirect: false })
      if (result?.error) {
        router.push("/login")
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setServerError("حدث خطأ أثناء التسجيل")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="auth-card w-full max-w-md relative overflow-hidden p-8 sm:p-10 animate-fadeIn">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-brand-gradient" />

        <div className="text-center mb-8">
          <h2 className="text-[24px] sm:text-[26px] font-extrabold text-slate-900 tracking-tight">
            إنشاء حساب جديد
          </h2>
          <p className="text-slate-500 mt-2.5 text-[15px] leading-relaxed">
            أنشئ حسابك مجانًا وابدأ رحلتك في التسويق بالعمولة
          </p>
        </div>

        {refCode && (
          <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl animate-fadeIn">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <User size={13} className="text-white" />
            </div>
            <p className="text-[12px] text-indigo-900 font-medium leading-relaxed">
              أنت تسجل عبر دعوة مسوق برقم <span className="font-bold font-mono" dir="ltr">{refCode}</span> — سيتم ربط حسابك به تلقائيًا
            </p>
          </div>
        )}

        {serverError && (
          <div className="mb-5">
            <AuthErrorBanner message={serverError} onDismiss={() => setServerError("")} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <AuthField
            label="الاسم الكامل"
            value={form.name}
            onChange={set("name")}
            placeholder="الاسم الكامل"
            icon={<User size={16} />}
            error={errors.name}
            autoComplete="name"
          />

          <AuthField
            label="البريد الإلكتروني"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="name@example.com"
            dir="ltr"
            icon={<Mail size={16} />}
            error={errors.email}
            autoComplete="email"
            inputMode="email"
          />

          <AuthField
            label="رقم الهاتف"
            type="tel"
            value={form.phone}
            onChange={set("phone")}
            placeholder="01XXXXXXXXX"
            dir="ltr"
            icon={<Phone size={16} />}
            error={errors.phone}
            autoComplete="tel"
            inputMode="tel"
          />

          <AuthField
            label="كلمة المرور"
            value={form.password}
            onChange={set("password")}
            placeholder="6 أحرف على الأقل"
            isPassword
            icon={<Lock size={16} />}
            error={errors.password}
            autoComplete="new-password"
          />

          <AuthField
            label="تأكيد كلمة المرور"
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            placeholder="أعد إدخال كلمة المرور"
            isPassword
            icon={<Lock size={16} />}
            error={errors.confirmPassword}
            autoComplete="new-password"
          />

          <AuthSubmitButton loading={loading} loadingText="جاري إنشاء الحساب...">
            <>
              <span>إنشاء حساب</span>
              <ArrowLeft size={16} />
            </>
          </AuthSubmitButton>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-sm text-slate-500">
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="font-bold text-blue-600 hover:text-blue-700 transition-colors">
              سجّل الدخول
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  )
}
