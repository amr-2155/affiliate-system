const RUN_INTERVAL_MS = 5 * 60 * 1000
let running = false

async function runJobs() {
  if (running) return
  running = true
  try {
    const [{ autoCancelOrders }, { deliverPendingWebhooks }, { settleAllBonuses }] = await Promise.all([
      import("@/lib/jobs/auto-cancel"),
      import("@/lib/events"),
      import("@/lib/supplier-bonus"),
    ])
    await Promise.allSettled([autoCancelOrders(), deliverPendingWebhooks(50), settleAllBonuses()])
  } catch (e) {
    console.error("[scheduler] job error", e)
  } finally {
    running = false
  }
}

/** يبدأ المجدول (وضع الإنتاج فقط) — يُدار عبر register() في Next.js */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NEXT_PHASE === "phase-production-build") return

  const interval = setInterval(() => {
    runJobs().catch(() => {})
  }, RUN_INTERVAL_MS)
  // تشغيل فوري بعد بدء التشغيل
  setTimeout(() => runJobs().catch(() => {}), 15_000)
  interval.unref?.()
}
