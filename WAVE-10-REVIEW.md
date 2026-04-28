# Wave 10 Adversarial Review

## Scope reviewed

Reviewed the Wave 10 implementation after extraction and server wiring:

- `src/server/lib/template-strategies.ts`
- `src/server/lib/template-strategies.test.ts`
- `src/server/lib/engrave.ts`
- `src/server/lib/engrave-route.ts`
- `src/server/lib/engrave-route.test.ts`
- `src/server-tools.ts`
- `src/server-tools.test.ts`
- `src/server/index.ts`
- `src/server/index.test.ts`
- `src/main.ts`
- `src/main.test.ts`
- `src/tools.ts`
- `test/e2e/agent-conversation.test.ts`

## Findings

1. **Import correctness** — OK. TypeBox imports use `@sinclair/typebox` / `@sinclair/typebox/value`; all local ESM imports include `.js` extensions.
2. **Circular dependencies** — OK. `engrave.ts` imports `dispatchTemplate()` and `buildLeadingIndicators()` from `template-strategies.ts`; `template-strategies.ts` does not import `engrave.ts`.
3. **Dead code** — OK. The inline template switch and private voice-and-tab helpers were removed from `engrave.ts`. Compatibility re-exports remain for existing tests and callers of `buildHiddenMidiStaff`, `buildTabStaffWithBlock`, and `eventsToRhythmLeaves`.
4. **Type consistency** — OK. All strategy functions return `TemplateResult`; `buildLyFile()` consumes `scoreChildren`, optional `variables`, and optional `warnings` consistently.
5. **Test coverage** — OK. Added direct strategy coverage for the four strategies plus dispatch, route coverage for `/api/engrave`, server tool formatting coverage, and index/main tool-registration assertions.
6. **Variable naming/style** — OK. Names follow existing project style (`musicLeaves`, `scoreChildren`, `withBlock`, `templateWarnings`).
7. **Serialization correctness** — OK. Existing full-pipeline engrave tests still cover serialized LilyPond for all four templates. New strategy tests inspect the LyTree shape before serialization.
8. **Edge cases** — OK. Covered french-tab single-bar rest rhythm leaves, solo-tab diapason withBlock, tab-and-staff no MIDI staff, voice-and-tab with no lyrics, and unknown dispatch IDs.

## Fixes made during review

- Added `/api/engrave` to the server index route-registration test.
- Added `engraveTool` to the legacy exported `tools` array in `src/tools.ts` to keep tool aggregation consistent with `vellumTools`.
- Ran repository formatting because `npm run format:check` reported pre-existing formatting failures outside the Wave 10 files; this was required for the mandated validation gate.

## Validation

Final validation command:

```bash
npm run typecheck && npm test && npm run format:check
```

Status: passing after repository formatting.
