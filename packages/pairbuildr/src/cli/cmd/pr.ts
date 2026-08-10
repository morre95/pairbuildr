import { Effect } from "effect"
import { UI } from "../ui"
import { effectCmd, fail } from "../effect-cmd"
import { Git } from "@/git"
import { InstanceRef } from "@/effect/instance-ref"
import { Process } from "@/util/process"
import { Config } from "@/config/config"

export const PrCommand = effectCmd({
  command: "pr <number>",
  describe: "check out a github pull request and start a session",
  builder: (yargs) =>
    yargs.positional("number", {
      type: "number",
      describe: "pull request number to check out",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.pr")(function* (args) {
    const ctx = yield* InstanceRef
    if (!ctx) return yield* fail("Could not load instance context")
    if (ctx.project.vcs !== "git") {
      return yield* fail("Could not find git repository. Please run this command from a git repository.")
    }

    const git = yield* Git.Service
    const worktree = ctx.worktree

    const prNumber = args.number
    const localBranchName = `pr/${prNumber}`
    UI.println(`Fetching and checking out PR #${prNumber}...`)

    const checkout = yield* Effect.promise(() =>
      Process.run(["gh", "pr", "checkout", `${prNumber}`, "--branch", localBranchName, "--force"], { nothrow: true }),
    )
    if (checkout.code !== 0) {
      return yield* fail(`Failed to checkout PR #${prNumber}. Make sure you have gh CLI installed and authenticated.`)
    }

    const prInfoResult = yield* Effect.promise(() =>
      Process.text(
        [
          "gh",
          "pr",
          "view",
          `${prNumber}`,
          "--json",
          "headRepository,headRepositoryOwner,isCrossRepository,headRefName,body",
        ],
        { nothrow: true },
      ),
    )

    let sessionId: string | undefined

    if (prInfoResult.code === 0 && prInfoResult.text.trim()) {
      const prInfo = JSON.parse(prInfoResult.text)

      if (prInfo?.isCrossRepository && prInfo.headRepository && prInfo.headRepositoryOwner) {
        const forkOwner = prInfo.headRepositoryOwner.login
        const forkName = prInfo.headRepository.name
        const remoteName = forkOwner

        const remotes = (yield* git.run(["remote"], { cwd: worktree })).text().trim()
        if (!remotes.split("\n").includes(remoteName)) {
          yield* git.run(["remote", "add", remoteName, `https://github.com/${forkOwner}/${forkName}.git`], {
            cwd: worktree,
          })
          UI.println(`Added fork remote: ${remoteName}`)
        }

        yield* git.run(["branch", `--set-upstream-to=${remoteName}/${prInfo.headRefName}`, localBranchName], {
          cwd: worktree,
        })
      }

      if (prInfo?.body) {
        // Session links point at whatever share host the user configured. There is no
        // default host, so with share_url unset there is nothing to recognize here.
        const cfg = yield* Config.Service
        const shareHost = (yield* cfg.get()).share_url
        const sessionMatch = shareHost
          ? prInfo.body.match(new RegExp(`${shareHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/s/([a-zA-Z0-9_-]+)`))
          : null
        if (sessionMatch) {
          const sessionUrl = sessionMatch[0]
          UI.println(`Found pairbuildr session: ${sessionUrl}`)
          UI.println(`Importing session...`)

          const importResult = yield* Effect.promise(() =>
            Process.text(["pairbuildr", "import", sessionUrl], { nothrow: true }),
          )
          if (importResult.code === 0) {
            const sessionIdMatch = importResult.text.trim().match(/Imported session: ([a-zA-Z0-9_-]+)/)
            if (sessionIdMatch) {
              sessionId = sessionIdMatch[1]
              UI.println(`Session imported: ${sessionId}`)
            }
          }
        }
      }
    }

    UI.println(`Successfully checked out PR #${prNumber} as branch '${localBranchName}'`)
    UI.println()
    UI.println("Starting pairbuildr...")
    UI.println()

    const pairbuildrArgs = sessionId ? ["-s", sessionId] : []
    const code = yield* Effect.promise(
      () =>
        Process.spawn(["pairbuildr", ...pairbuildrArgs], {
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
          cwd: process.cwd(),
        }).exited,
    )
    // Match legacy throw semantics — propagate as a defect so the top-level
    // index.ts catch handles it identically (exit 1, "Unexpected error" banner).
    if (code !== 0) return yield* Effect.die(new Error(`pairbuildr exited with code ${code}`))
  }),
})
