import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  canTransitionOrder,
  isAffiliateEditable,
  isTerminalStatus,
  ORDER_FLOW,
  TERMINAL_STATUSES,
  AFFILIATE_EDITABLE_STATUSES,
} from "../src/lib/order-state"

describe("Order State Machine", () => {

  describe("isTerminalStatus", () => {
    it("identifies CANCELLED as terminal", () => assert.equal(isTerminalStatus("CANCELLED"), true))
    it("identifies RETURNED as terminal", () => assert.equal(isTerminalStatus("RETURNED"), true))
    it("identifies REJECTED as terminal", () => assert.equal(isTerminalStatus("REJECTED"), true))
    it("identifies PENDING as non-terminal", () => assert.equal(isTerminalStatus("PENDING"), false))
    it("identifies COLLECTED as non-terminal", () => assert.equal(isTerminalStatus("COLLECTED"), false))
  })

  describe("isAffiliateEditable", () => {
    it("allows editing PENDING orders", () => assert.equal(isAffiliateEditable("PENDING"), true))
    it("allows editing UNDER_REVIEW orders", () => assert.equal(isAffiliateEditable("UNDER_REVIEW"), true))
    it("rejects editing CONFIRMED orders", () => assert.equal(isAffiliateEditable("CONFIRMED"), false))
    it("rejects editing CANCELLED orders", () => assert.equal(isAffiliateEditable("CANCELLED"), false))
    it("rejects editing COLLECTED orders", () => assert.equal(isAffiliateEditable("COLLECTED"), false))
  })

  describe("Valid forward transitions", () => {
    const validTransitions: [string, string][] = [
      ["PENDING", "UNDER_REVIEW"],
      ["UNDER_REVIEW", "CONFIRMED"],
      ["CONFIRMED", "PROCESSING"],
      ["PROCESSING", "SHIPPED"],
      ["SHIPPED", "DELIVERED"],
      ["DELIVERED", "COLLECTED"],
    ]

    for (const [from, to] of validTransitions) {
      it(`${from} → ${to} should be allowed`, () => {
        assert.equal(canTransitionOrder(from, to), true)
      })
    }
  })

  describe("Valid cancellation/rejection/return from any non-terminal state", () => {
    const cancelableStates = ["PENDING", "UNDER_REVIEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "COLLECTED"]

    for (const state of cancelableStates) {
      it(`${state} → CANCELLED should be allowed`, () => {
        assert.equal(canTransitionOrder(state, "CANCELLED"), true)
      })
      it(`${state} → REJECTED should be allowed`, () => {
        assert.equal(canTransitionOrder(state, "REJECTED"), true)
      })
      it(`${state} → RETURNED should be allowed`, () => {
        assert.equal(canTransitionOrder(state, "RETURNED"), true)
      })
    }
  })

  describe("Invalid backward transitions", () => {
    const backwardPairs: [string, string][] = [
      ["UNDER_REVIEW", "PENDING"],
      ["CONFIRMED", "UNDER_REVIEW"],
      ["PROCESSING", "CONFIRMED"],
      ["SHIPPED", "PROCESSING"],
      ["DELIVERED", "SHIPPED"],
      ["COLLECTED", "DELIVERED"],
    ]

    for (const [from, to] of backwardPairs) {
      it(`${from} → ${to} should be rejected`, () => {
        assert.equal(canTransitionOrder(from, to), false)
      })
    }
  })

  describe("Cannot transition out of terminal states", () => {
    for (const terminal of [...TERMINAL_STATUSES]) {
      it(`${terminal} → PENDING should be rejected`, () => {
        assert.equal(canTransitionOrder(terminal, "PENDING"), false)
      })
      it(`${terminal} → COLLECTED should be rejected`, () => {
        assert.equal(canTransitionOrder(terminal, "COLLECTED"), false)
      })
    }
  })

  describe("Same-state transitions are allowed (idempotent)", () => {
    for (const state of [...ORDER_FLOW, ...TERMINAL_STATUSES]) {
      it(`${state} → ${state} should be allowed`, () => {
        assert.equal(canTransitionOrder(state, state), true)
      })
    }
  })

  describe("Unknown status handling", () => {
    it("unknown from-status with valid terminal to-status is allowed", () => {
      assert.equal(canTransitionOrder("UNKNOWN_STATUS", "CANCELLED"), true)
    })
    it("unknown from-status with valid flow to-status is rejected", () => {
      assert.equal(canTransitionOrder("UNKNOWN_STATUS", "CONFIRMED"), false)
    })
    it("valid from-status with unknown to-status is rejected", () => {
      assert.equal(canTransitionOrder("PENDING", "UNKNOWN_STATUS"), false)
    })
  })
})
