export interface CommissionProduct {
  price: number
  minPrice?: number | null
  affiliateCostPrice?: number | null
}

export interface CommissionItemInput {
  product: CommissionProduct
  unitPrice: number
  quantity: number
}

/**
 * عمولة منتج واحد = فرق السعر (سعر البيع − التكلفة) × الكمية.
 * قاعدة العمولة معرّفة في /api/orders POST — هذه نسخة مشتركة واحدة يحسب بها كل مكان.
 */
export function computeItemCommission(product: CommissionProduct, unitPrice: number, quantity: number): number {
  const unitCost = product.minPrice ? product.price : (product.affiliateCostPrice ?? null)
  if (unitCost === null || unitCost === undefined) return 0
  const diff = unitPrice - unitCost
  if (diff <= 0) return 0
  return diff * quantity
}

export function computeCommission(items: CommissionItemInput[]): number {
  return items.reduce((sum, item) => sum + computeItemCommission(item.product, item.unitPrice, item.quantity), 0)
}
