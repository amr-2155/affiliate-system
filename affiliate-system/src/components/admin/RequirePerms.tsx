"use client"
import type { ReactNode } from "react"
import Link from "next/link"
import { ShieldAlert, Lock, ArrowRight, Loader2 } from "lucide-react"
import { usePermissions } from "@/lib/rbac"

/**
 * حماية صفحة كاملة بصلاحية معينة.
 * عند غياب الصلاحية تُعرض صفحة 403 أنيقة بدلاً من المحتوى.
 */
export function RequirePerms({
  perm,
  anyOf,
  children,
}: {
  perm?: string
  anyOf?: string[]
  children: ReactNode
}) {
  const { status, can, canAny } = usePermissions()

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 size={28} className="text-slate-300 animate-spin" />
        <p className="text-[13px] font-semibold text-slate-400">جارٍ التحقق من الصلاحيات...</p>
      </div>
    )
  }

  const allowed = perm ? can(perm) : anyOf ? canAny(anyOf) : true

  if (!allowed) return <ForbiddenPage />

  return <>{children}</>
}

export function ForbiddenPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center bg-white rounded-3xl border border-slate-100 shadow-sm p-10 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert size={30} className="text-red-500" />
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 text-[11px] font-bold mb-3">
          <Lock size={11} /> 403 · غير مصرح
        </span>
        <h1 className="text-lg font-extrabold text-slate-900 mb-2">ليس لديك صلاحية للوصول إلى هذه الصفحة</h1>
        <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
          حسابك لا يملك الصلاحيات المطلوبة لعرض هذا القسم. يرجى التواصل مع المدير العام لتفعيل الصلاحيات المناسبة.
        </p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm shadow-indigo-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all"
        >
          العودة للوحة التحكم <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
