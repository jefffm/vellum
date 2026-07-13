# Vellum — Blunder Hunt Round 2

> **Date:** 2026-04-26
> **Scope:** New findings since the pi-mono architecture pivot. Prior findings in [BLUNDER-HUNT.md](./BLUNDER-HUNT.md) are not repeated.
> **Method:** Verified spec claims against pi-mono source code (pi-agent-core types.ts, pi-web-ui artifacts.ts, extensions.md, proxy.ts, README.md, example/src/main.ts). Checked LilyPond docs, nixpkgs, OSMD capabilities.

---

## Critical

### C-R2-1: Spec uses the wrong pi-mono API surface

**Location:** SPEC.md §Architecture, §Custom Tools, §Event Hooks, `src/extension.ts` in file structure

**Problem:** The spec consistently describes Vellum as using the **pi coding-agent extension API** (`pi.registerTool()`, `pi.on("tool_call", ...)`, `pi.on("session_start", ...)`). But Vellum's architecture is a **standalone web app** built on `pi-agent-core` + `pi-web-ui` — not a coding-agent extension.

These are two fundamentally different API surfaces:

| Coding-Agent Extension API                       | Standalone Web App API                                |
| ------------------------------------------------ | ----------------------------------------------------- |
| `pi.registerTool({ name, parameters, execute })` | Create `AgentTool<T>` objects directly                |
| `pi.on("tool_call", handler)`                    | `Agent({ beforeToolCall, afterToolCall })`            |
| `pi.on("session_start", handler)`                | `agent.subscribe(event => ...)`                       |
| `pi.registerCommand("/foo", handler)`            | No equivalent (not a CLI)                             |
| Auto-discovered from `~/.pi/agent/extensions/`   | Passed to `Agent({ initialState: { tools: [...] } })` |

**Evidence:**

- `pi.registerTool()` is defined in `ExtensionAPI` (packages/coding-agent/docs/extensions.md) — only available inside coding-agent extensions.
- `pi-agent-core`'s `Agent` class takes tools via `initialState.tools: AgentTool[]` (packages/agent/src/types.ts).
- `ChatPanel.setAgent()` accepts a `toolsFactory` callback for injecting tools in web apps (packages/web-ui/README.md).
- The spec's `src/extension.ts` file implies a coding-agent extension entry point, but Vellum is a web app with a `main.ts`.

**Fix:** Rewrite all tool registration to use `AgentTool<T>` interfaces directly. Replace `extension.ts` with `tools.ts` or `agent-setup.ts`. Remove all references to `pi.registerTool()` and `pi.on()`. Use `Agent` constructor config for hooks.

---

### C-R2-2: Client-server communication architecture is undefined

**Location:** SPEC.md §Architecture diagram

**Problem:** The architecture diagram shows `pi-agent-core` on the server and `pi-web-ui` in the browser, with HTTPS between them. But `pi-web-ui`'s `ChatPanel` requires a **browser-side `Agent` instance** — it calls `chatPanel.setAgent(agent)` where `agent` is a local object, not a remote proxy.

The spec doesn't explain how the browser-side ChatPanel communicates with server-side tools (LilyPond subprocess, instrument profiles on disk, etc.).

**Evidence:**

- `ChatPanel.setAgent(agent, options)` takes a local `Agent` instance (packages/web-ui/example/src/main.ts).
- pi-agent-core has no built-in server-client transport for the Agent object.
- The `streamProxy` function (packages/agent/src/proxy.ts) proxies **LLM calls** through a server, but tools still execute wherever the Agent runs.

**Actual architecture must be one of:**

1. **Agent in browser, tools call server APIs:** Agent runs in the browser. Tools are thin HTTP clients that call server endpoints (e.g., `fetch('/api/compile', ...)` for LilyPond). LLM calls go through `streamProxy` to keep API keys server-side.
2. **Agent on server, custom event streaming:** Agent runs on the server. A custom WebSocket/SSE layer streams events to a custom browser UI that mimics ChatPanel. This loses most of pi-web-ui's value.

