/**
 * Application timezone helpers (Phase 15).
 *
 * TIMEZONE CONTRACT: this application has always computed day/month/year
 * boundaries using **Africa/Cairo local time** (the deployment server runs in
 * Cairo time, so `new Date(y, m, d)` produced Cairo midnights).
 *
 * These helpers make that assumption explicit and host-independent: they
 * compute real Africa/Cairo calendar boundaries via Intl (DST-safe), so
 * results are IDENTICAL to the previous behavior on a Cairo-time server while
 * staying correct if the app is later deployed on a UTC host (e.g. next to
 * PostgreSQL). Displayed business dates are not changed.
 */

export const APP_TIME_ZONE = "Africa/Cairo"

interface ZonedParts {
  year: number
  month: number // 1-12
  day: number
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

function zonedParts(date: Date): ZonedParts {
  const map: Record<string, string> = {}
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  }
}

/** Offset (ms) to add to a UTC instant to obtain wall-clock time in the zone. */
function zoneOffsetMs(instant: Date): number {
  const p = zonedParts(instant)
  // hour/minute/second are irrelevant for date boundaries; use full offset for precision
  const fullFmt = partsFormatter.formatToParts(instant)
  const t: Record<string, number> = { hour: 0, minute: 0, second: 0 }
  for (const part of fullFmt) {
    if (part.type === "hour" || part.type === "minute" || part.type === "second") {
      t[part.type] = Number(part.value)
    }
  }
  const asUTCFull = Date.UTC(p.year, p.month - 1, p.day, t.hour % 24, t.minute, t.second)
  return asUTCFull - instant.getTime()
}

/** Resolve a zone-local civil datetime to its exact UTC instant (DST-safe, two-pass).
 *  Both passes re-anchor from the original civil time so the correction never compounds. */
function fromZonedParts(year: number, month: number, day: number): Date {
  const asUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
  let guess = new Date(asUTC)
  guess = new Date(asUTC - zoneOffsetMs(guess))
  guess = new Date(asUTC - zoneOffsetMs(guess))
  return guess
}

/** Start of the Cairo calendar day containing `date`. */
export function zonedStartOfDay(date: Date): Date {
  const p = zonedParts(date)
  return fromZonedParts(p.year, p.month, p.day)
}

/** Start of the Cairo calendar month containing `date`. */
export function zonedStartOfMonth(date: Date): Date {
  const p = zonedParts(date)
  return fromZonedParts(p.year, p.month, 1)
}

/** Start of the Cairo calendar year containing `date`. */
export function zonedStartOfYear(date: Date): Date {
  const p = zonedParts(date)
  return fromZonedParts(p.year, 1, 1)
}

/** `YYYY-MM-DD` key of the Cairo calendar day containing `date`. */
export function zonedDateKey(date: Date): string {
  const p = zonedParts(date)
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

/** Start (Cairo midnight) of the Monday-based week containing `date`. */
export function zonedWeekStart(date: Date): Date {
  const p = zonedParts(date)
  const dow = (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7
  return fromZonedParts(p.year, p.month, p.day - dow)
}

/** Shift a zoned-start instant by N days, keeping boundary semantics. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000)
}

/** Civil calendar parts (Cairo) of the day containing `date`. */
export function zonedCivilParts(date: Date): ZonedParts {
  return zonedParts(date)
}

/** `YYYY-MM` key of the Cairo calendar month containing `date`. */
export function zonedMonthKey(date: Date): string {
  const p = zonedParts(date)
  return `${p.year}-${String(p.month).padStart(2, "0")}`
}

/** Month-key `YYYY-MM` shifted by `offsetMonths` from the month of `date`. */
export function zonedMonthKeyOffset(date: Date, offsetMonths: number): string {
  const p = zonedParts(date)
  const total = p.year * 12 + (p.month - 1) + offsetMonths
  const y = Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12 + 1
  return `${y}-${String(m).padStart(2, "0")}`
}

/** Start (Cairo midnight) of the month shifted by `offsetMonths` from `date`. */
export function zonedStartOfRelativeMonth(date: Date, offsetMonths: number): Date {
  const p = zonedParts(date)
  const total = p.year * 12 + (p.month - 1) + offsetMonths
  const y = Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12 + 1
  return fromZonedParts(y, m, 1)
}
