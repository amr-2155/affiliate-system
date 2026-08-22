export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function generateOrderNumber(): string {
  const prefix = "ORD"
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
    UNDER_REVIEW: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200/60",
    CONFIRMED: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60",
    PROCESSING: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60",
    SHIPPED: "bg-purple-50 text-purple-700 ring-1 ring-purple-200/60",
    DELIVERED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
    COLLECTED: "bg-teal-50 text-teal-700 ring-1 ring-teal-200/60",
    CANCELLED: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
    RETURNED: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60",
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
    INACTIVE: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/60",
    ARCHIVED: "bg-slate-100 text-slate-500 ring-1 ring-slate-200/60",
    APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
    REJECTED: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
    COMPLETED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
    PAID: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
    FAILED: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
    REFUNDED: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/60",
    SUSPENDED: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
  }
  return colors[status] || "bg-slate-100 text-slate-700 ring-1 ring-slate-200/60"
}

export function getStatusText(status: string): string {
  const texts: Record<string, string> = {
    PENDING: "قيد الانتظار",
    UNDER_REVIEW: "قيد المراجعة",
    CONFIRMED: "مؤكد",
    PROCESSING: "قيد المعالجة",
    SHIPPED: "تم الشحن",
    DELIVERED: "تم التوصيل",
    COLLECTED: "تم التحصيل",
    CANCELLED: "ملغي",
    RETURNED: "مرتجع",
    ACTIVE: "نشط",
    INACTIVE: "غير نشط",
    ARCHIVED: "مؤرشف",
    APPROVED: "موافق عليه",
    REJECTED: "مرفوض",
    COMPLETED: "مكتمل",
    PAID: "مدفوع",
    FAILED: "فشل",
    REFUNDED: "مسترد",
    SUSPENDED: "معلق",
  }
  return texts[status] || status
}
