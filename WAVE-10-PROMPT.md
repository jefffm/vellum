# Wave 10 — Template Strategies + Server Wiring + Adversarial Review

## Repo & Tooling

- **Repo:** `~/workspace/vellum`, branch `feat/nix-package`, remote `jefffm/vellum`
- **Beads CLI:** `~/workspace/br` (issue tracker — `br list`, `br show`, `br close`)
- **Nix devshell bootstrap** (required before any npm commands):

```bash
mkdir -p /nix 2>/dev/null
curl -L https://nixos.org/nix/install 2>/dev/null | bash -s -- --no-daemon 2>&1
groupadd nixbld 2>/dev/null
mkdir -p /etc/nix
cat > /etc/nix/nix.conf << 'EOF'
build-users-group =
experimental-features = nix-command flakes
sandbox = false
EOF
NIX=$(find /nix/store -maxdepth 1 -name "*-nix-*" -type d | head -1)
mkdir -p ~/bin && ln -sf $NIX/bin/nix ~/bin/nix
export PATH="$HOME/bin:$PATH"
```

Then run everything inside the devshell:

```bash
export PATH="$HOME/bin:$PATH"
cd ~/workspace/vellum && nix develop --command bash -c '<commands here>'
```

- **Validation gate** (must pass before any commit):

```bash
npm run typecheck && npm test && npm run format:check
```

- Current baseline: **500 tests passing across 43 files**. Do not regress.

---

## Phase 1: Extract Template Strategies (beads y0g.1–y0g.5)

The four template strategies currently live inline in `buildLyFile()` in `src/server/lib/engrave.ts` (line ~617) as a `switch` statement. Extract each case into a standalone exported function in a **new file** `src/server/lib/template-strategies.ts`.

### What to extract

Each function receives the resolved data and returns `LyContainer[]` (the score children array). The calling code in `buildLyFile` wraps them with `lyScore()`, header, variables, etc.

**y0g.1 — `buildSoloTab(musicLeaves, vars, params)`**

- Currently: `case "solo-tab"` block
- Returns: `[tabStaff, midiStaff]`

**y0g.2 — `buildFrenchTab(musicLeaves, vars, params)`**

- Currently: `case "french-tab"` block
- Calls `eventsToRhythmLeaves` to generate rhythm staff
- Returns: `[rhythmStaff, tabStaff, midiStaff]`

**y0g.3 — `buildTabAndStaff(musicLeaves, vars, params)`**

- Currently: `case "tab-and-staff"` block
- Returns: `[notationStaff, tabStaff]`

**y0g.4 — `buildVoiceAndTab(musicLeaves, vars, params)`**

- Currently: `case "voice-and-tab"` block
- This one also produces `variables: LyVariable[]` (melody, lyricsText, lute)
- Return type should include both `scoreChildren` and `variables`
- Uses `buildMelodyLeaves`, `buildLyricsContent`, `serializeLeavesInlineArray` — move these helper functions too

**y0g.5 — Dispatch function**

- A `dispatchTemplate(templateId, musicLeaves, vars, params)` function that does the switch + calls the right strategy
- Returns `{ scoreChildren, variables, warnings }`
- Replace the inline switch in `buildLyFile` with a call to `dispatchTemplate`

### Signature guidance

```typescript
// For solo-tab, french-tab, tab-and-staff:
type TemplateResult = {
  scoreChildren: (LyLeaf | LyContainer)[];
  variables?: LyVariable[];
  warnings?: string[];
};

export function buildSoloTab(
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  params: EngraveParams
): TemplateResult;
export function buildFrenchTab(
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  params: EngraveParams
): TemplateResult;
export function buildTabAndStaff(
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  params: EngraveParams
): TemplateResult;
export function buildVoiceAndTab(
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  params: EngraveParams
): TemplateResult;
export function dispatchTemplate(
  templateId: EngraveTemplateId,
  musicLeaves: LyLeaf[],
  vars: InstrumentLyVars,
  params: EngraveParams
): TemplateResult;
```

### Tests

Create `src/server/lib/template-strategies.test.ts`:

