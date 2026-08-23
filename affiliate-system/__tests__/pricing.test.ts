import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { resolveUnitPrice, parseQuantity } from "../src/lib/pricing"

/**
 * C-01 core: the server NEVER trusts a client-sent price.
 * These tests pin the exact contract used by every order route.
 */
describe("resolveUnitPrice (C-01)", () => {
  const fixedProduct = { price: 100, minPrice: null }
  const negotiableProduct = { price: 100, minPrice: 80 }

  it("FIXED product: client price of 5000 is ignored — DB price wins", () => {
    const r = resolveUnitPrice(fixedProduct, 5000)
    assert.ok(r.ok)
    if (r.ok) {
      assert.equal(r.unitPrice, 100)
      assert.equal(r.source, "fixed")
    }
  })

  it("FIXED product: no client price at all -> DB price", () => {
    const r = resolveUnitPrice(fixedProduct, undefined)
    assert.ok(r.ok)
    if (r.ok) assert.equal(r.unitPrice, 100)
  })

  it("FIXED product: even a LOWER client price is ignored", () => {
    const r = resolveUnitPrice(fixedProduct, 1)
    assert.ok(r.ok)
    if (r.ok) assert.equal(r.unitPrice, 100)
  })

  it("NEGOTIABLE product: custom price at/above the floor is accepted", () => {
    const atFloor = resolveUnitPrice(negotiableProduct, 80)
    assert.ok(atFloor.ok)
    if (atFloor.ok) assert.equal(atFloor.unitPrice, 80)

    const above = resolveUnitPrice(negotiableProduct, 150)
    assert.ok(above.ok)
    if (above.ok) assert.equal(above.unitPrice, 150)
  })

  it("NEGOTIABLE product: below-floor prices are rejected", () => {
    const r = resolveUnitPrice(negotiableProduct, 79.99)
    assert.equal(r.ok, false)
    if (!r.ok) assert.match(r.error, /80/)
  })

  it("NEGOTIABLE product: missing or garbage price is rejected (not defaulted)", () => {
    assert.equal(resolveUnitPrice(negotiableProduct).ok, false)
    assert.equal(resolveUnitPrice(negotiableProduct, "abc").ok, false)
    assert.equal(resolveUnitPrice(negotiableProduct, -5).ok, false)
    assert.equal(resolveUnitPrice(negotiableProduct, 0).ok, false)
    assert.equal(resolveUnitPrice(negotiableProduct, NaN).ok, false)
    assert.equal(resolveUnitPrice(negotiableProduct, Infinity).ok, false)
  })

  it("corrupted minPrice falls back to fixed DB pricing instead of trusting input", () => {
    const broken = { price: 100, minPrice: -20 }
    const r = resolveUnitPrice(broken, 9999)
    assert.ok(r.ok)
    if (r.ok) assert.equal(r.unitPrice, 100)
  })

  it("product with invalid DB price is refused outright", () => {
    assert.equal(resolveUnitPrice({ price: 0 }).ok, false)
    assert.equal(resolveUnitPrice({ price: NaN }).ok, false)
  })
})

describe("parseQuantity", () => {
  it("accepts positive integers", () => {
    assert.equal(parseQuantity(1), 1)
    assert.equal(parseQuantity("5"), 5)
    assert.equal(parseQuantity(10), 10)
  })

  it("floors whole-number decimals", () => {
    assert.equal(parseQuantity(2.9), 2)
  })

  it("rejects zero, negatives and fractional-to-zero", () => {
    assert.equal(parseQuantity(0), null)
    assert.equal(parseQuantity(-3), null)
    assert.equal(parseQuantity(-1.5), null)
    assert.equal(parseQuantity(0.4), null)
  })

  it("rejects non-numbers and absurd caps", () => {
    assert.equal(parseQuantity("abc"), null)
    assert.equal(parseQuantity(NaN), null)
    assert.equal(parseQuantity(Infinity), null)
    assert.equal(parseQuantity(10001), null)
  })
})
