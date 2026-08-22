import { detectProfile } from "@/lib/strategy"
import { formatCurrency } from "@/lib/utils"
import { DEFAULT_DELIVERY_RATE } from "@/lib/profit"

export type RecommendationId = "start" | "test" | "avoid"

export type ScoreLevelId = "strong" | "medium" | "weak"

export type StockLevelId = "high" | "medium" | "low" | "out"

export interface AnalysisInputProduct {
  id: string
  nameAr: string
  name: string
  price: number
  commission: number
  stock: number
  categoryNameAr: string
  descriptionAr: string | null
  description: string | null
}

export interface AnalysisInput {
  product: AnalysisInputProduct
  orderStats: {
    totalOrders: number
    deliveryRate: number | null
  }
  affiliate: {
    totalOrders: number
    deliveryRate: number | null
  }
}

export interface Recommendation {
  id: RecommendationId
  label: string
  color: string
  reason: string
}

export interface ProductAnalysis {
  score: number
  level: { id: ScoreLevelId; label: string; color: string }
  recommendation: Recommendation
  audience: string[]
  mainProblem: string
  bestAngle: string
  expectedProfit: {
    deliveryRate: number
    hasRealStats: boolean
    deliveredPer100: number
    netPer100: number
    cpaTarget: number
  }
  stock: { level: StockLevelId; label: string; color: string }
  videos: string[]
  hooks: string[]
  adCopy: string
  cta: string
  objections: { question: string; answer: string }[]
}

function clampScore(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)))
}

function scoreCommission(commission: number, price: number): number {
  if (commission <= 0) return 0
  const ratio = price > 0 ? commission / price : 0
  if (commission >= 150 && ratio >= 0.2) return 30
  if (commission >= 80 && ratio >= 0.1) return 26
  if (commission >= 50 || ratio >= 0.08) return 20
  if (commission >= 30) return 14
  return 8
}

function scoreDelivery(deliveryRate: number, hasRealStats: boolean): number {
  if (!hasRealStats) return 20
  if (deliveryRate >= 85) return 25
  if (deliveryRate >= 70) return 21
  if (deliveryRate >= 55) return 16
  if (deliveryRate >= 40) return 11
  return 5
}

function scoreStock(stock: number): number {
  if (stock <= 0) return 5
  if (stock <= 10) return 11
  if (stock <= 50) return 16
  return 20
}

function scoreDemand(totalOrders: number): number {
  if (totalOrders >= 100) return 15
  if (totalOrders >= 30) return 12
  if (totalOrders >= 10) return 9
  if (totalOrders >= 1) return 6
  return 3
}

function scorePrice(price: number): number {
  if (price <= 0) return 0
  if (price < 500) return 10
  if (price < 2000) return 8
  if (price < 10000) return 6
  return 4
}

function buildRecommendation(
  score: number,
  opts: {
    commission: number
    stock: number
    deliveryRate: number
    hasRealStats: boolean
    totalOrders: number
    affiliateDeliveryRate: number | null
    productDeliveryRate: number | null
  },
): Recommendation {
  const { commission, stock, deliveryRate, hasRealStats, totalOrders, affiliateDeliveryRate, productDeliveryRate } = opts

  if (stock <= 0) {
    return {
      id: "avoid",
      label: "لا أنصح حاليًا",
      color: "#dc2626",
      reason: "المنتج غير متوفر في المخزون حاليًا — انتظر إعادة التوريد قبل أي حملة.",
    }
  }
  if (commission <= 0) {
    return {
      id: "avoid",
      label: "لا أنصح حاليًا",
      color: "#dc2626",
      reason: "لا توجد عمولة محسوبة لهذا المنتج بعد — اطلب من المتجر تحديدها أولاً.",
    }
  }

  if (score >= 75) {
    const perfNote =
      affiliateDeliveryRate != null && productDeliveryRate != null && affiliateDeliveryRate + 15 < productDeliveryRate
        ? ` لكن معدل تسليمك (${Math.round(affiliateDeliveryRate)}%) أقل من معدل المنتج (${Math.round(productDeliveryRate)}%) — حسّن جودة طلباتك أولاً.`
        : ""
    return {
      id: "start",
      label: "ابدأ التسويق",
      color: "#059669",
      reason: `المنتج قوي: عمولة ${formatCurrency(commission)} لكل طلب مسلّم${hasRealStats ? ` ونسبة تسليم ${Math.round(deliveryRate)}%` : ""}.${perfNote}`,
    }
  }

  if (score >= 50) {
    if (hasRealStats && deliveryRate < 55) {
      return {
        id: "test",
        label: "اختبر بحذر",
        color: "#d97706",
        reason: `نسبة تسليم المنتج منخفضة (${Math.round(deliveryRate)}%) — ابدأ بميزانية صغيرة جدًا وراقب النتائج أسبوعيًا.`,
      }
    }
    if (totalOrders < 10) {
      return {
        id: "test",
        label: "اختبر بحذر",
        color: "#d97706",
        reason: "لا يوجد إقبال كافٍ بعد على هذا المنتج — اختبره على جمهور صغير قبل أي التزام.",
      }
    }
    return {
      id: "test",
      label: "اختبر بحذر",
      color: "#d97706",
      reason: "إمكانات المنتج متوسطة — ابدأ باختبار صغير ووسّع فقط بعد ثبات النتائج.",
    }
  }

  const weakPoints: string[] = []
  if (hasRealStats && deliveryRate < 40) weakPoints.push(`نسبة التسليم ${Math.round(deliveryRate)}% منخفضة جدًا`)
  if (totalOrders > 0 && totalOrders < 10) weakPoints.push("إقبال محدود من الطلبات")
  if (commission < 30) weakPoints.push(`العمولة ${formatCurrency(commission)} لا تغطي التكاليف`)
  return {
    id: "avoid",
    label: "لا أنصح حاليًا",
    color: "#dc2626",
    reason: weakPoints.length > 0 ? weakPoints.join("، ") + "." : "نقاط قوة المنتج ضعيفة مقارنة بمجهودك وميزانيتك.",
  }
}

