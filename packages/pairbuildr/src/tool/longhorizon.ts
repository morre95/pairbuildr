import path from "path"
import { Effect, Schema } from "effect"
import { FSUtil } from "@pairbuildr/core/fs-util"
import * as Tool from "./tool"
import { Agent } from "@/agent/agent"
import { deriveSubagentSessionPermission } from "@/agent/subagent-permissions"
import { InstanceState } from "@/effect/instance-state"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { MessageID, SessionID } from "../session/schema"
import { Session } from "@/session/session"
import { SessionLongHorizon } from "@/session/longhorizon"
import { SessionSummary } from "@/session/summary"
import type { TaskPromptOps } from "./task"
import CONTRACT_DESCRIPTION from "./longhorizon-contract.txt"
import ROUND_DESCRIPTION from "./longhorizon-round.txt"
import AUDIT_DESCRIPTION from "./longhorizon-audit-report.txt"
import DONE_DESCRIPTION from "./longhorizon-done.txt"
import EXECUTOR_BRIEF from "./longhorizon-executor-brief.txt"
import AUDITOR_BRIEF from "./longhorizon-auditor-brief.txt"

// Verdicts travel from the auditor subagent back to the round tool through this map,
// keyed by the auditor's session id. It is deliberately not the state file: the auditor
// must not be able to write run state, only to report on it.
type VerdictState = { pending: Map<string, SessionLongHorizon.Verdict> }

const verdicts = InstanceState.make<VerdictState>(() => Effect.succeed({ pending: new Map() }))

const runDirectory = (sessions: Session.Interface) =>
  Effect.fn("LongHorizon.runDirectory")(function* (sessionID: SessionID) {
    const instance = yield* InstanceState.context
    const info = yield* sessions.get(sessionID)
    return SessionLongHorizon.directory(info, instance)
  })

export const ContractParameters = Schema.Struct({
  contract: Schema.String.annotate({
    description:
      "The acceptance criteria for the whole task: the conditions under which it is finished, written so someone who has not read this conversation could check them.",
  }),
  amend_reason: Schema.String.pipe(Schema.optional).annotate({
    description: "Required when a contract already exists. Why the original criteria were wrong.",
  }),
})

