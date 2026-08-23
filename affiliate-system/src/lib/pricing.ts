/**
 * C-01 fix: server-side pricing — the client never sets a trusted price.
 *
 * Business rule (Phase 1):
 * - Product WITHOUT minPrice  -> fixed-price product. Server always uses
 *   product.price and silently ignores any client-supplied price.
 * - Product WITH minPrice     -> custom selling price is allowed (affiliate
 *   earns the margin above list price), but it must be a finite positive
 *   number >= minPrice. Anything else is rejected.
 *
 * Every order path (create / edit / preview / admin item edit) MUST go
 * through resolveUnitPrice so pricing policy lives in exactly one place.
 */

export interface PriceableProduct {
  price: number
  minPrice?: number | null
}

export type PriceResolution =
  | { ok: true; unitPrice: number; source: "fixed" | "custom" }
  | { ok: false; error: string }

function toFinitePositive(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function resolveUnitPrice(
  product: PriceableProduct,
  requestedUnitPrice?: unknown,
): PriceResolution {
  const base = toFinitePositive(product.price)
  if (base === null) {
    return { ok: false, error: "سعر المنتج غير صالح في قاعدة البيانات" }
  }

  // Fixed-price product: the database price is the only price.
  if (product.minPrice === null || product.minPrice === undefined) {
    return { ok: true, unitPrice: base, source: "fixed" }
  }

  const floor = Number(product.minPrice)
  if (!Number.isFinite(floor) || floor <= 0) {
    // Corrupted floor value -> fall back to fixed pricing rather than trusting input.
    return { ok: true, unitPrice: base, source: "fixed" }
  }

  const requested = toFinitePositive(requestedUnitPrice)
  if (requested === null || requested < floor) {
    return {
      ok: false,
      error: `سعر البيع لهذا المنتج يجب أن يكون ${floor} ج.م على الأقل`,
    }
  }

  return { ok: true, unitPrice: requested, source: "custom" }
}

/** Quantities feed money math — validate once, everywhere. */
export function parseQuantity(value: unknown): number | null {
  const qty = Math.floor(Number(value))
  return Number.isFinite(qty) && qty >= 1 && qty <= 10_000 ? qty : null
}
