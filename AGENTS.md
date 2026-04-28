# Vellum Coding Agent Prompt

## Current Wave: Alfabeto Pipeline Integration (epic vellum-chj)

### Goal

Wire the alfabeto chord lookup library (`src/lib/alfabeto/`) into the MCP tool surface, engrave pipeline, and system prompt. After this wave, baroque guitar arrangements automatically use historically correct alfabeto shapes instead of computed voicings.

### Execution Order

1. `vellum-chj.1` — `alfabeto_lookup` MCP tool (no deps)
2. `vellum-chj.2` — `alfabeto_chord` engrave event type (no deps, but shares concepts with .1)
3. `vellum-chj.3` — System prompt update (depends on .1 and .2 existing)
4. `vellum-chj.4` — Integration tests (depends on .1, .2, .3)

### Beads

Run `br show vellum-chj.1` through `br show vellum-chj.4` for full task descriptions. Summary:

**vellum-chj.1 — `alfabeto_lookup` MCP tool**

- New tool in `src/tools.ts` wrapping `alfabetoLookup()` from `src/lib/alfabeto/index.js`
- Pattern: follow `voicingsTool` — it's the closest analog
- Schema: `chord_name?`, `pitch_classes?`, `chart_id?`, `max_fret?`, `include_barre?` (all snake_case, map to camelCase internally)
- Register in `vellumTools` array in `src/main.ts` (import `alfabetoLookupTool`)
- Tests: "G major" → A first, Foscarini "Eb minor" → M†, invalid → empty

**vellum-chj.2 — `alfabeto_chord` engrave event type**

- New `AlfabetoChordEventSchema` in `src/lib/engrave-schema.ts` — add to `EventSchema` union
- Fields: `type: "alfabeto_chord"`, `chord_name`, `duration`, optional `chart_id`, `prefer`, `tie`
- In `src/server/lib/engrave.ts` validation: call `alfabetoLookup()`, resolve to top match (or `prefer`red letter)
- In codegen (`eventToLeaf`): emit same `lyChord()` as regular chord path using resolved positions
- Only valid on baroque-guitar-5 instrument. Error on anything else.
- Store resolved positions in a `Map<string, TabPosition[]>` keyed by `bar:event` during validation so codegen can read them without re-calling lookup

**vellum-chj.3 — System prompt update**

- `src/prompts.ts`: add `alfabeto_lookup` to `buildTools()`, add `buildBaroqueGuitarWorkflow()` section
- `src/prompts.test.ts`: verify prompt contains "alfabeto_lookup" and "alfabeto_chord"

**vellum-chj.4 — Integration tests**

- G-C-D-Am progression via `alfabeto_chord` events on `baroque-guitar-5`
- Barré fallback: "C# minor" → K barred at 3
- Mixed event types in same bar
- Foscarini chart selection

### Key Architecture Context

**Existing alfabeto library** (already complete, 81 tests passing):

- `src/lib/alfabeto/lookup.ts` — `alfabetoLookup(params)` returns `AlfabetoLookupResult` with ranked `AlfabetoMatch[]`
- `src/lib/alfabeto/types.ts` — `AlfabetoLookupParams`, `AlfabetoMatch`, `AlfabetoLookupResult`
- Match ranking: standard exact → superset → low barré (1-3) → high barré (4-8)
- Each `AlfabetoMatch` has: `letter`, `chord`, `positions: TabPosition[]`, `source`, optional `barreAt`/`baseShape`

**Tool pattern** (`src/tools.ts`):

- Tools are `AgentTool<TSchema, TResult>` objects with `name`, `description`, `parameters`, `execute(params)`
- `execute` returns `toolResult(summary, structuredData)` (imported from somewhere in the codebase)
- Snake_case in tool schemas, camelCase internally

**Engrave pipeline** (`src/server/lib/engrave.ts`):

- Validation phase: iterates bars → events, validates each event type
- Codegen phase: `eventToLeaf()` converts events to `LyLeaf` nodes
- Chord events use `model.soundingPitch(course, fret)` + `scientificToLilyPond()` → `lyChord(pitches, duration, indicators)`

**Registration** (`src/main.ts`):

- `vellumTools` array lists all tools — add `alfabetoLookupTool` after `voicingsTool`
- Import from `src/tools.js`

### Quality Gates

- `npm run typecheck` — zero errors
- `npm test` — all tests pass (currently 632, should grow)
- `npm run format:check` — Prettier clean
- Run all three before committing

### Environment

Nix devshell required:

```bash
export PATH="$HOME/bin:$PATH"
cd ~/workspace/vellum && nix develop --command bash -c 'npm install && npm run typecheck && npm test'
```
