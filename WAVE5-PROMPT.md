# Wave 5: Theory Endpoints + Browser Fetch Wrappers

## Overview

Two sequential tracks. Track A wires the music21 theory.py subcommands into Express routes. Track B builds browser-side fetch wrapper tools using `createServerTool`. Track B depends on Track A for analyze and lint (compile endpoint already exists from Wave 4).

**Beads:** `8zf.2`, `4fv.3`, `4fv.4`, `4fv.5`

Read each bead before starting: `br show <id>`

---

## Track A: Server Theory Routes — `8zf.2`

Create `src/server/lib/theory-route.ts` with three route factories, then wire them into `src/server/index.ts`.

### Pattern to follow

Look at `src/server/lib/compile-route.ts` — it's the reference implementation. Same structure:
- Factory function returns `RequestHandler`
- Uses `createApiRoute` from `./create-route.js` for validation + envelope
- Uses `SubprocessRunner` from `./subprocess.js` for process management
- Accepts injectable `runner` option for testing
- 30s timeout default

### What to build

Three routes that call `python3 src/server/theory.py <subcommand>` with MusicXML on stdin, parse JSON from stdout:

**POST /api/chordify**
- Input: `{ source: string }` — needs a new `ChordifyParamsSchema` in `types.ts` (just `source: Type.String()`)
- Spawns: `python3 theory.py chordify`, pipes `source` to stdin
- Returns: `ChordAnalysis[]` (schema already exists in types.ts)
- theory.py reads stdin, writes JSON to stdout

**POST /api/analyze**
- Input: `AnalyzeParams` (schema exists — `{ source, format? }`)
- Spawns: `python3 theory.py analyze`, pipes `source` to stdin
- Returns: `AnalysisResult` (schema exists)

**POST /api/lint**
- Input: `LintParams` (schema exists — `{ source, format?, rules? }`)
- Spawns: `python3 theory.py lint`, pipes `source` to stdin
- Returns: `{ violations: LintViolation[] }` (schema exists)

### SubprocessRunner usage for theory.py

The theory.py subprocess is different from LilyPond — it reads from stdin and writes JSON to stdout. It does NOT use temp files or output globs. SubprocessRunner currently uses `inputFile` (writes to disk) and `outputGlobs` (reads files). You have two choices:

1. **Add stdin pipe support to SubprocessRunner** — add an optional `stdin: string` field to `SubprocessRunConfig` that gets piped to the child process's stdin. This is the cleaner approach and keeps the abstraction useful.
2. **Use a simpler spawn wrapper** — if modifying SubprocessRunner is too invasive, create a lightweight `runTheorySubprocess()` helper in theory-route.ts that uses `node:child_process.spawn` directly (NOT `exec` — no shell). Pipe source to stdin, collect stdout/stderr, enforce timeout with AbortController.

Option 1 is preferred. If you go with option 2, still use `spawn` (not `exec`/`execFile`) and handle cleanup properly.

### Error handling

- theory.py writes `{"error": "..."}` to **stderr** on failure and exits non-zero
- Parse stderr JSON on non-zero exit → return structured error via `ApiRouteError`
- Empty stdin → theory.py raises ValueError → should map to 400
- Timeout → SubprocessRunner handles it → should map to 500

### Wiring into index.ts

Add to `createApiRouter()` in `src/server/index.ts`:
```ts
router.post("/chordify", createChordifyRoute());
router.post("/analyze", createAnalyzeRoute());
router.post("/lint", createLintRoute());
```

### Tests — `src/server/lib/theory-route.test.ts`

Mock SubprocessRunner (or the spawn call) to avoid needing music21 in CI:
- POST /api/chordify with source → mock returns valid ChordAnalysis[] JSON → verify response
- POST /api/analyze with source → mock returns valid AnalysisResult JSON → verify response
- POST /api/lint with source → mock returns violations JSON → verify response
- POST with empty body → verify 400
- Mock subprocess error (non-zero exit) → verify 500 with error message
- Mock subprocess timeout → verify 500

Also add tests to `src/server/index.test.ts` for the route registration (verify routes exist).

### Close bead when done
```bash
br close vellum-8zf.2 -r "Theory routes implemented in theory-route.ts, wired into index.ts, tests passing"
```

---

## Track B: Browser Fetch Wrappers — `4fv.3`, `4fv.4`, `4fv.5`

Create `src/server-tools.ts` with three tools built using `createServerTool` from `src/lib/create-server-tool.ts`.

### Pattern

`createServerTool` already handles:
- fetch with JSON body
- AbortSignal
- Error unwrapping from `{ ok, data/error }` envelope
- Calling `toolResult`/`toolError`

You supply: `name`, `description`, `parameters` (TypeBox schema), `endpoint` (URL string), `formatContent` (response → human-readable string for LLM), and optionally `formatDetails`.

### `4fv.3` — compile tool

