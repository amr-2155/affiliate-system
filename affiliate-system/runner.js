/**
 * Phase 5 — DEPRECATED.
 *
 * runner.js used to spawn `next dev` (and later build+start) under PM2.
 * The canonical production path is now:
 *
 *   npm run build
 *   pm2 startOrReload ecosystem.config.js
 *
 * This shim fails LOUDLY so stale launchers (old scheduled tasks, old PM2
 * configs) surface immediately instead of silently running the wrong mode.
 */
console.error("==============================================================")
console.error("runner.js is DEPRECATED and intentionally disabled (Phase 5).")
console.error("Use: npm run build && pm2 startOrReload ecosystem.config.js")
console.error("==============================================================")
process.exit(1)
