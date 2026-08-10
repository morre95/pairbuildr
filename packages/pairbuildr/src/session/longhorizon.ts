export * as SessionLongHorizon from "./longhorizon"

import path from "path"
import { Effect, Schema } from "effect"
import { FSUtil } from "@pairbuildr/core/fs-util"
import { Global } from "@pairbuildr/core/global"
import type { InstanceContext } from "@/project/instance-context"

// Durable state for a long-horizon run.
//
// Only the longhorizon_* tools write this file. The manager agent is denied `edit`
// outside this directory precisely so it cannot advance its own verified state or
// forge an audit verdict — the completion gate in `longhorizon_done` is only
// meaningful while that stays true.

export const Verdict = Schema.Struct({
  status: Schema.Literals(["complete", "incomplete"]),
  integrity: Schema.Literals(["clean", "suspect"]),
  contract: Schema.Literals(["aligned", "drifted"]),
  evidence: Schema.String,
  blocking: Schema.Array(Schema.String),
})
export type Verdict = Schema.Schema.Type<typeof Verdict>

export const Round = Schema.Struct({
  round: Schema.Number,
  subtask: Schema.String,
  cited: Schema.Array(Schema.Number),
  audit: Verdict,
  time: Schema.Number,
})
export type Round = Schema.Schema.Type<typeof Round>

export const State = Schema.Struct({
  version: Schema.Literal(1),
  task: Schema.String,
  contract: Schema.String.pipe(Schema.optional),
  verified: Schema.String,
  rounds: Schema.Array(Round),
})
export type State = Schema.Schema.Type<typeof State>

export const DEFAULT_MAX_ROUNDS = 30

/** Root directory for a session's run, mirroring how `Session.plan` resolves. */
export function directory(input: { slug: string; time: { created: number } }, instance: InstanceContext) {
  const base = instance.project.vcs
    ? path.join(instance.worktree, ".pairbuildr", "longhorizon")
    : path.join(Global.Path.data, "longhorizon")
  return path.join(base, [input.time.created, input.slug].join("-"))
}

export const statePath = (dir: string) => path.join(dir, "state.json")
export const roundDir = (dir: string, round: number) =>
  path.join(dir, "rounds", "round-" + String(round).padStart(3, "0"))

const decode = Schema.decodeUnknownSync(State)

// The filesystem is passed in rather than yielded: tool `execute` bodies must not carry
// service requirements, so callers resolve FSUtil once when the tool is constructed.
export const read = Effect.fn("SessionLongHorizon.read")(function* (fsys: FSUtil.Interface, dir: string) {
  const text = yield* fsys.readFileStringSafe(statePath(dir))
  if (text === undefined) return undefined
  return decode(JSON.parse(text))
})

export const write = Effect.fn("SessionLongHorizon.write")(function* (
  fsys: FSUtil.Interface,
  dir: string,
  state: State,
) {
  yield* fsys.writeWithDirs(statePath(dir), JSON.stringify(state, null, 2))
  return state
})

/** A run that has not recorded a contract yet cannot execute rounds. */
export const empty = (task: string): State => ({
  version: 1,
  task,
  verified: "Nothing verified yet.",
  rounds: [],
})

export const latest = (state: State) => state.rounds.at(-1)

export type Gate = { ok: true } | { ok: false; reason: string }

/**
 * The completion condition, in one place and pure so it can be proven without a model.
 *
 * All four checks must pass. Three axes mirror the upstream harness, where one clean
 * axis was never sufficient. The fourth — that the verdict belongs to the newest round —
 * closes the hole where an early clean audit could be used to finish a run whose later
 * rounds regressed.
 */
export function gate(state: State | undefined): Gate {
  if (!state) return { ok: false, reason: "no long-horizon run has been started" }
  if (!state.contract) return { ok: false, reason: "no task contract has been recorded" }

  const round = latest(state)
  if (!round) return { ok: false, reason: "no round has been audited yet" }
  if (round.round !== state.rounds.length)
    return { ok: false, reason: `latest verdict is from round ${round.round}, not the current round` }

  const audit = round.audit
  if (audit.blocking.length > 0)
    return { ok: false, reason: `round ${round.round} left ${audit.blocking.length} blocking constraint(s)` }
  if (audit.status !== "complete") return { ok: false, reason: `round ${round.round} audited as incomplete` }
  if (audit.integrity !== "clean") return { ok: false, reason: `round ${round.round} audited as suspect` }
  if (audit.contract !== "aligned") return { ok: false, reason: `round ${round.round} audited as contract-drifted` }

  return { ok: true }
}

/**
 * Belt and braces: an auditor that lists blocking constraints has not seen a complete
 * task, whatever its status field claims. Applied at record time so the stored history
 * is already consistent.
 */
export const reconcile = (verdict: Verdict): Verdict =>
  verdict.blocking.length > 0 && verdict.status === "complete" ? { ...verdict, status: "incomplete" } : verdict

export function describe(verdict: Verdict) {
  const parts = [
    verdict.status === "complete" ? "complete" : "incomplete",
    verdict.integrity === "clean" ? "clean" : "suspect",
    verdict.contract === "aligned" ? "contract-aligned" : "contract-drifted",
  ]
  return parts.join(", ")
}
