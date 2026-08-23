/**
 * Phase 5: one-shot health probe.
 * Exit 0 = healthy. After 3 consecutive failures recorded in
 * .healthcheck-failures, restarts the app through PM2.
 */
import { writeFileSync, readFileSync, existsSync } from "fs"
import { resolve } from "path"

const URL = process.env.HEALTHCHECK_URL || "http://localhost:3000/api/health"
const FAIL_FILE = resolve(".healthcheck-failures")

let failures = 0
try {
  if (existsSync(FAIL_FILE)) failures = parseInt(readFileSync(FAIL_FILE, "utf8").trim() || "0", 10) || 0
} catch {}

let ok = false
try {
  const res = await fetch(URL, { signal: AbortSignal.timeout(5000) })
  if (res.ok) {
    const body = await res.json().catch(() => ({}))
    ok = body.status === "ok"
  }
} catch {}

if (ok) {
  if (failures > 0) console.log(`[healthcheck] recovered after ${failures} failure(s)`)
  writeFileSync(FAIL_FILE, "0")
  process.exit(0)
}

failures += 1
writeFileSync(FAIL_FILE, String(failures))
console.error(`[healthcheck] FAIL #${failures}`)

if (failures >= 3) {
  console.error("[healthcheck] restarting affiliate-system via PM2")
  writeFileSync(FAIL_FILE, "0")
  const { execSync } = await import("child_process")
  try {
    execSync("npx pm2 restart affiliate-system", { stdio: "inherit" })
  } catch (e) {
    console.error("[healthcheck] pm2 restart failed:", e?.message)
    process.exit(1)
  }
}
process.exit(1)
