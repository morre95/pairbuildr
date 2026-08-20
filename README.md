# PairBuildr

```
┌─ PairBuildr
└─ build alongside
```

A terminal coding agent. It reads and edits files in your project, runs commands,
talks to language servers, and works through a task with you in a session you can
leave and come back to.

It runs entirely on your machine against providers you configure yourself. There is
no account, no hosted gateway, and no telemetry.

## Install

Requires [Bun](https://bun.com) 1.3 or newer to build from source.

```bash
git clone https://github.com/morre95/pairbuildr.git
cd pairbuildr
bun install
./packages/pairbuildr/script/build.ts --single
```

The binary lands at `packages/pairbuildr/dist/pairbuildr-<platform>/bin/pairbuildr`.
Put it on your `PATH`. It is a single self-contained executable — no runtime needed.

On Linux x64 with Bash, create `pairbuildr` and `pbr` commands that point to the
locally built binary:

```bash
mkdir -p "$HOME/.local/bin"
ln -sfn "$PWD/packages/pairbuildr/dist/pairbuildr-linux-x64/bin/pairbuildr" \
  "$HOME/.local/bin/pairbuildr"
ln -sfn "$HOME/.local/bin/pairbuildr" "$HOME/.local/bin/pbr"

grep -qxF 'export PATH="$HOME/.local/bin:$PATH"' "$HOME/.bashrc" ||
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
source "$HOME/.bashrc"
```

Because these commands are symlinks, rebuilding PairBuildr updates both of them
automatically.

```bash
pairbuildr --version
pbr --version
```

`pbr` is installed as a shorter alias for the same binary.

## Quickstart

Add a provider key first. PairBuildr ships no credentials and cannot reach any model
without one.

```bash
pairbuildr providers          # add an API key, interactively
pairbuildr models             # confirm the provider's models are visible
```

Then start a session in your project:

```bash
cd ~/code/my-project
pairbuildr
```

Other ways in:

```bash
pairbuildr run "add a health check endpoint"   # one prompt, print the result, exit
pairbuildr --continue                          # resume the last session here
pairbuildr session                             # list and pick a past session
pairbuildr serve --port 4096                   # http server, no interface
pairbuildr attach http://localhost:4096        # attach an interface to that server
```

`pairbuildr --help` lists every command; each subcommand takes `--help` too.

## Providers

Bring your own key. Anthropic, OpenAI, Google, Groq, Mistral, OpenRouter, GitHub
Copilot, Bedrock, Vertex, Azure, and any OpenAI-compatible endpoint are supported,
along with local models through an OpenAI-compatible server.

Keys are read from the provider's standard environment variable
(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and so on) or stored by
`pairbuildr providers` under `~/.local/share/pairbuildr/auth.json`.

Pick a model for a run with `-m`:

```bash
pairbuildr -m anthropic/claude-sonnet-4-5
```

## Configuration

Config is JSON, merged from global then project, with the project winning:

| Path | Scope |
| --- | --- |
| `~/.config/pairbuildr/pairbuildr.json` | global |
| `<project>/pairbuildr.json` | project |
| `<project>/.pairbuildr/` | project agents, commands, skills |

`.jsonc` is accepted in both locations if you want comments. Values support
`{env:VAR}` templates, which are resolved at load time and never written back to
disk.

```json
{
  "model": "anthropic/claude-sonnet-4-5",
  "theme": "blueprint",
  "permission": {
    "bash": "ask",
    "edit": "allow"
  }
}
```

Environment variables use the `PAIRBUILDR_` prefix — `PAIRBUILDR_CONFIG`,
`PAIRBUILDR_LOG_LEVEL`, and so on. Run `pairbuildr debug` to inspect what was
actually loaded.

State lives in `~/.local/share/pairbuildr/` (sessions, credentials, logs) and
`~/.cache/pairbuildr/`.

## Agents

An agent is a named prompt plus a tool and permission policy. `build` is the default;
`plan` is read-only. Define your own as markdown with frontmatter, either globally in
`~/.config/pairbuildr/agent/` or per project in `.pairbuildr/agent/`:

```markdown
---
description: reviews changes for correctness, does not edit
mode: subagent
tools:
  edit: false
  write: false
---

Review the diff for logic errors and missing edge cases. Be specific about what
breaks and under what input. Do not comment on style.
```

Then `pairbuildr --agent review`, or let the main agent delegate to it as a subagent.

Project instructions go in `AGENTS.md` at the repo root — the same file other coding
agents read. PairBuildr picks it up automatically, including nested ones as you move
through the tree.

`pairbuildr agent` creates and lists agents.

## Themes

`blueprint` is the default: deep indigo ground, thin rules, amber for the agent's own
output. Switch with `"theme"` in config, or `/theme` in a session. Well-known editor
themes are bundled — tokyonight, catppuccin, gruvbox, nord, dracula, everforest, and
others.

## Extending

- **Plugins** — npm packages that add providers, tools, or auth flows.
  `pairbuildr plugin <module>` installs one and records it in config.
- **MCP servers** — `pairbuildr mcp` manages local and remote
  [Model Context Protocol](https://modelcontextprotocol.io) servers.
- **ACP** — `pairbuildr acp` runs PairBuildr as an Agent Client Protocol server for
  editors that speak it.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and the style guide, and
[AGENTS.md](./AGENTS.md) for the conventions this codebase follows.

## License

MIT. PairBuildr is a fork of opencode; see [NOTICE.md](./NOTICE.md) and
[FORK.md](./FORK.md).
