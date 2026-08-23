/**
 * Phase 3: SSRF guard for admin-configured webhook URLs.
 *
 * Blocks webhook targets that could be used to probe the server's own
 * network: loopback (IPv4/IPv6 and *.localhost), link-local incl. cloud
 * metadata (169.254.169.254), RFC1918 private ranges, CGNAT, ULA, and
 * non-http(s) schemes.
 *
 * Known limitation (documented): hostname-based checks cannot see the IP a
 * DNS name resolves to at fetch time (DNS rebinding). Full protection would
 * require resolving + pinning the IP in the fetch call. The current threat
 * model (admin-only configuration, single-tenant box) accepts this residual
 * risk; revisit before exposing webhook creation to non-admin roles.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data",
  "169.254.169.254",
])

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const octets = m.slice(1).map(Number)
  if (octets.some((o) => o > 255)) return true // malformed → reject conservatively
  const [a, b] = octets as [number, number]
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true // link-local / cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  return false
}

function isPrivateIPv6(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === "::" ||
    h === "::1" ||
    h.startsWith("fc") || // ULA fc00::/7
    h.startsWith("fd") ||
    h.startsWith("fe80") // link-local
  )
}

export interface UrlCheck {
  ok: boolean
  error?: string
}

export function assertPublicWebhookUrl(rawUrl: unknown): UrlCheck {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return { ok: false, error: "رابط الـ Webhook مطلوب" }
  }
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return { ok: false, error: "رابط غير صالح" }
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "البروتوكول المسموح هو http/https فقط" }
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, error: "لا يمكن استهداف هذا المضيف" }
  }
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, error: "لا يمكن استهداف مضيفين داخليين" }
  }
  if (isPrivateIPv4(host)) {
    return { ok: false, error: "لا يمكن استهداف عناوين الشبكة الداخلية" }
  }
  if (host.includes(":") && isPrivateIPv6(host)) {
    return { ok: false, error: "لا يمكن استهداف عناوين الشبكة الداخلية" }
  }

  return { ok: true }
}