export function analyzeProduct(input: AnalysisInput): ProductAnalysis {
  const { product, orderStats, affiliate } = input
  const price = product.price || 0
  const commission = product.commission || 0
  const stock = product.stock || 0
  const deliveryRate =
    orderStats.deliveryRate != null ? Math.min(100, Math.max(0, orderStats.deliveryRate)) : DEFAULT_DELIVERY_RATE
  const hasRealStats = (orderStats.totalOrders || 0) > 0

  const score = clampScore(
    scoreCommission(commission, price) +
      scoreDelivery(deliveryRate, hasRealStats) +
      scoreStock(stock) +
      scoreDemand(orderStats.totalOrders || 0) +
      scorePrice(price),
  )

  const level: ProductAnalysis["level"] =
    score >= 75
      ? { id: "strong", label: "قوية", color: "#059669" }
      : score >= 50
        ? { id: "medium", label: "متوسطة", color: "#d97706" }
        : { id: "weak", label: "ضعيفة", color: "#dc2626" }

  const stockInfo: ProductAnalysis["stock"] =
    stock <= 0
      ? { level: "out", label: "غير متوفر", color: "#dc2626" }
      : stock <= 10
        ? { level: "low", label: "مخزون منخفض", color: "#d97706" }
        : stock <= 50
          ? { level: "medium", label: "مخزون متوسط", color: "#2563eb" }
          : { level: "high", label: "متوفر بكثرة", color: "#059669" }

  const deliveredPer100 = Math.round(100 * (deliveryRate / 100))
  const netPer100 = deliveredPer100 * commission
  const cpaTarget = Math.round(commission * (deliveryRate / 100))

  const { profile } = detectProfile({
    nameAr: product.nameAr,
    name: product.name,
    price,
    category: product.categoryNameAr ? { nameAr: product.categoryNameAr } : null,
  })

  const recommendation = buildRecommendation(score, {
    commission,
    stock,
    deliveryRate,
    hasRealStats,
    totalOrders: orderStats.totalOrders || 0,
    affiliateDeliveryRate: affiliate.deliveryRate,
    productDeliveryRate: orderStats.deliveryRate,
  })

  const name = product.nameAr || product.name
  const description = product.descriptionAr || product.description || ""
  const descPart = description.length > 90 ? description.slice(0, 90).trim() + "…" : description

  const videos = [
    `استعراض عملي حقيقي لـ«${name}» — نوضح المواصفات كما هي في صفحة المنتج دون مبالغة.`,
    `3 استخدامات مختلفة لـ«${name}» في يوم واحد — شرح قصير وسريع.`,
    `مقارنة سريعة: «${name}» بسعر ${formatCurrency(price)} أمام البدائل المتاحة.`,
  ]

  const hooks = [
    `«${name}».. شوف المواصفات الحقيقية قبل ما تقرر.`,
    `الدفع عند الاستلام: تفتح الطلب وتتأكد بنفسك قبل أن تدفع.`,
    `سعر ${formatCurrency(price)} — هل تستحق مواصفاته فعلاً؟`,
  ]

  const adCopy = `«${name}»${descPart ? ` — ${descPart}` : ""} بسعر ${formatCurrency(price)} والدفع عند الاستلام. اطلب الآن والتوصيل لباب البيت.`

  const cta = `اطلب «${name}» الآن من صفحة المنتج، الدفع عند الاستلام والتوصيل لباب البيت.`

  const objections = [
    {
      question: "هل المنتج أصلي؟",
      answer: "راجع المواصفات والمصدر كما هي موثقة في صفحة المنتج، وتأكد بنفسك عند الاستلام قبل الدفع.",
    },
    {
      question: "كيف أتأكد من الجودة؟",
      answer: "الدفع عند الاستلام: تفتح الطلب وتتفحصه بنفسك قبل أن تدفع أي مبلغ.",
    },
    {
      question: `هل سعر ${formatCurrency(price)} مناسب؟`,
      answer: "قارنه بالبدائل المتاحة وقرر بناءً على المواصفات الفعلية المذكورة في صفحة المنتج.",
    },
  ]

  return {
    score,
    level,
    recommendation,
    audience: profile.audience.slice(0, 3),
    mainProblem: profile.problem[0],
    bestAngle: profile.angles[0],
    expectedProfit: {
      deliveryRate,
      hasRealStats,
      deliveredPer100,
      netPer100,
      cpaTarget,
    },
    stock: stockInfo,
    videos,
    hooks,
    adCopy,
    cta,
    objections,
  }
}