export const LongHorizonContractTool = Tool.define(
  "longhorizon_contract",
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const fsys = yield* FSUtil.Service
    const dirFor = runDirectory(sessions)

    return {
      description: CONTRACT_DESCRIPTION,
      parameters: ContractParameters,
      execute: (params: Schema.Schema.Type<typeof ContractParameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const dir = yield* dirFor(ctx.sessionID)
          const info = yield* sessions.get(ctx.sessionID)
          const existing = yield* SessionLongHorizon.read(fsys, dir)

          if (existing?.contract && !params.amend_reason)
            return yield* Effect.fail(
              new Error(
                "A contract already exists. Amending it requires amend_reason - the criteria are meant to be stable.",
              ),
            )

          // Amendments append with a stamp; the original text is never overwritten, so
          // drift is visible in the file rather than silently applied.
          const contract = existing?.contract
            ? [existing.contract, "", `### Amended at round ${existing.rounds.length}`, params.amend_reason, "", params.contract].join("\n")
            : params.contract

          const base = existing ?? SessionLongHorizon.empty(info.title ?? "long-horizon run")
          yield* SessionLongHorizon.write(fsys, dir, { ...base, contract })

          return {
            title: existing?.contract ? "Contract amended" : "Contract recorded",
            output: `Contract recorded at ${SessionLongHorizon.statePath(dir)}. Run rounds with longhorizon_round.`,
            metadata: {},
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export const RoundParameters = Schema.Struct({
  subtask: Schema.String.annotate({
    description: "One coherent unit of work for this round. If you cannot state it in a sentence, it is too big.",
  }),
  cite_rounds: Schema.Array(Schema.Number).pipe(Schema.optional).annotate({
    description: "Round numbers whose audit reports the executor needs. It sees nothing you do not cite.",
  }),
  audit_focus: Schema.String.pipe(Schema.optional).annotate({
    description: "Optional steer for the auditor about what to scrutinise hardest.",
  }),
})

const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll("${" + key + "}", () => value), template)

function isTaskPromptOps(value: unknown): value is TaskPromptOps {
  return (
    typeof value === "object" &&
    value !== null &&
    "cancel" in value &&
    typeof value.cancel === "function" &&
    "resolvePromptParts" in value &&
    typeof value.resolvePromptParts === "function" &&
    "prompt" in value &&
    typeof value.prompt === "function"
  )
}

export const LongHorizonRoundTool = Tool.define(
  "longhorizon_round",
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const agents = yield* Agent.Service
    const flags = yield* RuntimeFlags.Service
    const summary = yield* SessionSummary.Service
    const fsys = yield* FSUtil.Service
    const state = yield* verdicts
    const dirFor = runDirectory(sessions)

    return {
      description: ROUND_DESCRIPTION,
      parameters: RoundParameters,
      execute: (params: Schema.Schema.Type<typeof RoundParameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const ops = ctx.extra?.promptOps
          if (!isTaskPromptOps(ops))
            return yield* Effect.fail(new Error("longhorizon_round requires promptOps in ctx.extra"))

          const dir = yield* dirFor(ctx.sessionID)
          const run = yield* SessionLongHorizon.read(fsys, dir)
          if (!run)
            return yield* Effect.fail(new Error("No long-horizon run has been started. Call longhorizon_contract."))
          if (!run.contract)
            return yield* Effect.fail(new Error("Set the task contract with longhorizon_contract before running rounds."))

          const maxRounds = flags.longhorizonMaxRounds ?? SessionLongHorizon.DEFAULT_MAX_ROUNDS
          if (run.rounds.length >= maxRounds)
            return yield* Effect.fail(
              new Error(`Round budget exhausted (${maxRounds}). Report what remains rather than continuing.`),
            )

          const round = run.rounds.length + 1
          const cited = params.cite_rounds ?? []
          const citedText =
            cited
              .map((n) => run.rounds.find((item) => item.round === n))
              .filter((item) => item !== undefined)
              .map((item) => `#### Audit of round ${item.round}\n${item.audit.evidence}`)
              .join("\n\n") || "None cited."

          // Blocking constraints are re-attached from the last audit unconditionally, so
          // the manager cannot drop one by rephrasing the verified state.
          const previous = SessionLongHorizon.latest(run)
          const blocking = previous?.audit.blocking ?? []

          const parent = yield* sessions.get(ctx.sessionID)
          const spawn = Effect.fn("LongHorizon.spawn")(function* (agentName: string, prompt: string, title: string) {
            const next = yield* agents.get(agentName)
            if (!next) return yield* Effect.fail(new Error(`Missing built-in agent: ${agentName}`))
            const child = yield* sessions.create({
              parentID: ctx.sessionID,
              title,
              agent: next.name,
              permission: deriveSubagentSessionPermission({
                parentSessionPermission: parent.permission ?? [],
                subagent: next,
              }),
            })
            const parts = yield* ops.resolvePromptParts(prompt)
            const result = yield* ops.prompt({
              messageID: MessageID.ascending(),
              sessionID: child.id,
              agent: next.name,
              parts,
            })
            return {
              id: child.id,
              text: result.parts.findLast((item) => item.type === "text")?.text ?? "",
            }
          })

          yield* ctx.metadata({ title: `round ${round} · executing` })
          const executor = yield* spawn(
            "longhorizon-executor",
            fill(EXECUTOR_BRIEF, {
              task: run.task,
              contract: run.contract,
              verified: run.verified,
              blocking: blocking.length ? blocking.map((item) => `- ${item}`).join("\n") : "None.",
              subtask: params.subtask,
              cited: citedText,
            }),
            `round ${round} executor`,
          )

          // Evidence the executor cannot misreport: the real file diff, reconstructed
          // from its session's snapshots rather than from its own prose.
          const executorMessages = yield* sessions.messages({ sessionID: executor.id }).pipe(Effect.orElseSucceed(() => []))
          const diffs = yield* summary.computeDiff({ messages: executorMessages }).pipe(Effect.orElseSucceed(() => []))
          const manifest = diffs.length
            ? diffs.map((item) => `- ${item.file} (+${item.additions}/-${item.deletions})`).join("\n")
            : "No file changes were recorded for this round."

          yield* ctx.metadata({ title: `round ${round} · auditing` })
          const auditor = yield* spawn(
            "longhorizon-auditor",
            fill(AUDITOR_BRIEF, {
              task: run.task,
              contract: run.contract,
              verified: run.verified,
              subtask: params.subtask,
              claims: executor.text,
              manifest,
              focus: params.audit_focus ?? "Nothing specific - audit against the contract.",
            }),
            `round ${round} auditor`,
          )

          const holder = yield* InstanceState.get(state)
          const reported = holder.pending.get(auditor.id)
          holder.pending.delete(auditor.id)

          // Fail closed. An auditor that produced no structured verdict has not audited.
          const audit = SessionLongHorizon.reconcile(
            reported ?? {
              status: "incomplete",
              integrity: "suspect",
              contract: "drifted",
              evidence: "The auditor ended its turn without calling longhorizon_audit_report.",
              blocking: ["No audit verdict was produced for this round."],
            },
          )

          const record = { round, subtask: params.subtask, cited, audit, time: Date.now() }
          // Verified state only advances on a clean audit - this is the durable-state rule,
          // enforced here rather than requested in a prompt.
          const verified = audit.integrity === "clean" ? [run.verified, `Round ${round}: ${audit.evidence}`].join("\n") : run.verified
          yield* SessionLongHorizon.write(fsys, dir, { ...run, verified, rounds: [...run.rounds, record] })

          const artifacts = SessionLongHorizon.roundDir(dir, round)
          yield* fsys.writeWithDirs(path.join(artifacts, "executor-output.md"), executor.text)
          yield* fsys.writeWithDirs(path.join(artifacts, "audit-report.md"), auditor.text)

          return {
            title: `Round ${round}: ${SessionLongHorizon.describe(audit)}`,
            output: [
              `Round ${round} of ${maxRounds}. Audit: ${SessionLongHorizon.describe(audit)}.`,
              "",
              "Evidence:",
              audit.evidence,
              "",
              audit.blocking.length ? "Blocking constraints:\n" + audit.blocking.map((item) => `- ${item}`).join("\n") : "No blocking constraints.",
              "",
              "Files changed:",
              manifest,
              "",
              audit.integrity === "clean"
                ? "Verified state advanced."
                : "Verified state did NOT advance - the audit was not clean.",
            ].join("\n"),
            metadata: {},
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export const AuditParameters = Schema.Struct({
  status: Schema.Literals(["complete", "incomplete"]).annotate({
    description: "Whether the CONTRACT is satisfied - not whether the subtask was attempted.",
  }),
  integrity: Schema.Literals(["clean", "suspect"]).annotate({
    description: "clean when the executor's claims match the evidence you checked yourself.",
  }),
  contract: Schema.Literals(["aligned", "drifted"]).annotate({
    description: "aligned when the work still serves the original acceptance criteria.",
  }),
  evidence: Schema.String.annotate({
    description: "What you actually checked and what you observed. Not a summary of the executor's report.",
  }),
  blocking: Schema.Array(Schema.String).annotate({
    description: "Specific, actionable constraints. A next executor with no context must be able to act on each.",
  }),
})

export const LongHorizonAuditReportTool = Tool.define(
  "longhorizon_audit_report",
  Effect.gen(function* () {
    const state = yield* verdicts

    return {
      description: AUDIT_DESCRIPTION,
      parameters: AuditParameters,
      execute: (params: Schema.Schema.Type<typeof AuditParameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const holder = yield* InstanceState.get(state)
          const verdict = SessionLongHorizon.reconcile({
            status: params.status,
            integrity: params.integrity,
            contract: params.contract,
            evidence: params.evidence,
            blocking: params.blocking,
          })
          holder.pending.set(ctx.sessionID, verdict)
          return {
            title: `Audit: ${SessionLongHorizon.describe(verdict)}`,
            output: `Verdict recorded: ${SessionLongHorizon.describe(verdict)}. Your turn is done.`,
            metadata: {},
          }
        }).pipe(Effect.orDie),
    }
  }),
)

export const DoneParameters = Schema.Struct({
  summary: Schema.String.annotate({ description: "What was accomplished, for the user." }),
})

export const LongHorizonDoneTool = Tool.define(
  "longhorizon_done",
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const fsys = yield* FSUtil.Service
    const dirFor = runDirectory(sessions)

    return {
      description: DONE_DESCRIPTION,
      parameters: DoneParameters,
      execute: (params: Schema.Schema.Type<typeof DoneParameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const dir = yield* dirFor(ctx.sessionID)
          const run = yield* SessionLongHorizon.read(fsys, dir)
          const verdict = SessionLongHorizon.gate(run)

          // The gate refuses in code. This is the one guarantee the mode exists to make.
          if (!verdict.ok)
            return yield* Effect.fail(
              new Error(
                `Cannot finish: ${verdict.reason}. Run another round, or ask the user if you are blocked.`,
              ),
            )

          return {
            title: "Long-horizon run complete",
            output: [`Completion accepted after ${run?.rounds.length ?? 0} round(s).`, "", params.summary].join("\n"),
            metadata: {},
          }
        }).pipe(Effect.orDie),
    }
  }),
)
