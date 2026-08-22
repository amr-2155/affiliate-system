import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import { parsePermissions } from "@/lib/permissions"

/** توليد مفتاح سري جديد مع بادئة ظاهرة */
export function generateApiKey(name: string): { key: string; prefix: string; hash: string } {
  const rand = crypto.randomBytes(24).toString("base64url")
  const prefix = `aff_${name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "key"}`
  const key = `${prefix}_${rand}`
  return { key, prefix, hash: hashApiKey(key) }
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex")
}

/** استخراج المفتاح من رأس X-API-Key أو Bearer token */
export function extractApiKey(req: Request): string | null {
  const header = req.headers.get("x-api-key") || ""
  if (header) return header.trim()
  const auth = req.headers.get("authorization") || ""
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim()
  return null
}

/**
 * مصادقة عبر مفتاح API:
 * 1. استخراج المفتاح، 2. تجزئته والبحث في DB، 3. فحص enabled/revoked،
 * 4. تحديث lastUsedAt، 5. فحص الصلاحية المطلوبة (إن وُجدت).
 */
export async function authenticateApiKey(req: Request, requiredPermission?: string): Promise<{ ok: true; apiKey: { id: string; name: string; permissions: string[] } } | { ok: false; error: string; status: number }> {
  const key = extractApiKey(req)
  if (!key) return { ok: false, error: "API key مفقود", status: 401 }

  const hash = hashApiKey(key)
  const record = await prisma.apiKey.findUnique({ where: { keyHash: hash } })
  if (!record) return { ok: false, error: "API key غير صالح", status: 401 }
  if (!record.enabled || record.revokedAt) return { ok: false, error: "API key معطّل", status: 403 }

  const permissions = parsePermissions(record.permissions)
  if (requiredPermission && !permissions.includes(requiredPermission)) {
    return { ok: false, error: "API key لا يملك هذه الصلاحية", status: 403 }
  }

  prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {})

  return { ok: true, apiKey: { id: record.id, name: record.name, permissions } }
}

export async function apiKeyScopes(): Promise<Record<string, string[]>> {
  return {
    orders: ["orders.read", "orders.update"],
  }
}
