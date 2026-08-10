import { describe, expect, test } from "bun:test"
import { SessionLongHorizon } from "../../src/session/longhorizon"

const verdict = (over: Partial<SessionLongHorizon.Verdict> = {}): SessionLongHorizon.Verdict => ({
  status: "complete",
  integrity: "clean",
  contract: "aligned",
  evidence: "ran the suite, 42 pass",
  blocking: [],
  ...over,
})

const state = (over: Partial<SessionLongHorizon.State> = {}): SessionLongHorizon.State => ({
  version: 1,
  task: "add a health endpoint",
  contract: "GET /health returns 200 and a test covers it",
  verified: "endpoint added",
  rounds: [{ round: 1, subtask: "add the endpoint", cited: [], audit: verdict(), time: 0 }],
  ...over,
})

describe("longhorizon gate", () => {
  test("passes only when every axis is clean", () => {
    expect(SessionLongHorizon.gate(state())).toEqual({ ok: true })
  })

  // The whole point of the mode: a model cannot talk its way past these.
  test("refuses on each failing axis, and says which", () => {
    const cases: [Partial<SessionLongHorizon.Verdict>, string][] = [
      [{ status: "incomplete" }, "incomplete"],
      [{ integrity: "suspect" }, "suspect"],
      [{ contract: "drifted" }, "contract-drifted"],
      [{ blocking: ["tests fail on windows"] }, "blocking constraint"],
    ]
    for (const [over, expected] of cases) {
      const result = SessionLongHorizon.gate(
        state({ rounds: [{ round: 1, subtask: "s", cited: [], audit: verdict(over), time: 0 }] }),
      )
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toContain(expected)
    }
  })

  test("blocking constraints outrank a claimed completion", () => {
    const result = SessionLongHorizon.gate(
      state({
        rounds: [
          { round: 1, subtask: "s", cited: [], audit: verdict({ blocking: ["missing migration"] }), time: 0 },
        ],
      }),
    )
    expect(result.ok).toBe(false)
  })

  test("a stale clean verdict cannot finish a run whose later round regressed", () => {
    const result = SessionLongHorizon.gate(
      state({
        rounds: [
          { round: 1, subtask: "a", cited: [], audit: verdict(), time: 0 },
          // round 2 exists but its record was written as round 1 - a forged or stale verdict
          { round: 1, subtask: "b", cited: [], audit: verdict(), time: 0 },
        ],
      }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain("not the current round")
  })

  test("refuses before a contract or any round exists", () => {
    expect(SessionLongHorizon.gate(undefined).ok).toBe(false)
    expect(SessionLongHorizon.gate(state({ contract: undefined })).ok).toBe(false)
    expect(SessionLongHorizon.gate(state({ rounds: [] })).ok).toBe(false)
  })
})

describe("longhorizon reconcile", () => {
  test("downgrades a complete claim that lists blocking constraints", () => {
    const result = SessionLongHorizon.reconcile(verdict({ blocking: ["flaky test"] }))
    expect(result.status).toBe("incomplete")
  })

  test("leaves an honest verdict alone", () => {
    expect(SessionLongHorizon.reconcile(verdict()).status).toBe("complete")
    expect(SessionLongHorizon.reconcile(verdict({ status: "incomplete" })).status).toBe("incomplete")
  })
})
