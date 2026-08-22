export const SUPPORT_WHATSAPP = "01019959117"
export const SUPPORT_WHATSAPP_URL = "https://wa.me/201019959117"

export const SUPPORT_WHATSAPP_KEY = "support-whatsapp"
export const FACEBOOK_PAGE_URL_KEY = "facebook-page-url"
export const FACEBOOK_GROUP_URL_KEY = "facebook-group-url"

export function buildWhatsAppUrl(phone: string): string {
  const digits = (phone || "").replace(/[^\d]/g, "")
  const normalized = digits.startsWith("0") ? `20${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}`
}

export const DELIVERY_RANGE = "2 - 5 أيام عمل"
export const DELIVERY_ATTEMPTS = "2 - 3 محاولات يوميًا"
export const DELIVERY_ATTEMPT_DAYS = "3 أيام"
export const REFUSAL_FEE = "50 جنيهًا"

export interface HelpLink {
  href: string
  label: string
  desc: string
  key: "delivery" | "returns" | "faq" | "terms" | "privacy" | "contact"
}

export const HELP_LINKS: HelpLink[] = [
  { href: "/help/delivery", label: "الشحن والتوصيل", desc: "مدة التوصيل وطرق الدفع ومحاولات التسليم", key: "delivery" },
  { href: "/help/returns", label: "الاستبدال والاسترجاع", desc: "سياسة الاستبدال والاسترجاع ورسوم الرفض", key: "returns" },
  { href: "/help/faq", label: "الأسئلة الشائعة", desc: "إجابات سريعة لأكثر الأسئلة تكرارًا", key: "faq" },
  { href: "/help/terms", label: "الشروط والأحكام", desc: "شروط استخدام منصة التسويق بالعمولة", key: "terms" },
  { href: "/help/privacy", label: "سياسة الخصوصية", desc: "كيف نتعامل مع بياناتك وتفاصيل الخصوصية", key: "privacy" },
  { href: "/help/contact", label: "تواصل معنا", desc: "قنوات التواصل المباشرة مع فريق الدعم", key: "contact" },
]
