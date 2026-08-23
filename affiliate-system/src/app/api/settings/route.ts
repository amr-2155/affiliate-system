import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Phase 3: PUBLIC settings endpoint.
 *
 * SystemSetting rows include integration secrets (e.g. the n8n HMAC key).
 * This endpoint is unauthenticated, so it may ONLY expose an explicit
 * allowlist of non-sensitive branding keys. Never add integration,
 * payment, or security keys here.
 */
const PUBLIC_PREFIXES = ["brand-", "public-"]

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        OR: PUBLIC_PREFIXES.map((prefix) => ({ key: { startsWith: prefix } })),
      },
    })
    const map: Record<string, string> = {}
    settings.forEach((s) => { map[s.key] = s.value })
    return NextResponse.json(map)
  } catch {
    return NextResponse.json({})
  }
}