```ts
export const compileTool = createServerTool<typeof CompileParamsSchema, CompileResult>({
  name: "compile",
  label: "Compile",
  description: "Compile LilyPond source into SVG/PDF notation output.",
  parameters: CompileParamsSchema,
  endpoint: "/api/compile",
  formatContent: (result) => {
    if (result.errors.length > 0) {
      return `Compilation failed with ${result.errors.length} error(s):\n${result.errors.map(e => `  Line ${e.line}: ${e.message}`).join("\n")}`;
    }
    const parts = ["Compiled successfully."];
    if (result.barCount) parts.push(`${result.barCount} bars.`);
    if (result.voiceCount) parts.push(`${result.voiceCount} voices.`);
    parts.push("No errors.");
    return parts.join(" ");
  },
});
```

### `4fv.4` — analyze tool

```ts
export const analyzeTool = createServerTool<typeof AnalyzeParamsSchema, AnalysisResult>({
  name: "analyze",
  label: "Analyze",
  description: "Analyze a MusicXML score — detect key, time signature, voice ranges, and Roman numeral chord progression.",
  parameters: AnalyzeParamsSchema,
  endpoint: "/api/analyze",
  formatContent: (result) => {
    const lines = [
      `Key: ${result.key}`,
      `Time: ${result.timeSignature}`,
    ];
    if (result.voices.length > 0) {
      lines.push(`Voices: ${result.voices.map(v => `${v.name} (${v.lowest}–${v.highest})`).join(", ")}`);
    }
    if (result.chords.length > 0) {
      lines.push("Chord progression:");
      // Group by bar
      const byBar = new Map<number, string[]>();
      for (const c of result.chords) {
        const label = c.romanNumeral ?? c.chord ?? c.pitches.join(",");
        const bar = byBar.get(c.bar) ?? [];
        bar.push(label);
        byBar.set(c.bar, bar);
      }
      for (const [bar, chords] of byBar) {
        lines.push(`  Bar ${bar}: ${chords.join(" | ")}`);
      }
    }
    return lines.join("\n");
  },
});
```

### `4fv.5` — lint tool

```ts
export const lintTool = createServerTool<typeof LintParamsSchema, { violations: LintViolation[] }>({
  name: "lint",
  label: "Lint",
  description: "Check a passage for voice-leading violations: parallel fifths/octaves, voice crossing, spacing, unresolved leading tones.",
  parameters: LintParamsSchema,
  endpoint: "/api/lint",
  formatContent: (result) => {
    if (result.violations.length === 0) {
      return "No voice leading violations found. Passage is clean.";
    }
    const header = `${result.violations.length} violation(s) found:`;
    const items = result.violations.map(v =>
      `  Bar ${v.bar}, beat ${v.beat}: ${v.description} [${v.voices.join(", ")}]`
    );
    return [header, ...items].join("\n");
  },
});
```

### Register in tools array

Update `src/tools.ts` to import and add these to the `tools` export:
```ts
import { analyzeTool, compileTool, lintTool } from "./server-tools.js";

export const tools = [
  tabulateTool, voicingsTool, checkPlayabilityTool, theoryTool,
  compileTool, analyzeTool, lintTool,
];
```

### Tests — `src/server-tools.test.ts`

Use `vi.stubGlobal("fetch", ...)` to mock fetch:
- compile: mock success response → verify content says "Compiled successfully"
- compile: mock error response → verify content says "failed"
- analyze: mock success → verify content includes key name
- lint: mock with violations → verify content lists them
- lint: mock clean → verify "no violations"
- All three: verify AbortSignal is passed to fetch

### Close beads when done
```bash
br close vellum-4fv.3 -r "Compile fetch wrapper using createServerTool, tests passing"
br close vellum-4fv.4 -r "Analyze fetch wrapper using createServerTool, tests passing"
br close vellum-4fv.5 -r "Lint fetch wrapper using createServerTool, tests passing"
```

---

## Checklist before committing

1. `npm run typecheck` passes
2. `npm test` passes (all new + existing tests)
3. `npm run format` applied
4. No bare `typebox` imports — always `@sinclair/typebox`
5. All imports use `.js` extensions
6. All Node builtins use `node:` prefix
7. No `child_process.exec()` — only `spawn`
8. Beads closed: `8zf.2`, `4fv.3`, `4fv.4`, `4fv.5`
9. Do NOT close epics `8zf` or `4fv` — they still have open children

## Do NOT

- Close epic beads (`8zf`, `4fv`, `i3r`, `d0c`) — they have remaining open children
- Add a chordify browser fetch wrapper — there's no bead for it and chordify is only used server-side by the analyze pipeline
- Modify existing Wave 4 files (`src/tools.ts` logic, `src/theory.ts`, `src/server/lib/compile-route.ts`, `src/server/lib/stream-route.ts`) beyond the import additions to `tools.ts`
- Skip tests
