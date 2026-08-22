/** حالات المورد المرشح في حملة "أضف موردًا واربح". */
export const SUPPLIER_STATUS = {
  PENDING: "PENDING",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  CONTACTED: "CONTACTED",
  ONBOARDING: "ONBOARDING",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
} as const

export type SupplierStatus = (typeof SUPPLIER_STATUS)[keyof typeof SUPPLIER_STATUS]

/** المسار الطبيعي لحياة المورد المرشح (من الانتظار حتى النشاط). */
export const SUPPLIER_STATUS_FLOW: string[] = [
  SUPPLIER_STATUS.PENDING,
  SUPPLIER_STATUS.UNDER_REVIEW,
  SUPPLIER_STATUS.APPROVED,
  SUPPLIER_STATUS.CONTACTED,
  SUPPLIER_STATUS.ONBOARDING,
  SUPPLIER_STATUS.ACTIVE,
]

export const SUPPLIER_TERMINAL_STATUSES: string[] = [SUPPLIER_STATUS.REJECTED, SUPPLIER_STATUS.EXPIRED]

export const SUPPLIER_STATUS_META: Record<string, { label: string; cls: string; color: string }> = {
  PENDING: { label: "قيد الانتظار", cls: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/70", color: "#64748b" },
  UNDER_REVIEW: { label: "قيد المراجعة", cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/70", color: "#2563eb" },
  APPROVED: { label: "معتمد", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70", color: "#059669" },
  CONTACTED: { label: "تم التواصل", cls: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/70", color: "#0891b2" },
  ONBOARDING: { label: "قيد التفعيل", cls: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/70", color: "#7c3aed" },
  ACTIVE: { label: "نشط", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70", color: "#059669" },
  REJECTED: { label: "مرفوض", cls: "bg-red-50 text-red-700 ring-1 ring-red-200/70", color: "#dc2626" },
  EXPIRED: { label: "انتهت الحملة", cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70", color: "#d97706" },
}

export function supplierStatusLabel(status: string): string {
  return SUPPLIER_STATUS_META[status]?.label || status
}

/** تطبيع رقم الهاتف إلى أرقام فقط — يُستخدم لقاعدة "أول من رشّح المورد". */
export function normalizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "")
}

/** تواريخ العرض مع مراعاة المنطقة الزمنية للمتصفح. */
export function formatDateSmart(d: string | Date | null | undefined): string {
  if (!d) return "—"
  const date = typeof d === "string" ? new Date(d) : d
  try {
    return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short", year: "numeric" }).format(date)
  } catch {
    return date.toLocaleDateString()
  }
}
