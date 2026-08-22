export type PermissionModuleId =
  | "dashboard"
  | "products"
  | "categories"
  | "orders"
  | "affiliates"
  | "customers"
  | "withdrawals"
  | "managers"
  | "confirmation"
  | "notifications"
  | "incentives"
  | "suppliers"
  | "settings"
  | "integrations"
  | "webhooks"
  | "api_keys"

export interface PermissionModule {
  id: string
  label: string
  description: string
  icon: string
  order: number
}

export interface PermissionDef {
  key: string
  label: string
  description: string
  module: string
}

/**
 * وحدات النظام (المجموعات). كل وحدة = صفحة/قسم حقيقي داخل لوحة التحكم.
 * كل صلاحية في PERMISSIONS مقيدة بفحص فعلي في الـ APIs والصفحات.
 */
export const PERMISSION_MODULES: PermissionModule[] = [
  { id: "dashboard", label: "لوحة التحكم والإحصائيات", description: "الإحصائيات العامة ومؤشرات الأداء", icon: "layout-dashboard", order: 1 },
  { id: "products", label: "المنتجات", description: "إدارة المنتجات والصور والمتغيرات", icon: "package", order: 2 },
  { id: "categories", label: "التصنيفات", description: "إدارة تصنيفات المنتجات", icon: "tag", order: 3 },
  { id: "orders", label: "الطلبات", description: "إدارة الطلبات وتفاصيلها", icon: "shopping-cart", order: 4 },
  { id: "affiliates", label: "المسوقون", description: "إدارة حسابات المسوقين وأرصدتهم", icon: "users", order: 5 },
  { id: "withdrawals", label: "طلبات السحب والمعاملات المالية", description: "إدارة طلبات السحب والتحويلات", icon: "wallet", order: 6 },
  { id: "managers", label: "المديرون", description: "إدارة حسابات المديرين وصلاحياتهم", icon: "user-cog", order: 7 },
  { id: "confirmation", label: "فريق التأكيد والمراجعة", description: "إدارة فريق التأكيد وتوزيع الطلبات", icon: "shield-check", order: 8 },
  { id: "notifications", label: "الرسائل والإشعارات", description: "إرسال الرسائل وإدارة الإشعارات", icon: "bell", order: 9 },
  { id: "incentives", label: "الحوافز والمكافآت", description: "حملات التحفيز والمكافآت للمسوقين", icon: "trophy", order: 10 },
  { id: "suppliers", label: "الموردون المرشحون", description: "موردوك — ترشيحات المسوقين وبونصات الحملة", icon: "package-search", order: 11 },
  { id: "settings", label: "الإعدادات", description: "إعدادات النظام وأسعار الشحن", icon: "settings", order: 11 },
  { id: "customers", label: "العملاء", description: "قاعدة بيانات العملاء وإدارة الحملات", icon: "contact", order: 11 },
  { id: "integrations", label: "التكاملات", description: "مركز التكاملات والشحن والمزامنة", icon: "plug", order: 12 },
  { id: "webhooks", label: "Webhooks", description: "الواجهات البرمجية الخارجية والأحداث", icon: "webhook", order: 13 },
  { id: "api_keys", label: "مفاتيح API", description: "إدارة مفاتيح API للنظام", icon: "key", order: 14 },
]

/**
 * كتالوج الصلاحيات الفعلي — كل صلاحية مرتبطة بوظيفة حقيقية في النظام:
 * الصفحة أو الزر أو الموديل أو العملية أو الـ API.
 */
