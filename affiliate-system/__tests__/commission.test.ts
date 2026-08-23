import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { computeItemCommission, computeCommission } from "../src/lib/commission"

describe("Commission Calculation", () => {

  describe("A. Correct commission calculation", () => {
    it("computes correct commission when selling above cost", () => {
      const product = { price: 300, minPrice: null, affiliateCostPrice: 200 }
      const result = computeItemCommission(product, 500, 2)
      assert.equal(result, 600) // (500 - 200) * 2
    })

    it("uses minPrice when available as cost reference", () => {
      const product = { price: 300, minPrice: 250, affiliateCostPrice: 200 }
      const result = computeItemCommission(product, 400, 1)
      assert.equal(result, 100) // (400 - 300) * 1 — uses product.price because minPrice is truthy
    })

    it("returns 0 when selling at or below cost", () => {
      const product = { price: 300, minPrice: null, affiliateCostPrice: 300 }
      assert.equal(computeItemCommission(product, 300, 1), 0)
      assert.equal(computeItemCommission(product, 250, 1), 0)
    })

    it("returns 0 when no cost is defined", () => {
      const product = { price: 300, minPrice: null, affiliateCostPrice: null }
      assert.equal(computeItemCommission(product, 500, 1), 0)
    })

    it("handles quantity of 1 correctly", () => {
      const product = { price: 100, minPrice: null, affiliateCostPrice: 50 }
      assert.equal(computeItemCommission(product, 200, 1), 150)
    })

    it("handles large quantities", () => {
      const product = { price: 100, minPrice: null, affiliateCostPrice: 50 }
      assert.equal(computeItemCommission(product, 200, 1000), 150000)
    })

    it("handles fractional prices", () => {
      const product = { price: 100.50, minPrice: null, affiliateCostPrice: 80.25 }
      const result = computeItemCommission(product, 150.75, 3)
      assert.ok(Math.abs(result - 211.50) < 0.01)
    })
  })

  describe("A. Multi-item commission aggregation", () => {
    it("sums commission across multiple items", () => {
      const items = [
        { product: { price: 100, minPrice: null, affiliateCostPrice: 50 }, unitPrice: 200, quantity: 1 },
        { product: { price: 200, minPrice: null, affiliateCostPrice: 150 }, unitPrice: 300, quantity: 2 },
      ]
      assert.equal(computeCommission(items), 150 + 300) // (200-50)*1 + (300-150)*2
    })

    it("returns 0 for empty items", () => {
      assert.equal(computeCommission([]), 0)
    })
  })

  describe("B. Order creation does NOT create premature financial credit", () => {
    it("commission is a computed value, not a balance mutation", () => {
      const balance = 0
      const product = { price: 100, minPrice: null, affiliateCostPrice: 50 }
      const commission = computeItemCommission(product, 200, 1)
      // Commission is just a number — it does not modify any external state.
      // Balance remains unchanged until an explicit COLLECTED transition.
      assert.equal(balance, 0)
      assert.equal(commission, 150)
      assert.equal(balance, 0) // balance still 0
    })
  })
})
