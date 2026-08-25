/**
 * Phase 3: in-memory sliding-window rate limiter.
 *
 * Scope note (documented limitation): this is per-process state. It is fully
 * effective for the current single-instance deployment (PM2 runs ONE process).
 * Before ever scaling to multiple instances, move the counter store to a
 * shared backend (Redis) — call sites must not change.
 */

type Bucket = number[]

const buckets = new Map<string, Bucket>()

// Opportunistic global cleanup so long-running processes don't grow forever.
const MAX_BUCKETS = 50_000
let lastSweep = Date.now()

function sweep(now: number, windowMs: number) {
  if (buckets.size <= MAX_BUCKETS || now - lastSweep < 60_000) return
  lastSweep = now
  const cutoff = now - windowMs
  for (const [key, hits] of buckets) {
    const recent = hits.filter((t) => t > cutoff)
    if (recent.length === 0) buckets.delete(key)
    else buckets.set(key, recent)
  }
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

export function hit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now, windowMs)

  const cutoff = now - windowMs
  const recent = (buckets.get(key) ?? []).filter((t) => t > cutoff)

  if (recent.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000))
    return { ok: false, remaining: 0, retryAfterSeconds: retryAfter }
  }

  recent.push(now)
  buckets.set(key, recent)
  return { ok: true, remaining: limit - recent.length, retryAfterSeconds: 0 }
}

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number
  constructor(retryAfterSeconds: number) {
    super(`محاولات كثيرة جدًا — أعد المحاولة بعد ${retryAfterSeconds} ثانية`)
    this.name = "RateLimitError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Throws RateLimitError when the caller exceeded its budget. */
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const result = hit(key, limit, windowMs)
  if (!result.ok) throw new RateLimitError(result.retryAfterSeconds)
}

/** Best-effort client IP extraction behind proxies/tunnels. */
/**
 * Extracts the caller IP from fetch-style Requests AND from NextAuth v4's
 * authorize() context, whose second argument is a plain options object with
 * a record-style `headers` (no .get()). Defensive accessor handles both.
 */
export function clientIp(req: Request): string {
  type HeaderBag = { get(k: string): string | null } | Record<string, string | undefined>
  const h: HeaderBag | undefined = (req as unknown as { headers?: HeaderBag }).headers
  const get = (k: string): string | null | undefined => {
    if (!h) return null
    if ("get" in h && typeof h.get === "function") return h.get(k)
    const rec = h as Record<string, string | undefined>
    return rec[k] ?? rec[k.toLowerCase()]
  }
  const forwarded = get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return get("x-real-ip") || "unknown"
}
