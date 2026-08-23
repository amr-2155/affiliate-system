import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * Phase 5: liveness/readiness probe for PM2 / uptime monitors.
 * Reports database connectivity without exposing any internals
 * (no error messages, no stack traces).
 */
export async function GET() {
  let database: "up" | "down" = "down"
  try {
    await prisma.$queryRaw`SELECT 1`
    database = "up"
  } catch {
    database = "down"
  }

  return NextResponse.json(
    {
      status: database === "up" ? "ok" : "degraded",
      database,
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  )
}
