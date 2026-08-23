/**
 * Simple in-memory rate limiter (sliding window counter).
 * For production, replace with Redis-backed limiter.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Cleanup stale entries every 5 minutes.
// unref'd so the timer never keeps a process (e.g. test runner) alive on its own.
const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}, 5 * 60 * 1000) as unknown as { unref?: () => void }
cleanupTimer.unref?.()

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowMs
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt }
  }

  entry.count++
  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

/** Predefined rate limits for common use cases. */
export const RATE_LIMITS = {
  /** Registration: 5 attempts per 15 minutes per IP */
  registration: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
  /** Order creation: 20 orders per hour per user */
  orderCreate: { windowMs: 60 * 60 * 1000, maxRequests: 20 },
  /** Withdrawal: 3 requests per hour per user */
  withdrawal: { windowMs: 60 * 60 * 1000, maxRequests: 3 },
  /** Inbound webhooks: 60 requests per minute per IP */
  webhook: { windowMs: 60 * 1000, maxRequests: 60 },
  /** Admin actions: 100 requests per minute per admin */
  admin: { windowMs: 60 * 1000, maxRequests: 100 },
} as const
