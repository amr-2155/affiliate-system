export const PHONE_RE = /^01[0125]\d{8}$/

export function cleanPhone(p: string) {
  return (p || "").replace(/[\s\-()]/g, "")
}

export function isValidPhone(p: string) {
  return PHONE_RE.test(cleanPhone(p))
}
