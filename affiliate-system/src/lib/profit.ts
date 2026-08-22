export type ScenarioId = "conservative" | "realistic" | "optimistic"

export interface ProfitInputs {
  salePrice: number
  commission: number
  adCost: number
  orders: number
  deliveryRate: number
  extraCosts: number
}

export interface ProfitResults {
  expectedDelivered: number
  totalSales: number
  totalCommission: number
  adCost: number
  extraCosts: number
  netProfit: number
  profitPerOrder: number
  cpa: number
  roas: number
  breakEvenOrders: number
  breakEvenDeliveryRate: number
  margin: number
  status: "profit" | "break-even" | "loss"
}

export function calculateProfit(input: ProfitInputs): ProfitResults {
  const { salePrice, commission, adCost, orders, deliveryRate, extraCosts } = input

  const expectedDelivered = Math.round(orders * (deliveryRate / 100))
  const totalSales = expectedDelivered * salePrice
  const totalCommission = expectedDelivered * commission
  const netProfit = totalCommission - adCost - extraCosts
  const profitPerOrder = expectedDelivered > 0 ? netProfit / expectedDelivered : 0
  const cpa = expectedDelivered > 0 ? adCost / expectedDelivered : 0
  const roas = adCost > 0 ? totalSales / adCost : 0
  const totalFixed = adCost + extraCosts
  const breakEvenOrders = commission > 0 ? Math.ceil(totalFixed / commission) : Infinity
  const breakEvenDeliveryRate =
    commission > 0 && orders > 0 ? (totalFixed / (orders * commission)) * 100 : Infinity
  const margin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0

  const status: ProfitResults["status"] =
    netProfit > 0 ? "profit" : netProfit === 0 ? "break-even" : "loss"

  return {
    expectedDelivered,
    totalSales,
    totalCommission,
    adCost,
    extraCosts,
    netProfit,
    profitPerOrder,
    cpa,
    roas,
    breakEvenOrders,
    breakEvenDeliveryRate,
    margin,
    status,
  }
}

export interface ScenarioPreset {
  id: ScenarioId
  label: string
  emoji: string
  ordersFactor: number
  deliveryDelta: number
}

export const SCENARIOS: ScenarioPreset[] = [
  { id: "conservative", label: "متحفظ", emoji: "🛡️", ordersFactor: 0.7, deliveryDelta: -8 },
  { id: "realistic", label: "واقعي", emoji: "⚖️", ordersFactor: 1, deliveryDelta: 0 },
  { id: "optimistic", label: "متفائل", emoji: "🚀", ordersFactor: 1.3, deliveryDelta: 8 },
]

export function applyScenario(base: ProfitInputs, scenario: ScenarioId): ProfitInputs {
  const preset = SCENARIOS.find((s) => s.id === scenario) || SCENARIOS[1]
  return {
    ...base,
    orders: Math.max(1, Math.round(base.orders * preset.ordersFactor)),
    deliveryRate: Math.min(100, Math.max(0, base.deliveryRate + preset.deliveryDelta)),
  }
}

export interface ProductMoney {
  displayPrice: number
  unitCommission: number
  commissionRate: number | null
}

export interface ProductProfile {
  id?: string
  nameAr?: string
  name?: string
  price?: number
  minPrice?: number | null
  affiliateCostPrice?: number | null
  commissionRate?: number | null
  image?: string | null
  stock?: number
  category?: { nameAr?: string; name?: string } | null
  descriptionAr?: string | null
  description?: string | null
  deliveryStats?: Partial<DeliveryStats> | null
}

/** يحسب سعر البيع وعمولة الوحدة من بيانات المنتج الحقيقية (نفس منطق صفحات المنتجات). */
export function productMoney(p: ProductProfile): ProductMoney {
  const minPrice = typeof p?.minPrice === "number" ? p.minPrice : null
  const price = typeof p?.price === "number" ? p.price : 0
  const affiliateCostPrice = typeof p?.affiliateCostPrice === "number" ? p.affiliateCostPrice : null

  const displayPrice = minPrice || price
  let unitCommission = 0
  if (minPrice) unitCommission = Math.max(0, minPrice - price)
  else if (affiliateCostPrice) unitCommission = Math.max(0, price - affiliateCostPrice)

  const commissionRate = typeof p?.commissionRate === "number" ? p.commissionRate : null

  return { displayPrice, unitCommission, commissionRate }
}

export interface DeliveryStats {
  totalOrders: number
  deliveredOrders: number
  collectedOrders: number
  cancelledOrders: number
  deliveryRate: number
}

export const DEFAULT_DELIVERY_RATE = 70

/** نسبة التسليم الحقيقية للمنتج من قاعدة البيانات، أو القيمة الافتراضية إن لم تتوفر بيانات. */
export function productDeliveryRate(stats?: Partial<DeliveryStats> | null): number {
  if (stats && typeof stats.deliveryRate === "number" && (stats.totalOrders || 0) > 0) {
    return Math.min(100, Math.max(0, stats.deliveryRate))
  }
  return DEFAULT_DELIVERY_RATE
}

export function effectiveUnitCommission(p: ProductProfile): number {
  return productMoney(p).unitCommission
}

/** التقدير السريع لربح 100 طلب يُعرض على صفحة المنتج. */
export function quickEstimate(p: ProductProfile, stats?: Partial<DeliveryStats> | null): {
  commission: number
  deliveryRate: number
  per100: number
  per100Net: number
} {
  const { unitCommission } = productMoney(p)
  const deliveryRate = productDeliveryRate(stats)
  const expected = Math.round(100 * (deliveryRate / 100))
  return {
    commission: unitCommission,
    deliveryRate,
    per100: unitCommission * expected,
    per100Net: unitCommission * expected,
  }
}
