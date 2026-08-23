import { describe, it, beforeEach } from "node:test"
import assert from "node:assert/strict"
import { checkRateLimit, RATE_LIMITS } from "../src/lib/rate-limit"

// We need to test with unique keys since the rate limiter is in-memory global state
let keyCounter = 0
function freshKey(prefix = "test"): string {
  return `${prefix}-${++keyCounter}-${Date.now()}`
}

describe("Rate Limiter", () => {

  describe("Basic functionality", () => {
    it("allows first request", () => {
      const result = checkRateLimit(freshKey(), { windowMs: 60000, maxRequests: 5 })
      assert.equal(result.allowed, true)
      assert.equal(result.remaining, 4)
    })

    it("tracks remaining requests", () => {
      const key = freshKey()
      const config = { windowMs: 60000, maxRequests: 3 }
      checkRateLimit(key, config)
      checkRateLimit(key, config)
      const third = checkRateLimit(key, config)
      assert.equal(third.allowed, true)
      assert.equal(third.remaining, 0)
    })

    it("blocks when max exceeded", () => {
      const key = freshKey()
      const config = { windowMs: 60000, maxRequests: 2 }
      checkRateLimit(key, config)
      checkRateLimit(key, config)
      const blocked = checkRateLimit(key, config)
      assert.equal(blocked.allowed, false)
      assert.equal(blocked.remaining, 0)
    })

    it("different keys are independent", () => {
      const config = { windowMs: 60000, maxRequests: 1 }
      const key1 = freshKey()
      const key2 = freshKey()
      checkRateLimit(key1, config)
      const result = checkRateLimit(key2, config)
      assert.equal(result.allowed, true)
    })
  })

  describe("Window expiration", () => {
    it("allows requests after window expires", async () => {
      const key = freshKey()
      const config = { windowMs: 50, maxRequests: 1 }
      checkRateLimit(key, config)
      const blocked = checkRateLimit(key, config)
      assert.equal(blocked.allowed, false)
      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 60))
      const after = checkRateLimit(key, config)
      assert.equal(after.allowed, true)
    })
  })

  describe("Predefined limits", () => {
    it("registration: 5 per 15 minutes", () => {
      const key = freshKey("reg")
      for (let i = 0; i < 5; i++) {
        assert.equal(checkRateLimit(key, RATE_LIMITS.registration).allowed, true)
      }
      assert.equal(checkRateLimit(key, RATE_LIMITS.registration).allowed, false)
    })

    it("withdrawal: 3 per hour", () => {
      const key = freshKey("wd")
      for (let i = 0; i < 3; i++) {
        assert.equal(checkRateLimit(key, RATE_LIMITS.withdrawal).allowed, true)
      }
      assert.equal(checkRateLimit(key, RATE_LIMITS.withdrawal).allowed, false)
    })
  })
})
