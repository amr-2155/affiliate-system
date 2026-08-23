import { prisma } from "@/lib/prisma"
import { canTransitionOrder, TERMINAL_STATUSES } from "@/lib/order-state"
import { emitEvent } from "@/lib/events"
import {
  settleBonusesForOrder,
  revokeBonusesForOrder,
  BONUS_COUNT_STATUSES,
  BONUS_REVOKE_STATUSES,
  BONUS_NON_EARNING_STATUSES,
} from "@/lib/supplier-bonus"
import { INCENTIVE_COUNT_STATUSES } from "@/lib/incentives"
import type { Order } from "@/generated/prisma/client"

/**
 * OrderService — the ONLY place where order status transitions happen.
 *
 * Replaces three divergent copies of this logic (admin PUT, inbound webhook,
 * public API) with one atomic, idempotent implementation.
 *
 * Guarantees:
 * - Transition validity is enforced (canTransitionOrder + terminal lock).
 * - The status flip is gated by a conditional updateMany: under concurrent
 *   requests exactly one wins; losers get 409 instead of corrupting state.
 * - Commission credit (entering COLLECTED) / revoke (leaving COLLECTED)
 *   happens in the SAME transaction as the flip, so it is exactly-once
 *   (C-03 fix). No request can observe the intermediate state.
 * - Supplier bonuses and webhook events are applied after commit, driven by
 *   idempotent primitives (unique keys / conditional deletes).
 */

export class OrderStateError extends Error {
  readonly httpStatus: number
  constructor(message: string, httpStatus = 400) {
    super(message)
    this.name = "OrderStateError"
    this.httpStatus = httpStatus
  }
}

const EVENT_BY_STATUS: Record<string, string> = {
  CONFIRMED: "order.confirmed",
  REJECTED: "order.rejected",
  PROCESSING: "order.processing",
  SHIPPED: "order.shipped",
  DELIVERED: "order.delivered",
  COLLECTED: "order.collected",
  CANCELLED: "order.cancelled",
}

export interface TransitionResult {
  order: Order
  from: string
  to: string
  /** Commission amount credited to the affiliate balance (>0 only when entering COLLECTED). */
  commissionCredited: number
  /** Commission amount taken back from the balance (>0 only when leaving COLLECTED). */
  commissionRevoked: number
}

/** Pre-check for UX; the authoritative check runs again inside the transaction. */
export function validateTransition(from: string, to: string): void {
  if (from === to) return
  if ((TERMINAL_STATUSES as readonly string[]).includes(from)) {
    throw new OrderStateError("الطلب في حالة نهائية ولا يمكن تحديثه")
  }
  if (!canTransitionOrder(from, to)) {
    throw new OrderStateError(`لا يمكن الانتقال من ${from} إلى ${to}`)
  }
}

export async function applyOrderTransition(options: {
  orderId: string
  to: string
  source: string
  /** Admin/confirmer id for attribution on CONFIRMED; null for external sources. */
  actorId?: string | null
  cancelReason?: string
}): Promise<TransitionResult> {
  const { orderId, to, source, actorId, cancelReason } = options

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) throw new OrderStateError("الطلب غير موجود", 404)

    const from = order.status
    if (from === to) {
      return { order, from, to, commissionCredited: 0, commissionRevoked: 0 }
    }
    validateTransition(from, to)

    const data: Record<string, unknown> = { status: to }
    if (to === "DELIVERED") data.deliveredAt = new Date()
    if (to === "COLLECTED") data.collectedAt = new Date()
    if (to === "CANCELLED") {
      data.cancelledAt = new Date()
      data.cancelReason = cancelReason || "إلغاء الطلب"
    }
    if (to === "CONFIRMED" && !order.confirmedAt) {
      data.confirmedAt = new Date()
      data.confirmedById = actorId ?? null
    }

    // Atomic gate — succeeds only if the status is unchanged since we read it.
    const gate = await tx.order.updateMany({
      where: { id: order.id, status: from },
      data,
    })
    if (gate.count !== 1) {
      throw new OrderStateError("تغيّرت حالة الطلب للتو، أعد المحاولة", 409)
    }

    // Phase 2: returning to a terminal state releases reserved stock.
    // Terminal states are final, so this can never run twice for one order.
    if ((TERMINAL_STATUSES as readonly string[]).includes(to)) {
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { productId: true, quantity: true },
      })
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
      }
    }

    // ── Money side effects: exactly-once, same transaction (C-03) ──────────
    let commissionCredited = 0
    let commissionRevoked = 0
    const enteredCollected = to === "COLLECTED" && from !== "COLLECTED"
    const leftCollected = from === "COLLECTED" && to !== "COLLECTED"

    if (enteredCollected || leftCollected) {
      const agg = await tx.commissionLog.aggregate({
        where: { orderId: order.id },
        _sum: { amount: true },
      })
      const commission = agg._sum.amount || 0
      if (commission > 0) {
        if (enteredCollected) {
          await tx.user.update({
            where: { id: order.affiliateId },
            data: {
              balance: { increment: commission },
              totalEarnings: { increment: commission },
            },
          })
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: "PAID" },
          })
          commissionCredited = commission
        } else {
          await tx.user.update({
            where: { id: order.affiliateId },
            data: {
              balance: { decrement: commission },
              totalEarnings: { decrement: commission },
            },
          })
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: "PENDING" },
          })
          commissionRevoked = commission
        }
      }
    }

    const updated = await tx.order.findUnique({ where: { id: order.id } })
    if (!updated) throw new OrderStateError("الطلب غير موجود", 404)
    return { order: updated, from, to, commissionCredited, commissionRevoked }
  })

  // ── Post-commit side effects (idempotent) ────────────────────────────────
  try {
    if ((BONUS_COUNT_STATUSES as readonly string[]).includes(to)) {
      await settleBonusesForOrder(orderId)
    }
    if (
      (BONUS_REVOKE_STATUSES as readonly string[]).includes(to) ||
      (BONUS_NON_EARNING_STATUSES as readonly string[]).includes(to)
    ) {
      await revokeBonusesForOrder(orderId)
    }
  } catch (e) {
    console.error("[order-service] supplier bonus step failed", e)
  }

  const eventName = EVENT_BY_STATUS[to]
  if (eventName && result.from !== to) {
    await emitEvent(
      eventName,
      {
        orderNumber: result.order.orderNumber,
        status: to,
        previousStatus: result.from,
        customerName: result.order.customerName,
        customerPhone: result.order.customerPhone,
        customerCity: result.order.customerCity,
        total: result.order.total,
        currency: result.order.currency,
        trackingNumber: result.order.trackingNumber || null,
        source,
      },
      orderId,
    ).catch((e) => console.error("[order-service] event emit failed", e))
  }

  return result
}

/** True when the order reached a payout-relevant milestone (for incentives). */
export function qualifiesForIncentive(status: string): boolean {
  return (INCENTIVE_COUNT_STATUSES as readonly string[]).includes(status)
}
