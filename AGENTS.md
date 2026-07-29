# Observer

Discord bot for the MCTraveler Minecraft server. See [README.md](README.md) for setup and how to add
a command. The Minecraft side lives in [conduit](https://github.com/Vaalley/conduit).

## Stack

Deno 2.9 with `discord.js` via the `npm:` specifier. No build step.

- `deno task check` — type check
- `deno fmt` / `deno lint` — must be clean before finishing
- `deno task deploy` — push slash command definitions to Discord
- `deno task start` / `deno task dev` — run the bot

## Conventions

- Tabs, 100-char lines, `strict` + `noUncheckedIndexedAccess` (see `deno.json`).
- Commands live in `src/commands/<name>.ts` and register in the `Record` in `src/commands/mod.ts`.
  The table key must equal the command's `setName(...)`.
- `.env` holds secrets and is gitignored; `deno.lock` is tracked.
- Only request Discord intents and permissions a feature actually needs.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `Vaalley/observer`, via the `gh` CLI. See
`docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage labels, unchanged, all present on the repo. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root, both created lazily. See
`docs/agents/domain.md`.