- Each strategy gets at least 2 tests: basic correct structure + edge case
- `buildSoloTab`: verify TabStaff + hidden MIDI staff, with correct withBlock
- `buildFrenchTab`: verify RhythmicStaff + TabStaff + MIDI, autoBeamOff present
- `buildTabAndStaff`: verify Staff with treble_8 clef + TabStaff, no MIDI
- `buildVoiceAndTab`: verify variable references (\\melody, \\lyricsText, \\lute), correct structure, lyrics omitted when no lyrics
- `dispatchTemplate`: verify each template ID dispatches correctly + unknown template throws

### After extraction

`buildLyFile` should shrink significantly — it calls `dispatchTemplate`, then assembles the `LyFile` from the result. The private helpers (`buildMelodyLeaves`, `buildLyricsContent`, `serializeLeavesInlineArray`) move to `template-strategies.ts`.

Close beads `vellum-y0g.1` through `vellum-y0g.5` and `vellum-y0g` (parent epic) when done.

---

## Phase 2: Server Wiring (beads ke7.1–ke7.4)

Wire the `engrave()` function to Express and the tool system. Follow the **exact patterns** of existing routes/tools.

### ke7.1 — Express route: `src/server/lib/engrave-route.ts`

Pattern: copy `compile-route.ts` structure.

```typescript
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import {
  EngraveParamsSchema,
  type EngraveParams,
  type EngraveResult,
} from "../../lib/engrave-schema.js";
import { createApiRoute } from "./create-route.js";
import { engrave } from "./engrave.js";

export function createEngraveRoute(): RequestHandler {
  return createApiRoute<EngraveParams, EngraveResult>({
    validate: (body) => Value.Decode(EngraveParamsSchema, body),
    handler: async (params) => engrave(params),
  });
}
```

Note: `engrave()` is synchronous but `handler` expects async — just wrap it (or the existing pattern may already handle sync returns).

Test: `src/server/lib/engrave-route.test.ts` — validate that the route calls engrave and returns results. Mock `engrave` if needed, or do a lightweight integration test with real params.

### ke7.2 — Tool definition in `src/server-tools.ts`

Add `engraveTool` using `createServerTool`:

```typescript
export const engraveTool = createServerTool<typeof EngraveParamsSchema, EngraveResult>({
  name: "engrave",
  label: "Engrave",
  description:
    "Generate valid LilyPond source from structured musical data (positions, pitches, durations). " +
    "Use after tabulate/voicings to produce notation without hand-writing LilyPond syntax. " +
    "Validates all input, resolves pitches, and builds output matching the chosen template.",
  parameters: EngraveParamsSchema,
});
```

### ke7.3 — Mount route in `src/server/index.ts`

Add to `createApiRouter()`:

```typescript
router.post("/engrave", createEngraveRoute());
```

Import `createEngraveRoute` from `./lib/engrave-route.js`.

### ke7.4 — Register in `vellumTools` array in `src/main.ts`

Add `engraveTool` to the `vellumTools` array. Import from `./server-tools.js`.

**Important:** `src/main.test.ts` asserts `vellumTools` has length 10. Update to 11 and add `"engrave"` to the expected names list.

Close beads `vellum-ke7.1` through `vellum-ke7.4` and `vellum-ke7` (parent epic) when done.

---

## Phase 3: Adversarial Review

After phases 1 and 2 pass validation, do a thorough self-review. Read every file you changed. Look for:

1. **Import correctness** — bare module names vs scoped (`"typebox"` should be `"@sinclair/typebox"`)
2. **Circular dependencies** — template-strategies.ts imports from engrave.ts and vice versa?
3. **Dead code** — anything left behind in engrave.ts that should have been removed
4. **Type consistency** — are the return types of extracted functions actually compatible with how buildLyFile uses them?
5. **Test coverage gaps** — any code path not tested?
6. **Variable naming** — consistent with existing codebase style
7. **Serialization correctness** — does `serializeFile` still produce valid LilyPond for all 4 templates?
8. **Edge cases** — voice-and-tab with no lyrics, french-tab with single bar, empty events after validation

Write findings to `WAVE-10-REVIEW.md`. Fix everything you find. Then re-run validation.

---

## Phase 4: Commit & Push

Only after all validation passes and review fixes are applied:

```bash
git add -A
git commit -m "feat(engrave): Wave 10 — template strategy extraction + server wiring"
git push origin HEAD
```

Report: final test count, files changed, beads closed.
