/**
 * Raw-query value normalization (Phase 15).
 *
 * SQLite raw queries return DateTime columns as epoch-millisecond numbers,
 * while PostgreSQL raw queries return JS Date objects. COUNT() on PostgreSQL
 * arrives as BigInt. These helpers normalize both shapes so the API layer is
 * database-agnostic.
 */

/** Normalize an epoch-ms number | JS Date | ISO string into an ISO string. */
export function rawDateToIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString()
  }
  if (typeof value === "number" || typeof value === "bigint") {
    const n = Number(value)
    if (!Number.isFinite(n)) return null
    const d = new Date(n)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  const parsed = new Date(String(value))
  return isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** Coerce raw aggregate scalars (number | bigint | string | null) to number. */
export function rawNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
