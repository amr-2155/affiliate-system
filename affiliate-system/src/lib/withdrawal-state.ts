/**
 * C-02 fix: withdrawal status machine.
 *
 * Allowed transitions (everything else is forbidden):
 *
 *   PENDING -> APPROVED -> COMPLETED
 *   PENDING -> REJECTED
 *
 * REJECTED and COMPLETED are terminal. Same-state updates are rejected so a
 * REJECTED withdrawal can never be refunded twice, and a COMPLETED payout can
 * never be reopened or re-approved.
 */

export const WITHDRAWAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "COMPLETED"] as const

export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number]

export const WITHDRAWAL_TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
}

export function isValidWithdrawalStatus(status: unknown): status is WithdrawalStatus {
  return (
    typeof status === "string" &&
    (WITHDRAWAL_STATUSES as readonly string[]).includes(status)
  )
}

/** Strict: rejects unknown statuses, same-state updates, and backward moves. */
export function canTransitionWithdrawal(from: string, to: string): boolean {
  if (!isValidWithdrawalStatus(from) || !isValidWithdrawalStatus(to)) return false
  if (from === to) return false
  return WITHDRAWAL_TRANSITIONS[from].includes(to)
}
