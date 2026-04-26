# AGENTS.md — Vellum

LLM-powered music arrangement tool for historical plucked string instruments.
Browser agent + Express server. Renders tablature via LilyPond.

## Quick Reference

```bash
npm install                    # install deps
npm run dev                    # vite dev server (port 5173, proxies /api → 3000)
npm run server:build           # compile server TS → dist-server/
npm run server                 # start Express (port 3000)
npm run build                  # vite production build → dist/
npm run typecheck              # tsc --noEmit (both browser + server)
npm test                       # vitest run
npm run test:watch             # vitest watch mode
```

For full dev: run `npm run server` in one terminal, `npm run dev` in another.
LilyPond and music21 require the Nix dev shell: `nix develop`.

## Architecture

```
Browser (Vite)              Server (Express on :3000)
┌─────────────────┐         ┌──────────────────────────┐
│ pi-web-ui        │ /api/* │ routes → createApiRoute() │
│ ChatPanel        │───────>│ SubprocessRunner          │
│ Agent + Tools    │        │   ├─ LilyPond (compile)   │
│ tonal.js (local) │        │   └─ music21 (analyze)    │
└─────────────────┘         └──────────────────────────┘
```

- **Agent runs in browser** — pi-agent-core Agent instance with 10 custom tools
- **Server is stateless** — receives requests, runs subprocesses, returns results
- **Two theory layers:** tonal.js (browser, instant), music21 (server, MusicXML)

## Project Structure

```
src/
  main.ts              # Browser entry — agent wiring + ChatPanel
  types.ts             # TypeBox schemas + TypeScript types (shared)
  lib/                 # Shared browser code
    pitch.ts           # Pitch math (noteToMidi, transpose, etc.)
    tool-helpers.ts    # toolResult(), toolError(), formatters
    create-server-tool.ts  # Factory: config → AgentTool (fetch wrapper)
    instrument-model.ts    # InstrumentModel class (core domain model)
  server/
    index.ts           # Express app + startup
    profiles.ts        # YAML instrument profile loader
    lib/
      subprocess.ts    # SubprocessRunner (LilyPond + music21)
      create-route.ts  # createApiRoute() factory
instruments/           # YAML instrument profiles
templates/             # LilyPond .ily include files
test/
  lib/                 # Test infrastructure (TestServer, tableTest, fixtures)
  fixtures/            # MusicXML + LilyPond sample files
```

## Spec & Beads

- **Full spec:** `SPEC.md` (~1660 lines) — architecture, tools, instruments, workflows
- **Issue tracker:** `br list`, `br show <id>`, `br ready` (unblocked work)
- **Close beads:** `br close <id> -r "reason"` after completing work
- If closing fails with a dependency error, use `--force`

Read the relevant bead (`br show <id>`) before starting work. Each bead has
acceptance criteria and test specifications. Follow them.

## Code Conventions

- **TypeScript strict mode** — no `any` unless unavoidable
- **TypeBox for all schemas** — dual export: `FooSchema` (TypeBox) + `Foo` (Static type)
- **ESM only** — `type: "module"`, use `.js` extensions in imports
- **Imports:** use `node:` prefix for Node builtins (`node:fs`, `node:path`)
- **Server validation:** TypeBox `Value.Check()` / `Value.Decode()` at API boundaries
- **Error handling:** custom error classes extend `Error` with `.name` set
- **No default exports** except where required by framework (vite.config.ts)
- **Formatting:** run prettier before committing

## Key Abstractions (do not duplicate)

These are factored out specifically to prevent code duplication. Use them.

| Abstraction | File | Purpose |
|---|---|---|
| `createServerTool` | `src/lib/create-server-tool.ts` | Browser tool factory — config → AgentTool with fetch |
| `toolResult` / `toolError` | `src/lib/tool-helpers.ts` | Uniform tool result builders |
| `SubprocessRunner` | `src/server/lib/subprocess.ts` | Temp files + spawn + timeout + cleanup |
| `createApiRoute` | `src/server/lib/create-route.ts` | Express route factory with validation |
| `InstrumentModel` | `src/lib/instrument-model.ts` | Core domain model — wraps profile, provides pitch↔position |
| `TestHarness` | `test/lib/` | TestServer + tableTest() + fixture loader |

When adding a new tool or endpoint, check if these already handle your boilerplate.

## Testing

- **Runner:** vitest
- **Pattern:** table-driven tests via `tableTest()` from `test/lib/table-test.ts`
- **Server tests:** use `TestServer` from `test/lib/test-server.ts` (starts Express, provides .post/.get)
- **Fixtures:** `test/fixtures/` — MusicXML and LilyPond sample files
- Write tests alongside implementation. Every bead specifies its test cases.

## Instruments

7 profiles defined in `instruments/*.yaml`. Two built (v1 priority):
- `baroque-lute-13` — 13-course d-minor tuning, French letter tab, 8 frets, 7 diapason courses
- `baroque-guitar-5` — 5-course re-entrant tuning, 3 stringing variants, French letter tab

Key domain concepts:
- **Course** ≠ string (a course may be double-strung)
- **Diapason** = unfretted bass course (open pitch only)
- **Re-entrant tuning** = course pitched higher than its neighbor (baroque guitar courses 4-5)
- **French letter tablature** = letters a-n map to frets 0-8, one column per course

## Common Pitfalls

- `www.liftosaur.com` not `api.liftosaur.com` — but that's a different project
- **Don't use `child_process.exec()`** — use `spawn()` (no shell injection). SubprocessRunner handles this.
- **Don't hardcode instrument data** — always go through InstrumentModel / profile YAML
- **Don't put LLM API keys in browser code** — keys stay server-side, browser uses proxy
- **Imports use `.js` extension** — `from "../types.js"` not `from "../types"`
- **LilyPond outputs go to temp dirs** — always clean up. SubprocessRunner handles this.
- **tonal.js is browser-only, music21 is server-only** — don't cross the boundary
