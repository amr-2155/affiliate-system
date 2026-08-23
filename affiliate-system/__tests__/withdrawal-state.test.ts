import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  canTransitionWithdrawal,
  isValidWithdrawalStatus,
} from "../src/lib/withdrawal-state"

describe("Withdrawal state machine (pure)", () => {
  it("allows the happy path PENDING -> APPROVED -> COMPLETED", () => {
    assert.equal(canTransitionWithdrawal("PENDING", "APPROVED"), true)
    assert.equal(canTransitionWithdrawal("APPROVED", "COMPLETED"), true)
  })

  it("allows PENDING -> REJECTED exactly once (terminal)", () => {
    assert.equal(canTransitionWithdrawal("PENDING", "REJECTED"), true)
    // The refund-critical rule:
    assert.equal(canTransitionWithdrawal("REJECTED", "REJECTED"), false)
  })

  it("forbids reopening or re-approving a COMPLETED payout", () => {
    assert.equal(canTransitionWithdrawal("COMPLETED", "APPROVED"), false)
    assert.equal(canTransitionWithdrawal("COMPLETED", "REJECTED"), false)
    assert.equal(canTransitionWithdrawal("COMPLETED", "COMPLETED"), false)
  })

  it("forbids backward moves and same-state updates", () => {
    assert.equal(canTransitionWithdrawal("APPROVED", "PENDING"), false)
    assert.equal(canTransitionWithdrawal("REJECTED", "APPROVED"), false)
    assert.equal(canTransitionWithdrawal("PENDING", "PENDING"), false)
    assert.equal(canTransitionWithdrawal("APPROVED", "APPROVED"), false)
  })

  it("rejects unknown statuses entirely", () => {
    assert.equal(canTransitionWithdrawal("PENDING", "WEIRD"), false)
    assert.equal(canTransitionWithdrawal("WEIRD", "APPROVED"), false)
    assert.equal(isValidWithdrawalStatus("WEIRD"), false)
    assert.equal(isValidWithdrawalStatus(null), false)
    assert.equal(isValidWithdrawalStatus(42), false)
  })
})
