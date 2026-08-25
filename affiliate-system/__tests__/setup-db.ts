/**
 * Test-database bootstrap (Phase 16).
 *
 * Default: per-suite SQLite files (unchanged legacy behavior).
 * Set TEST_DATABASE_URL (postgresql://...) to run the ENTIRE suite against
 * PostgreSQL staging instead — schema is pushed against the disposable
 * affiliate_staging_test database only, then wiped between suites.
 */
import { execSync } from "child_process"
import { join } from "path"

export function isPgUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith("postgres")
}

interface WipeableClient {
  $queryRawUnsafe(q: string): Promise<unknown>
  $executeRawUnsafe(q: string): Promise<unknown>
  $disconnect(): Promise<void>
}

async function wipeStagingTestDb(
  pgUrl: string,
  PrismaCtor: new (opts: { datasources: { db: { url: string } } }) => WipeableClient,
) {
  if (!/:5433\/affiliate_staging_test/.test(pgUrl)) {
    throw new Error(`Refusing wipe: ${pgUrl} is not the disposable affiliate_staging_test database`)
  }
  const pg = new PrismaCtor({ datasources: { db: { url: pgUrl } } })
  const tables = (await pg.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`,
  )) as { tablename: string }[]
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(", ")
    await pg.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
  }
  await pg.$disconnect()
}

export async function setupTestDatabase(defaultSqliteFile: string): Promise<string> {
  const url = process.env.TEST_DATABASE_URL ?? "file:" + join(__dirname, defaultSqliteFile)
  if (isPgUrl(url)) {
    execSync("npx prisma db push --schema=prisma/schema.postgresql.prisma --skip-generate", {
      cwd: join(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: url, STAGING_DATABASE_URL: url },
      stdio: "pipe",
    })
    const mod = await import("../src/generated/prisma/client")
    await wipeStagingTestDb(url, mod.PrismaClient)
  } else {
    execSync("npx prisma db push --schema=prisma/schema.prisma --skip-generate", {
      cwd: join(__dirname, ".."),
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    })
  }
  return url
}
