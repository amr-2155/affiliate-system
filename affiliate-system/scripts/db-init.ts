/**
 * Phase 4: SQLite production hardening.
 *
 * Run once (npm run db:init):
 *  - journal_mode=WAL  → persistent in the DB file; readers no longer block
 *    the writer and vice-versa (the main concurrency pain reported in prod).
 *  - synchronous=NORMAL → safe with WAL, much faster than FULL.
 *
 * Note: busy_timeout is per-connection and cannot be set through the Prisma
 * URL; Prisma serializes its small pool internally which achieves the same
 * effect for our single-instance deployment.
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"

const prisma = new PrismaClient()

async function main() {
  const mode = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>("PRAGMA journal_mode=WAL")
  await prisma.$executeRawUnsafe("PRAGMA synchronous=NORMAL")
  const integrity = await prisma.$queryRawUnsafe<Array<{ integrity_check: string }>>("PRAGMA quick_check")

  console.log("[db:init] journal_mode =", mode[0]?.journal_mode)
  console.log("[db:init] quick_check  =", integrity[0]?.integrity_check)
  if (mode[0]?.journal_mode?.toLowerCase() !== "wal") {
    throw new Error("Failed to enable WAL mode")
  }
  console.log("[db:init] OK — database is WAL-hardened")
}

main()
  .catch((e) => {
    console.error("[db:init] FAILED:", e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())