**Fix:** Spec must define the client-server split explicitly. Option 1 is recommended — it preserves pi-web-ui integration, keeps API keys secure via proxy, and cleanly separates tool UI (browser) from tool execution (server).

---

## Significant

### S-R2-1: "Event hooks" don't map to standalone web apps

**Location:** SPEC.md §Event Hooks (auto-compile, error-parser, profile-detect)

**Problem:** The spec describes three hooks using pi coding-agent event syntax:

- "Auto-compile hook" — triggers on `.ly` file write
- "Error parser hook" — intercepts LilyPond stderr
- "Profile auto-injection hook" — detects instrument mentions

The coding-agent extension event API (`pi.on("tool_call", ...)`, `pi.on("input", ...)`) is not available in standalone web apps. The equivalent mechanisms in pi-agent-core are:

| Spec's Hook               | Actual Mechanism                                                  |
| ------------------------- | ----------------------------------------------------------------- |
| Auto-compile on .ly write | `afterToolCall` hook or explicit LLM tool chaining                |
| Error parser              | Logic inside the `compile` tool's `execute()` method              |
| Profile auto-injection    | `transformContext` or system prompt modification before each turn |

**Fix:** Redesign hooks as either (a) logic within tool execute() methods, (b) `beforeToolCall`/`afterToolCall` agent config hooks, (c) `agent.subscribe()` listeners, or (d) prompt template instructions that tell the LLM to call compile after generating .ly content.

---

### S-R2-2: Auto-compile hook has no file system trigger

**Location:** SPEC.md §Event Hooks — Auto-Compile

**Problem:** The spec says "Every time a `.ly` file is written, the hook triggers `compile()`." But in the pi-web-ui architecture:

- The Agent runs in the browser — there's no file system.
- `.ly` content exists in the agent's message history, not as files on disk.
- The `compile` tool's `execute()` function would send content to a server API, which writes a temp file, runs LilyPond, and returns results.

There is no "file write" event to hook into. The auto-compile must be triggered by either:

1. The LLM explicitly calling the compile tool after generating .ly content (prompt instruction)
2. An `afterToolCall` hook that checks if the previous tool produced .ly content

**Fix:** Define auto-compile as a prompt template instruction: "After generating or modifying LilyPond source, always call the compile tool." This is simpler and more reliable than event-based triggering.

---

### S-R2-3: Compile tool can't directly push to ArtifactsPanel

**Location:** SPEC.md §Architecture, §Custom Tools — compile

**Problem:** The spec implies that `compile()` tool results automatically appear in the "tablature workbench" (ArtifactsPanel). But the ArtifactsPanel has its own built-in `artifacts` tool with a specific command protocol (`create`, `update`, `delete` with filename and content). A custom tool's return value doesn't automatically create artifacts in the panel.

**Paths to display SVG in the ArtifactsPanel:**

1. **LLM calls artifacts tool:** After compile returns SVG, the LLM calls the artifacts tool to create/update `tablature.svg`. Requires prompt instruction.
2. **Custom tool renderer:** Register a `registerToolRenderer('compile', ...)` that shows SVG inline in the chat stream (not in the side panel).
3. **Programmatic injection:** The compile tool's server-side logic pushes an ArtifactMessage into the agent's message queue. Requires custom code.

**Fix:** The cleanest v1 approach: (a) Register a custom tool renderer for `compile` that shows SVG preview inline in chat. (b) Have the compile tool return the SVG in its `details` field. (c) For the side panel, have the LLM use the built-in artifacts tool to create/update `tablature.svg` with the compiled output.

---

### S-R2-4: File structure references non-existent pi concepts

**Location:** SPEC.md §File Structure

**Problem:** Multiple file structure elements assume the coding-agent extension model:

- `src/extension.ts` — "Main pi extension: registers tools, hooks" — should be `src/tools.ts` or `src/agent-setup.ts`
- `src/hooks/auto-compile.ts`, `error-parser.ts`, `profile-detect.ts` — these aren't separate hook files in the standalone model; they're logic within the Agent config or tool implementations
- `src/web/app.ts` — described as "pi-web-ui ChatPanel + custom artifact panel" — this is the main entry point, should be `src/main.ts`
- `prompts/` — "pi prompt templates" — pi-agent-core doesn't have a prompt template system; these would be string templates or markdown files loaded by the server