export const PERMISSIONS: PermissionDef[] = [
  // لوحة التحكم والإحصائيات
  { key: "dashboard.view", label: "عرض لوحة التحكم", description: "عرض الإحصائيات العامة ومؤشرات الأداء والتقارير", module: "dashboard" },
  // المنتجات
  { key: "products.view", label: "عرض المنتجات", description: "عرض قائمة المنتجات وتفاصيلها ومتغيراتها", module: "products" },
  { key: "products.create", label: "إضافة منتج", description: "إنشاء منتجات جديدة في النظام", module: "products" },
  { key: "products.update", label: "تعديل منتج", description: "تعديل بيانات المنتج والأسعار والصور والمتغيرات", module: "products" },
  { key: "products.delete", label: "حذف منتج", description: "حذف المنتجات نهائياً", module: "products" },
  // التصنيفات
  { key: "categories.view", label: "عرض التصنيفات", description: "عرض تصنيفات المنتجات", module: "categories" },
  { key: "categories.create", label: "إضافة تصنيف", description: "إنشاء تصنيفات جديدة", module: "categories" },
  { key: "categories.delete", label: "حذف تصنيف", description: "حذف التصنيفات من النظام", module: "categories" },
  // الطلبات
  { key: "orders.view", label: "عرض الطلبات", description: "عرض قائمة الطلبات وتفاصيلها", module: "orders" },
  { key: "orders.update", label: "تعديل الطلبات", description: "تغيير حالة الطلب وبياناته وأسعاره وحالة الدفع", module: "orders" },
  { key: "orders.comments", label: "تعليقات الطلبات", description: "إضافة وحذف التعليقات على الطلبات", module: "orders" },
  { key: "orders.images", label: "صور الطلبات", description: "رفع وإدارة صور الطلبات", module: "orders" },
  { key: "orders.batch", label: "عمليات مجمعة للطلبات", description: "تحديث الحالة أو إضافة تعليق لعدة طلبات دفعة واحدة", module: "orders" },
  // المسوقون
  { key: "affiliates.view", label: "عرض المسوقين", description: "عرض المسوقين وإحصائياتهم وأرصدتهم", module: "affiliates" },
  { key: "affiliates.create", label: "إضافة مسوق", description: "إنشاء حسابات مسوقين جديدة", module: "affiliates" },
  { key: "affiliates.update", label: "تعديل مسوق", description: "تعديل بيانات وحالة المسوقين ونسب العمولة", module: "affiliates" },
  // العملاء
  { key: "customers.view", label: "عرض العملاء", description: "عرض قاعدة بيانات العملاء وبياناتهم وطلباتهم", module: "customers" },
  { key: "customers.export", label: "تصدير العملاء", description: "تصدير بيانات العملاء (CSV) وتجهيز حملات التواصل", module: "customers" },
  // طلبات السحب والمعاملات المالية
  { key: "withdrawals.view", label: "عرض طلبات السحب", description: "عرض طلبات السحب والمعاملات المالية", module: "withdrawals" },
  { key: "withdrawals.approve", label: "الموافقة على السحب", description: "الموافقة على طلبات السحب", module: "withdrawals" },
  { key: "withdrawals.reject", label: "رفض السحب", description: "رفض طلبات السحب وإعادة الرصيد للمسوق", module: "withdrawals" },
  { key: "withdrawals.complete", label: "تأكيد التحويل", description: "تأكيد تحويل المبلغ وإرفاق إثبات التحويل", module: "withdrawals" },
  // المديرون
  { key: "managers.view", label: "عرض المديرين", description: "عرض قائمة المديرين وتفاصيل حساباتهم", module: "managers" },
  { key: "managers.create", label: "إضافة مدير", description: "إنشاء حسابات مديرين جديدة في النظام", module: "managers" },
  { key: "managers.update", label: "تعديل مدير", description: "تعديل بيانات وحالة المديرين", module: "managers" },
  { key: "managers.delete", label: "حذف مدير", description: "حذف حسابات المديرين نهائياً", module: "managers" },
  { key: "managers.permissions", label: "إدارة الصلاحيات", description: "تعديل صلاحيات المديرين", module: "managers" },
  // فريق التأكيد والمراجعة
  { key: "confirmation.view", label: "عرض الفريق", description: "عرض فريق التأكيد وتفاصيلهم", module: "confirmation" },
  { key: "confirmation.create", label: "إضافة موظف", description: "إضافة موظفي تأكيد جدد للنظام", module: "confirmation" },
  { key: "confirmation.update", label: "تعديل موظف", description: "تعديل بيانات موظفي التأكيد", module: "confirmation" },
  { key: "confirmation.delete", label: "حذف موظف", description: "حذف موظفي التأكيد من النظام", module: "confirmation" },
  { key: "confirmation.assign", label: "توزيع الطلبات", description: "إسناد وتوزيع الطلبات على فريق التأكيد", module: "confirmation" },
  { key: "confirmation.confirm", label: "تأكيد الطلبات", description: "تأكيد الطلبات الموزعة (استقبال الطلب)", module: "confirmation" },
  { key: "confirmation.reports", label: "تقارير الفريق", description: "عرض تقارير أداء فريق التأكيد", module: "confirmation" },
  // الرسائل والإشعارات
  { key: "notifications.view", label: "عرض الرسائل", description: "عرض صندوق الرسائل والإشعارات", module: "notifications" },
  { key: "notifications.send", label: "إرسال الرسائل", description: "إرسال رسائل وإشعارات للمسوقين", module: "notifications" },
  // الحوافز والمكافآت
  { key: "incentives.view", label: "عرض الحوافز", description: "عرض الحملات التحفيزية والمكافآت وتفاصيلها", module: "incentives" },
  { key: "incentives.create", label: "إنشاء حملة", description: "إنشاء حملات تحفيزية جديدة", module: "incentives" },
  { key: "incentives.update", label: "تعديل الحملات", description: "تعديل الحملات وإيقافها أو إنهاؤها", module: "incentives" },
  { key: "incentives.delete", label: "حذف الحملات", description: "حذف الحملات التحفيزية نهائيًا", module: "incentives" },
  { key: "incentives.manage", label: "إدارة المكافآت", description: "مراجعة وصرف المكافآت المستحقة للمسوقين", module: "incentives" },
  // الموردون المرشحون
  { key: "suppliers.view", label: "عرض الموردين المرشحين", description: "عرض ترشيحات الموردين وحالاتها وتقارير الحملة", module: "suppliers" },
  { key: "suppliers.manage", label: "إدارة الموردين المرشحين", description: "تغيير الحالات وربط المنتجات وإضافة الملاحظات وإدارة إعدادات الحملة وصرف البونصات", module: "suppliers" },
  // الإعدادات
  { key: "settings.view", label: "عرض الإعدادات", description: "عرض إعدادات النظام", module: "settings" },
  { key: "settings.update", label: "تعديل الإعدادات", description: "تعديل إعدادات النظام العامة والهوية", module: "settings" },
  { key: "settings.shipping", label: "إدارة الشحن", description: "إدارة أسعار الشحن والمحافظات", module: "settings" },
  // التكاملات
  { key: "integrations.view", label: "عرض التكاملات", description: "عرض مركز التكاملات وحالة كل خدمة", module: "integrations" },
  { key: "integrations.manage", label: "إدارة التكاملات", description: "إعداد التكاملات وربطها واختبار الاتصال", module: "integrations" },
  { key: "integrations.logs", label: "سجلات التكاملات", description: "عرض سجلات عمليات التكاملات والأخطاء", module: "integrations" },
  // Webhooks
  { key: "webhooks.view", label: "عرض Webhooks", description: "عرض قائمة Webhooks وعمليات التسليم", module: "webhooks" },
  { key: "webhooks.manage", label: "إدارة Webhooks", description: "إنشاء وتعديل وحذف Webhooks واختبارها", module: "webhooks" },
  // مفاتيح API
  { key: "api_keys.view", label: "عرض مفاتيح API", description: "عرض مفاتيح API للنظام", module: "api_keys" },
  { key: "api_keys.manage", label: "إدارة مفاتيح API", description: "إنشاء وإلغاء مفاتيح API وتحديد صلاحياتها", module: "api_keys" },
]

