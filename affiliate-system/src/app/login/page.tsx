"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, Lock, ArrowLeft } from "lucide-react"
import AuthShell from "@/components/auth/AuthShell"
import AuthField from "@/components/auth/AuthField"
import AuthSubmitButton from "@/components/auth/AuthSubmitButton"
import AuthErrorBanner from "@/components/auth/AuthErrorBanner"
import { SUPPORT_WHATSAPP_URL } from "@/lib/helpCenter"

interface FieldErrors {
  email?: string
  password?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const FORGOT_URL = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(
  "مرحبًا، أريد استعادة كلمة المرور الخاصة بحسابي على المنصة."
)}`

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)

  const validate = (): FieldErrors => {
    const e: FieldErrors = {}
    const trimmed = email.trim()
    if (!trimmed) e.email = "أدخل البريد الإلكتروني"
    else if (!EMAIL_RE.test(trimmed)) e.email = "صيغة البريد الإلكتروني غير صحيحة"
    if (!password) e.password = "أدخل كلمة المرور"
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
      const result = await signIn("credentials", { email: email.trim(), password, redirect: false })
      if (result?.error) {
        setServerError("البريد الإلكتروني أو كلمة المرور غير صحيحة")
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setServerError("حدث خطأ أثناء تسجيل الدخول، حاول مرة أخرى")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <div className="auth-card w-full relative overflow-hidden p-7 sm:p-9 animate-fadeIn">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-brand-gradient" />

        <div className="text-center mb-8">
          <h2 className="text-[24px] sm:text-[26px] font-extrabold text-slate-900 tracking-tight">
            مرحبًا بعودتك
          </h2>
          <p className="text-slate-500 mt-2.5 text-[14px] leading-relaxed">
            سجّل دخولك لمتابعة أعمالك من لوحة واحدة
          </p>
        </div>

        {serverError && (
          <div className="mb-5">
            <AuthErrorBanner message={serverError} onDismiss={() => setServerError("")} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <AuthField
            label="البريد الإلكتروني"
            type="email"
            value={email}
            onChange={(v) => {
              setEmail(v)
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }))
            }}
            placeholder="name@example.com"
            dir="ltr"
            icon={<Mail size={16} />}
            error={errors.email}
            autoComplete="email"
            inputMode="email"
          />

          <AuthField
            label="كلمة المرور"
            value={password}
            onChange={(v) => {
              setPassword(v)
              if (errors.password) setErrors((p) => ({ ...p, password: undefined }))
            }}
            placeholder="••••••••"
            isPassword
            icon={<Lock size={16} />}
            error={errors.password}
            autoComplete="current-password"
          />

          <AuthSubmitButton loading={loading} loadingText="جاري تسجيل الدخول...">
            <>
              <span>تسجيل الدخول</span>
              <ArrowLeft size={16} />
            </>
          </AuthSubmitButton>

          <div className="text-center -mt-1">
            <a
              href={FORGOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
            >
              نسيت كلمة المرور؟
            </a>
          </div>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <span className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
          <span className="text-[11px] text-slate-400 dark:text-slate-500">أو</span>
          <span className="flex-1 h-px bg-slate-200 dark:bg-white/10" />
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/5 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ليس لديك حساب؟{" "}
            <Link href="/register" className="font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors">
              سجل الآن مجانًا
            </Link>
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center gap-x-3 gap-y-1 flex-wrap text-[11.5px] text-slate-400 dark:text-slate-500">
          <Link href="/help/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            سياسة الخصوصية
          </Link>
          <span className="text-slate-300 dark:text-slate-600 select-none">•</span>
          <Link href="/help/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            الشروط والأحكام
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