**Fix:** Revise file structure to reflect standalone web app patterns. Merge hooks into tool implementations or agent config. Rename entry points.

---

### S-R2-5: OSMD cannot render tablature — v2 claim is overstated

**Location:** SPEC.md §Browser Stack, §v2 Scope

**Problem:** The spec claims OSMD/VexFlow for "interactive score rendering" in v2 for "guitar/piano." OSMD renders MusicXML, which does support `<staff-details><staff-type>tab</staff-type>`. However:

- OSMD's tablature rendering is limited to standard number-on-lines guitar tab
- No support for French letter tablature
- No support for RhythmicStaff above TabStaff layout
- Custom tunings may not map correctly

For guitar/piano standard notation, OSMD works. For any lute tablature, it does not.

**Fix:** Clarify v2 scope: OSMD for standard notation (guitar, piano, voice). All tablature (including guitar tab) continues to use LilyPond SVG for reliability.

---

### S-R2-6: pi-mono project maturity concern (N-1) needs updating

**Location:** BLUNDER-HUNT.md §N-1

**Problem:** The previous blunder hunt flagged pi-mono as "a young, single-maintainer project" with risk of breaking changes. Current status:

- 40,441 stars, 4,732 forks (as of 2026-04-26)
- Active community PRs (event bus, OAuth, compaction hooks)
- 11 open issues (very healthy ratio)
- Last pushed: April 25, 2026 (yesterday)
- MIT license
- Multiple community contributors visible in PRs

While still primarily maintained by badlogic (Mario Zechner), this is now a mainstream, actively maintained project. The risk profile is significantly lower than initially assessed.

**Fix:** Update N-1 to reflect current project health. Maintain version pinning as standard practice.

---

## Minor

### M-R2-1: Tool return type in spec doesn't match AgentToolResult

**Location:** SPEC.md §Custom Tools — all tool signatures

**Problem:** The spec shows tool return types as plain objects (e.g., `compile() → { success, svg?, pdf?, errors? }`). But `AgentTool.execute()` must return `AgentToolResult<T>`:

```typescript
interface AgentToolResult<T> {
  content: (TextContent | ImageContent)[]; // sent to LLM
  details: T; // for UI rendering
  terminate?: boolean;
}
```

The `content` array is what the LLM sees (text/image). The `details` field carries arbitrary structured data for custom tool renderers.

**Fix:** Rewrite tool signatures to match AgentToolResult. For example, `compile()` returns `content: [{ type: "text", text: "Compiled successfully. 0 errors." }]` for the LLM, with `details: { svg: "...", pdf: "...", midi: "..." }` for the UI renderer.

---

### M-R2-2: No web build pipeline specified

**Location:** SPEC.md §File Structure, §Technology Stack

**Problem:** pi-web-ui is a web component library that needs bundling. The example uses Vite. The spec doesn't mention a build tool (Vite, esbuild, webpack) or how the browser-side code is built and served.

**Fix:** Add Vite to the technology stack. Add `vite.config.ts` to the file structure. The server serves the built browser assets.

---

### M-R2-3: `AgentTool` execute signature has 4 parameters, not just params

**Location:** SPEC.md §Custom Tools

**Problem:** The spec shows `execute(params)` but the actual signature is:

```typescript
execute(toolCallId: string, params: Static<TParameters>, signal?: AbortSignal, onUpdate?: AgentToolUpdateCallback<TDetails>)
```

The `signal` parameter is important for tool cancellation. The `onUpdate` callback enables streaming partial results (e.g., compilation progress).

**Fix:** Update tool implementations to handle the full signature. Particularly, `compile()` should respect `signal` for aborting long LilyPond compilations.

---

### M-R2-4: Nix buildNpmPackage edge cases

**Location:** SPEC.md §NixOS Deployment

**Problem:** While pi-mono packages have no native deps (good), two Nix packaging caveats exist:

1. `pi-web-ui` depends on `xlsx` via a CDN tarball URL (`https://cdn.sheetjs.com/...`) instead of the npm registry. Nix's `fetchNpmDeps` may not handle non-registry tarball URLs cleanly — may need manual patching of the lockfile.
2. If consuming the pi-mono monorepo during build, `@typescript/native-preview` (tsgo) is a pre-built Go binary distributed via npm — may need `autoPatchelfHook` on NixOS.

**Fix:** Vellum depends on published npm packages (not the monorepo), so tsgo isn't an issue. For xlsx, test `buildNpmPackage` early and patch the lockfile if needed.

---

## Omissions

### O-R2-1: No LLM proxy server design

The browser-side Agent needs API keys for LLM calls. Pi-mono provides `streamProxy` (packages/agent/src/proxy.ts) for routing LLM calls through a server. The spec doesn't mention this:

- Server needs a `/api/stream` endpoint
- Auth mechanism for the proxy (mTLS covers transport, but session auth?)
- Which LLM provider(s) the proxy supports

---

### O-R2-2: No server API design for tool backends

If tools run in the browser but execute on the server (C-R2-2), the server needs API endpoints:

- `POST /api/compile` — accepts .ly content, returns SVG/PDF/MIDI
- `POST /api/tabulate` — pitch lookup
- `POST /api/voicings` — chord voicing enumeration
- `POST /api/playability` — passage validation
- etc.

These endpoints, their auth, error handling, and response formats are not specified.

---

### O-R2-3: No session persistence architecture

Pi-web-ui's `SessionsStore` uses IndexedDB (browser-only). If sessions should persist across devices or survive browser data clearing, a server-side session store is needed. The spec mentions "arrangement library with session management" in v2 but doesn't address session persistence for v1.

---

### O-R2-4: Instrument profiles location unclear

The spec shows `instruments/*.yaml` and `instruments/*.ily` files. In the browser-agent architecture:

- YAML profiles need to be accessible to browser-side tool logic (loaded at build time or fetched from server)
- `.ily` files need to be on the server (for LilyPond includes)

The file structure implies both are in the same directory, but they serve different runtimes.

---

## Internal Contradictions

### IC-1: SPEC.md §Architecture vs §Technology Stack

The architecture diagram shows "pi-agent-core" on the server. The technology stack says "Node.js ≥ 20 — runtime for pi-agent-core + Vellum server." But pi-agent-core is a browser-compatible library (no Node.js dependencies — its only deps are pi-ai and typebox). If the Agent runs in the browser (as pi-web-ui requires), pi-agent-core doesn't need Node.js on the server.

### IC-2: SPEC.md §Custom Tools vs AgentToolResult

The compile tool signature shows `svg?: string` as an optional return field. But `AgentToolResult.content` only accepts `TextContent | ImageContent`. SVG as a string would go in `details`, not `content`. If the LLM needs to "see" the SVG, it would need to be either text content (wasteful — SVGs are large) or an ImageContent (would need SVG→PNG conversion).

### IC-3: SPEC.md §v2 Scope vs §Notation & Rendering

"French letter tablature refinement" is listed in v2, but French letter tab is the **native notation for baroque lute** — the primary target instrument. If French tab doesn't work in v1, the baroque lute workflow is incomplete.

---

## Summary

| Severity       | Count | Key themes                                                                        |
| -------------- | ----- | --------------------------------------------------------------------------------- |
| Critical       | 2     | Wrong API surface, undefined client-server communication                          |
| Significant    | 6     | Hook design, artifact display, file structure, OSMD limits, project health update |
| Minor          | 4     | Tool return types, build pipeline, execute signature, Nix edge cases              |
| Omissions      | 4     | LLM proxy, server API, session persistence, profile location                      |
| Contradictions | 3     | Server vs browser runtime, SVG return type, French tab scope                      |

**The spec is architecturally sound in its high-level vision** (LLM for musical intelligence, tools for mechanical correctness, pi-mono for infrastructure). But the implementation details consistently use the wrong pi-mono API surface (coding-agent extensions instead of standalone web app APIs), and the critical client-server communication layer is undefined. These need resolution before implementation begins.
