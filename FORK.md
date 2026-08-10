# FORK.md

PairBuildr is a fork of [opencode](https://github.com/anomalyco/opencode) reduced to a
CLI-only distribution and rebranded.

**Forked from:** `941e71dbbb94ea5b32226c2845585992dadb361f`
(`fix(app): use current default model (#38603)`), branch `dev`, upstream version `1.18.16`.

That SHA is the merge base for cherry-picking. Upstream is no longer configured as a
remote; to pull a specific fix:

```bash
git remote add upstream https://github.com/anomalyco/opencode
git fetch upstream
git cherry-pick <sha>
```

Expect conflicts. Every package moved scope, every environment variable changed prefix,
and `packages/opencode` is now `packages/pairbuildr`, so a cherry-pick touching renamed
symbols will need manual fixing. The rename map at the end of this file is the key.

---

## 1. What was removed

### Workspaces (22 of 36)

Reachability was computed from `packages/opencode` through `workspace:*` edges; nothing
below was reachable.

| Group | Packages | Why |
| --- | --- | --- |
| Browser GUI | `app`, `ui`, `session-ui`, `desktop`, `storybook` | Not the terminal experience. `desktop` was an Electron wrapper. |
| Hosted services | `console/{app,core,function,mail,resource,support}`, `stats/{app,core,server}`, `enterprise`, `function` | Account console, billing, telemetry backend, and control planes running on infrastructure we do not own or have credentials for. |
| Non-terminal | `slack`, `web` | A Slack bot and the marketing/docs site. |
| Orphaned | `cli`, `sdk-next`, `client`, `httpapi-codegen` | `cli` was a 705-line prototype shipping a second `lildax` binary with no dependents; the other three were an in-progress SDK rewrite nothing used. |

### Non-workspace directories

`infra/` with `sst.config.ts` and 14 per-package `sst-env.d.ts` stubs, `sdks/vscode`,
`github/` (the hosted GitHub Action), `packages/{containers,docs,identity}`, `nix/` with
`flake.nix`/`flake.lock`, `artifacts/`, `perf/`, `.opencode/`, and 21 localized READMEs.

### CI

12 workflows for GUI, console, docs, nix, vscode, storybook, stats, and Discord, plus 11
upstream repo-governance workflows (issue triage, PR standards, duplicate detection) that
depended on upstream bots, secrets, and a maintainer roster. Three remain: `publish`,
`test`, `typecheck`.

### Dead configuration

31 of 62 dependency-catalog entries, 4 patches for packages no longer in the tree, and
8 root dependencies. `bun.lock` was regenerated from scratch.

## 2. What was inlined

Only one thing genuinely needed inlining.

**Notification sounds.** `packages/tui` prod-depended on `@opencode-ai/ui` — the entire
SolidJS web component library — solely for five `.mp3` files imported by
`src/attention.ts`. Those files now live at `packages/tui/src/assets/audio/`, imported
relatively, and the `declare module` shim was deleted.

A near-miss worth recording: `packages/core/src/oauth/page.ts` had *already* inlined its
design tokens and wordmark SVG from `packages/ui`; only its comments pointed at the dead
package. Those comments now say the file is the sole definition.

## 3. What no longer works

Everything here called a service operated by upstream. None of it is recoverable without
standing up equivalent infrastructure.

| Removed | What you lose |
| --- | --- |
| `opencode web` | The browser UI. It was built from `packages/app`, embedded into the binary at build time, and proxied to `app.opencode.ai` when the embed was absent. The command, its route, `server/shared/ui.ts`, and `OPENCODE_DISABLE_EMBEDDED_WEB_UI` are gone. |
| `opencode account` | Login to the opencode console via device-code OAuth against `console.opencode.ai`. |
| The Zen provider | The hosted `opencode` / `opencode-go` LLM gateway, its device-code auth, its catalog entries, and its `ProviderV2.ID.opencode` constant. |
| Session sharing, by default | `share_url` now has **no default**. Upstream posted to `opncd.ai`. `/share` errors until you configure a host you control. |
| The GitHub agent, by default | `OIDC_BASE_URL` now has **no default**. Upstream used `api.opencode.ai` to look up its GitHub App installation. |
| `curl … | bash` install and upgrade | There is no hosted installer endpoint. Build from source; the curl-upgrade path reads the `install` script from the release repo. |
| Config and theme JSON schemas | `$schema` URLs pointed at `opencode.ai`. Config is no longer rewritten to inject one, and the 30 bundled themes had theirs stripped. Validation was always local; only editor autocomplete is affected. |

### Behavior that changed as a side effect

Removing the Zen provider changed three defaults that were quietly tied to it:

1. **Websearch** was implicitly enabled for the Zen provider. It now requires an explicit
   Exa or Parallel backend for every provider.
2. **Native LLM runtime** accepted any provider ID starting with `opencode`. It now
   accepts `openai` and `anthropic` only.
3. **ACP default model** preferred the Zen provider before falling back to the
   best-sorted model. It now goes straight to the fallback.

Also removed: the "OpenCode Go" subscription upsell — its dialog, animated background,
storage keys, and the two `retry.ts` branches that parsed `FreeUsageLimitError` /
`GoUsageLimitError` from the hosted API. The retry *notice* survives as a
provider-neutral rate-limit message.

### One security fix

`packages/server/src/cors.ts` hardcoded `/^https:\/\/([a-z0-9-]+\.)*opencode\.ai$/` into
the CORS allowlist, letting any `*.opencode.ai` origin make credentialed cross-origin
requests to a user's local server. Removed, along with the Electron/Tauri origins
(`oc://renderer`, `tauri://localhost`) that died with the desktop app.

## 4. Rename map

Every occurrence of `opencode` in the tree was enumerated and assigned to exactly one
bucket: **7,991 occurrences across 1,144 files** — 7,797 renamed, 62 removed, 109
converted to configuration, 23 kept. The buckets were computed mechanically and
reconciled against the raw count before anything was edited.

### Renamed

| Before | After | Notes |
| --- | --- | --- |
| `@opencode-ai/<pkg>` | `@pairbuildr/<pkg>` | 36 workspace names |
| `opencode` (npm) | `pairbuildr` | Upstream published as `opencode-ai`; the `-ai` suffix existed only because the bare name was taken. |
| `opencode` (bin) | `pairbuildr`, alias `pbr` | |
| `OPENCODE_*` | `PAIRBUILDR_*` | 112 variables. **Clean break — the old prefix is read nowhere.** |
| `"@opencode/<Tag>"` | `"@pairbuildr/<Tag>"` | 90 Effect service tags |
| `x-opencode-*` | `x-pairbuildr-*` | 10 HTTP headers, incl. `x-opencode-directory` (instance routing) and `x-opencode-ticket` (PTY auth) |
| `opencode.json` / `.jsonc` | `pairbuildr.json` / `.jsonc` | |
| `.opencode/` | `.pairbuildr/` | project agents, commands, skills |
| `~/.{config,cache,local/share,local/state}/opencode` | `…/pairbuildr` | one constant: `packages/core/src/global.ts` |
| `opencode.db`, `opencode.log` | `pairbuildr.db`, `pairbuildr.log` | |
| `$HOME/.opencode/bin` | `$HOME/.pairbuildr/bin` | |
| `User-Agent: opencode/<v>` | `PairBuildr/<v>` | |
| OpenAPI title `opencode` | `PairBuildr` | |
| `packages/opencode/` | `packages/pairbuildr/` | |
| theme `opencode.json` | `blueprint.json` | now the default theme |

**What this breaks for an existing opencode user:** every environment variable stops
applying, existing `opencode.json` files are not found, sessions and credentials under
the old XDG paths are invisible, and every provider must be re-authenticated. There is
no migration shim — this is deliberate.

### Kept

Third-party npm identifiers that happen to contain `opencode`:
`@gitlab/opencode-gitlab-auth`, `opencode-gitlab-auth`, `opencode-poe-auth`, and the
deprecated-plugin names `opencode-openai-codex-auth` / `opencode-copilot-auth`, which
exist so the loader can warn about them. Also `@opentui/*` (a third-party rendering
library published by sst), `AGENTS.md` (a cross-tool convention), and the LICENSE
attribution.

### Converted to configuration

| Was | Now | Unset behavior |
| --- | --- | --- |
| `https://opncd.ai` | `share_url` in config | Explicit error; no default host |
| `https://api.opencode.ai` | `OIDC_BASE_URL` | Explicit error; no default |
| `https://opencode.ai/{config,theme,tui}.json` | nothing | No `$schema` is emitted or injected |

## 5. Known consequences

- **The plugin ecosystem link is nominal, not shared.** `opencode-gitlab-auth` and
  `opencode-poe-auth` depend on the published `@opencode-ai/plugin`. Before the rename
  our workspace package *was* that name, so bun satisfied their dependency with our code.
  Now npm's copy installs alongside ours and the two `Plugin` types are structurally
  identical but nominally distinct. Both are routed through the loader's existing
  structural guard in `packages/pairbuildr/src/plugin/index.ts`.
- **`<OWNER>/<REPO>` placeholders** remain in `install`, the release lookup, the
  curl-upgrade source, `publish.yml`, and a few help strings. Anything that fetches a
  release will not work until they are replaced.
- **`@pairbuildr/util` does not exist.** The brand sheet names four npm packages; the
  repo currently publishes `sdk`, `plugin`, `script`, and `http-recorder`.
- **The `action` field** of the retry session-status remains in the public schema but no
  code path populates it; its only producers were the removed upsells.
- **`packages/core` gained `@types/mime-types`.** It imports `mime-types` but never
  declared the types, relying on a root hoist that no longer exists. A latent upstream
  bug, fixed at the source.

## 6. Verification

`grep -rni 'opencode\|opncd\.ai\|anomalyco'` over the tree returns hits only in:

- `LICENSE`, `NOTICE.md`, `FORK.md`, and the attribution line in `README.md`
- the KEEP-bucket third-party package names listed above, wherever they appear
  (`packages/pairbuildr/package.json`, `bun.lock`, `bunfig.toml`, the plugin loader
  and its tests, and one doc example)
- `packages/pairbuildr/test/tool/fixtures/models-api.json`, the untouched models.dev
  snapshot, and the README beside it explaining why
- two source comments that record what upstream did before a behavior was removed

Nothing else in the tree names the upstream project.

Summary: binary 160 MB → 125 MB,
install 4,715 → 1,738 packages, tracked files 6,509 → ~2,020, typecheck 13/13, lint 0
errors, and pre-existing test failures down from 4 to 1 — the survivor being a
git-version-dependent worktree test that also fails on unmodified upstream.