export const PERMISSION_GROUPS: { key: string; label: string }[] = PERMISSION_MODULES.map((m) => ({ key: m.id, label: m.label }))

export const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key)

export const DEFAULT_MANAGER_PERMISSIONS = ["dashboard.view", "managers.view", "confirmation.view", "confirmation.reports"]

export function parsePermissions(permissions: string | string[] | null | undefined): string[] {
  if (Array.isArray(permissions)) return permissions
  if (!permissions) return []
  try {
    const parsed = JSON.parse(permissions)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function can(permissions: string | string[] | null | undefined, key: string): boolean {
  return parsePermissions(permissions).includes(key)
}

export function canAny(permissions: string | string[] | null | undefined, keys: string[]): boolean {
  const list = parsePermissions(permissions)
  return keys.some((k) => list.includes(k))
}

/**
 * صلاحيات ضمنية حسب الدور (لا تُخزَّن في الحساب لكنها ممنوحة تلقائياً).
 * موظفو فريق التأكيد (VERIFIER) يمكنهم رؤية الطلبات لعرض الموزع عليهم.
 */
const IMPLICIT_BY_ROLE: Record<string, string[]> = {
  VERIFIER: ["orders.view"],
}

export interface PermissionContext {
  isSuperAdmin?: boolean
  role?: string | null
  permissions?: string[] | string | null
}

/** قرار الصلاحية المركزي — يُستخدم في السيرفر (admin-guard) والواجهة (hook). */
export function canAct(ctx: PermissionContext | null | undefined, key: string): boolean {
  if (!ctx) return false
  if (ctx.isSuperAdmin) return true
  const implicit = ctx.role ? IMPLICIT_BY_ROLE[ctx.role] || [] : []
  if (implicit.includes(key)) return true
  return parsePermissions(ctx.permissions).includes(key)
}

export function canActAny(ctx: PermissionContext | null | undefined, keys: string[]): boolean {
  return keys.some((k) => canAct(ctx, k))
}
