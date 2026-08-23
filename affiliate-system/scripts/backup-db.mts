/**
 * Phase 4: online SQLite backup.
 *
 * Uses `VACUUM INTO` which produces a compact, consistent snapshot WITHOUT
 * blocking the running server (safe to run while Next.js is live).
 *
 * Usage:  npm run db:backup             -> default retention (14)
 *         node scripts/backup-db.mjs 7  -> custom retention count
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { mkdirSync, readdirSync, statSync, unlinkSync } from "fs"
import { join, resolve } from "path"

const RETENTION = Math.max(1, parseInt(process.argv[2] || "14", 10) || 14)

function dbFilePath(): string {
  const raw = (process.env.DATABASE_URL || "file:./prisma/dev.db").replace(/^file:/, "")
  return resolve(raw)
}

async function main() {
  const dbFile = dbFilePath()
  if (!dbFile.toLowerCase().endsWith(".db")) {
    throw new Error(`Refusing to back up unexpected file: ${dbFile}`)
  }

  const dir = resolve("backups")
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const target = join(dir, `affiliate-${stamp}.db`)

  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
    const size = statSync(target).size
    console.log(`[backup] OK ${target} (${(size / 1024).toFixed(0)} KB)`)
  } finally {
    await prisma.$disconnect()
  }

  const files = readdirSync(dir)
    .filter((f) => f.startsWith("affiliate-") && f.endsWith(".db"))
    .sort()
    .reverse()
  for (const old of files.slice(RETENTION)) {
    unlinkSync(join(dir, old))
    console.log(`[backup] pruned ${old}`)
  }
}

main().catch((e) => {
  console.error("[backup] FAILED:", e instanceof Error ? e.message : e)
  process.exitCode = 1
})
