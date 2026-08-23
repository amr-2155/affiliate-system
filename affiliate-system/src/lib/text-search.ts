/**
 * PostgreSQL compatibility helpers (Phase 15).
 *
 * Search case-sensitivity: SQLite's `LIKE`/Prisma `contains` is effectively
 * case-insensitive for ASCII; PostgreSQL's `LIKE` is case-sensitive.
 * `textMatch()` keeps today's behavior on SQLite and opts into Prisma's
 * `mode: "insensitive"` (ILIKE) when running against PostgreSQL.
 *
 * Arabic text is unaffected either way (no case mapping), preserving Arabic
 * search behavior on both databases.
 */

export type TextMatch = { contains: string; mode?: "insensitive" }

function isSqliteUrl(url: string | undefined): boolean {
  const u = (url || "").trim().toLowerCase()
  if (!u) return true // default matches the project's current datasource
  return u.startsWith("file:")
}

/** Case-insensitive substring matcher usable in Prisma `where` filters. */
export function textMatch(value: string): TextMatch {
  if (isSqliteUrl(process.env.DATABASE_URL)) {
    return { contains: value }
  }
  return { contains: value, mode: "insensitive" }
}
