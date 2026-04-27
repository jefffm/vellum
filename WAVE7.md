# Wave 7 — Testable Instrument Tools + Template Tests + Validate Endpoint

## Scope

5 beads, all fully testable without a browser. No DOM, no web components, no running server for integration testing (except mock-based Vitest).

| # | Bead | Title | Type |
|---|------|-------|------|
| 1 | kyq.4 | Template compilation test suite | Integration test (real LilyPond) |
| 2 | i3r.4 | Transpose tool | Browser-side AgentTool |
| 3 | i3r.5 | Diapasons tool | Browser-side AgentTool |
| 4 | i3r.6 | Fretboard SVG tool | Browser-side AgentTool |
| 5 | gwf.3 | POST /api/validate | Server route |

After this wave the tool count goes from 7 → 10 (transpose, diapasons, fretboard added to the `tools` array in `src/tools.ts`). The system prompt in `src/prompts.ts` is updated to mention all 10 tools. The validate endpoint is wired into the Express router.

---

## Environment Setup

Bootstrap Nix first (required every session — nothing persists):

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

Then run all commands via the dev shell:

```bash
cd ~/workspace/vellum && nix develop --command bash -c 'npm install && npm run typecheck && npm test'
```

**Gate:** All existing tests must pass before AND after your changes. Run `npm run typecheck && npm test` frequently.

---

## Bead 1: kyq.4 — Template Compilation Test Suite

**File:** `test/templates.test.ts`

This is an integration test that runs real LilyPond against every template. It must run inside the Nix shell (LilyPond is available there).

### What to build

A Vitest test file that:

1. Discovers every `.ly` file in `templates/`.
2. For each template, compiles it with LilyPond and verifies the output.
3. For `french-tab.ly` specifically, adds deeper assertions about French letter notation.

### Implementation

```typescript
// test/templates.test.ts
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TEMPLATES_DIR = path.resolve(process.cwd(), "templates");
const INSTRUMENTS_DIR = path.resolve(process.cwd(), "instruments");
```

For each template file:
1. Read the `.ly` source
2. Write it to a temp dir
3. Run `lilypond --svg -I <instruments_dir> -I <templates_dir> -o output source.ly` via `execSync`
4. Assert exit code 0
5. Assert `output.svg` exists and is non-empty
6. Assert SVG contains `<svg` tag

For `french-tab.ly` specifically (it uses `\include "../instruments/baroque-lute-13.ily"` with a relative path):
- The include path is relative, so the temp dir approach needs to handle this. Best approach: copy the template to the temp dir AND resolve includes. OR: run LilyPond with the working directory set to `templates/` and use `-I` flags for `instruments/`.
- Actually, the simplest approach: run LilyPond directly against the file in-place using `-o /tmp/vellum-test-output/templatename` and pass `-I instruments/ -I templates/`. This avoids the relative-path issue entirely.

**Approach:** For each template, run LilyPond with the project root as working directory:

```bash
lilypond --svg -I instruments -I templates -o /tmp/vellum-test/<template-stem> templates/<template>.ly
```

**french-tab.ly specific assertions:**
- The `.ily` file defines `luteTabFormat = #fret-letter-tablature-format`, so LilyPond should produce French letter tab output.
- Check that the SVG output contains text elements. The exact letters depend on LilyPond's rendering, but the SVG should contain `<text` elements.
- Check that a MIDI file was also produced (the template has a `\midi` block).

### Test cases

```
describe("template compilation", () => {
  // Get all .ly files from templates/
  const templates = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith(".ly"));

  for (const template of templates) {
    it(`compiles ${template} to SVG without errors`, () => { ... });
    it(`${template} produces non-empty SVG`, () => { ... });
  }

  describe("french-tab.ly", () => {
    it("produces MIDI output", () => { ... });
    it("SVG contains text elements (tab letters)", () => { ... });
  });
});
```

### Acceptance criteria

- [ ] Every `.ly` template compiles without LilyPond errors
- [ ] SVG output is valid (contains `<svg` opening tag)
- [ ] french-tab.ly produces MIDI output
- [ ] french-tab.ly SVG contains `<text` elements (the letter notation)
- [ ] Tests pass inside `nix develop --command bash -c 'npm test'`

### Notes

- The vitest config already includes `test/**/*.test.ts` in its glob pattern.
- LilyPond is only available inside the Nix shell. The test should skip gracefully (or be marked as integration) if LilyPond isn't found — but since we always run tests inside nix develop, this isn't strictly necessary. Use a simple check: `which lilypond` at the top, skip all tests if not found.
- Use `execSync` for simplicity — these are synchronous integration tests.
- Clean up temp files in an `afterAll` hook.

---

## Bead 2: i3r.4 — Transpose Tool

**Files:**
- `src/transpose.ts` — pure logic
- `src/transpose.test.ts` — unit tests
- Update `src/tools.ts` — add `transposeTool` to exports and `tools` array
- Update `src/prompts.ts` — mention transpose in `buildTools()`

### What to build

A browser-side `AgentTool` that transposes LilyPond pitch names by a named interval, validates against instrument range, and suggests idiomatic keys.

### Types

The schema already exists in `src/types.ts`:

```typescript
export const TransposeParamsSchema = Type.Object({
  source: Type.String({ minLength: 1 }),     // Space-separated LilyPond pitches, e.g. "c' e' g'"
  interval: Type.String({ minLength: 1 }),    // Named interval, e.g. "P5", "m3", "-M2"
  instrument: InstrumentId,
});
```

### Result type

```typescript
type TransposeResult = {
  original: string[];
  transposed: string[];
  outOfRange: string[];         // pitches that fell outside instrument range
  suggestedKeys: string[];      // idiomatic keys for this instrument
};
```

### Algorithm

1. **Parse source pitches:** Split `source` on whitespace. Each token is a note name in scientific pitch notation (e.g., `C4`, `Eb3`, `F#5`). Use `tonal`'s `Note.transpose(note, interval)` — it handles named intervals like `P5`, `M3`, `m2`, etc.

2. **Transpose:** For each pitch, call `Note.transpose(pitch, interval)`. The `tonal` library handles this natively.

3. **Range check:** Load the instrument profile via `loadBrowserProfile(instrument)`. Check each transposed pitch's MIDI number against `profile.range.lowest` and `profile.range.highest` using `noteToMidi()` from `src/lib/pitch.ts`.

4. **Idiomatic keys:** Return a hardcoded table based on instrument ID:

```typescript
const IDIOMATIC_KEYS: Record<string, string[]> = {
  "baroque-lute-13": ["D minor", "A minor", "F major", "G minor", "C major"],
  "baroque-guitar-5": ["A minor", "E minor", "C major", "G major", "D minor"],
  "renaissance-lute-6": ["G major", "D minor", "C major", "A minor"],
  "theorbo-14": ["D minor", "G minor", "A minor"],
  "classical-guitar-6": ["E minor", "A minor", "D major", "G major", "C major"],
};
```

5. **Format content:** Human-readable summary: "Transposed 5 pitches up P5. 0 out of range. Idiomatic keys for baroque-lute-13: D minor, A minor, ..."

### Tool definition

```typescript
export const transposeTool: AgentTool<typeof TransposeParamsSchema, TransposeResult> = {
  name: "transpose",
  label: "Transpose",
  description:
    "Transpose a set of pitches by a named interval, check against instrument range, and suggest idiomatic keys.",
  parameters: TransposeParamsSchema,
  execute: async (_toolCallId, params) =>
    instrumentTool(params.instrument, (model) => {
      // ... implementation
    }),
};
```

Use the existing `instrumentTool()` helper pattern from `src/tools.ts` (it wraps the loadBrowserProfile + error handling). Since `instrumentTool` is currently a private function, you'll need to either:
- Make it a shared export (move to `src/lib/tool-helpers.ts`), OR
- Duplicate the pattern in the new tool file.

**Preferred approach:** Extract `instrumentTool` from `src/tools.ts` into `src/lib/tool-helpers.ts` so all tool files can use it. Update `src/tools.ts` to import it from there.

### Tests (src/transpose.test.ts)

```
- Transpose C4 up P5 → G4
- Transpose ["C4", "E4", "G4"] up m3 → ["Eb4", "Gb4", "Bb4"]
- Transpose with out-of-range result → outOfRange array populated
- Unknown instrument → error result (not throw)
- Idiomatic keys for baroque-lute-13 includes "D minor"
- Idiomatic keys for unknown instrument → empty array
- Empty source string → error
```

### prompts.ts update

Add to the `buildTools()` function:
```
"- Call `transpose` to transpose pitches by interval — validates range and suggests idiomatic keys",
```

---

## Bead 3: i3r.5 — Diapasons Tool

**Files:**
- `src/diapasons.ts` — pure logic
- `src/diapasons.test.ts` — unit tests
- Update `src/tools.ts` — add `diapasonsTool`
- Update `src/prompts.ts` — mention diapasons in `buildTools()`

### What to build

A browser-side `AgentTool` that looks up bass string (diapason) tuning for a given key from the instrument profile's `diapason_schemes`.

### Types

Schema already exists:

```typescript
export const DiapasonsParamsSchema = Type.Object({
  key: Type.String({ minLength: 1 }),
  instrument: Type.Optional(Type.String({ default: "baroque-lute-13" })),
});
```

### Result type

```typescript
type DiapasonCourse = {
  course: number;
  pitch: string;      // Note name, e.g. "Eb"
};

type DiapasonsResult = {
  key: string;
  schemeName: string;                      // e.g. "d_minor"
  courses: DiapasonCourse[];
  lilypondSyntax: string;                  // e.g. "\\stringTuning <g, f, ees, d, c, bes,, a,,>"
  warning?: string;                         // if key didn't match exactly
};
```

### Algorithm

1. **Resolve instrument:** Default to `baroque-lute-13` if not provided. Load profile.

2. **Match key to scheme:** The profile's `diapason_schemes` uses keys like `d_minor`, `a_minor`, etc. The tool input is a human-readable key name like "D minor", "A minor", "D major". Normalize the input:
   - Strip whitespace, lowercase
   - Map common formats: "D minor" → "d_minor", "d minor" → "d_minor", "Dm" → "d_minor", "d-minor" → "d_minor"
   - Try exact match first, then fuzzy

3. **No diapason schemes:** If the instrument has no `diapason_schemes` (e.g., baroque guitar has none), return an error: "Instrument baroque-guitar-5 has no diapason schemes."

4. **Unknown key:** If the key doesn't match any scheme, return the closest match with a warning. Use simple heuristic: match on the root note (e.g., "D" matches "d_minor" and "d_major" — prefer minor if ambiguous since d-minor is the default accord).

5. **Build courses array:** The `diapason_schemes` value is an array of pitch names `["G", "F", "Eb", "D", "C", "Bb", "A"]` corresponding to courses 7→13. Map to `DiapasonCourse[]`.

6. **Build LilyPond syntax:** Convert each pitch to LilyPond format. The `.ily` file uses `\stringTuning <g, f, ees, d, c, bes,, a,,>`. The conversion needs:
   - Pitch name → LilyPond note name (Eb → ees, Bb → bes, F# → fis, C# → cis, etc.)
   - Octave designation: courses 7-11 are in octave 2 (`,` suffix), courses 12-13 are in octave 1 (`,,` suffix). But this depends on the specific pitch — look at the existing `.ily` file for reference:
     - Course 7: g, (G2) → `g,`
     - Course 8: f, (F2) → `f,`
     - Course 9: ees, (Eb2) → `ees,`
     - Course 10: d, (D2) → `d,`
     - Course 11: c, (C2) → `c,`
     - Course 12: bes,, (Bb1) → `bes,,`
     - Course 13: a,, (A1) → `a,,`
   - Pattern: courses 7-11 get one comma (octave 2), courses 12-13 get two commas (octave 1). BUT this is only true for the standard diatonic descent. If a scheme changes a pitch, the octave depends on whether the pitch is above or below C3. Since diapasons descend diatonically from G2, the octave assignment is: use the existing tuning entries from the profile as the reference octave, then adjust if the scheme pitch differs.
   - **Simpler approach:** The diapason pitches always descend. Courses 7-11 are in octave 2, courses 12-13 are in octave 1. The scheme just changes the pitch name within the octave. So `ees,` (Eb in octave 2) becomes `e,` (E in octave 2) for the a_minor scheme. This maps directly:
     - Take the pitch name from the scheme array
     - Convert to LilyPond: Eb→ees, Bb→bes, F#→fis, C#→cis, B→b, E→e, F→f, etc.
     - Course 7-11: append `,`
     - Course 12-13: append `,,`

7. **Format content:** "D minor diapasons for baroque-lute-13: G F Eb D C Bb A (courses 7-13). LilyPond: \stringTuning <g, f, ees, d, c, bes,, a,,>"

### Tool definition

```typescript
export const diapasonsTool: AgentTool<typeof DiapasonsParamsSchema, DiapasonsResult> = {
  name: "diapasons",
  label: "Diapasons",
  description:
    "Look up bass string tuning for a key. Returns diapason pitches and LilyPond syntax for the instrument's diapason scheme.",
  parameters: DiapasonsParamsSchema,
  execute: async (_toolCallId, params) => { ... },
};
```

### Tests (src/diapasons.test.ts)

```
- "D minor" on baroque-lute-13 → d_minor scheme, 7 courses, pitches [G, F, Eb, D, C, Bb, A]
- "A minor" → a_minor scheme, pitches [G, F, E, D, C, B, A]
- "D major" → d_major scheme, pitches include F#, C#
- LilyPond syntax for d_minor → "\\stringTuning <g, f, ees, d, c, bes,, a,,>"
- LilyPond syntax for a_minor → "\\stringTuning <g, f, e, d, c, b,, a,,>"
- LilyPond syntax for d_major → "\\stringTuning <g, fis, e, d, cis, b,, a,,>"
- Unknown key "B major" → closest match with warning
- Instrument with no diapason_schemes (baroque-guitar-5) → error
- Case insensitive: "d Minor" works same as "D minor"
- Alternate format: "Dm" or "d-minor" also matches
```

### prompts.ts update

Add to `buildTools()`:
```
"- Call `diapasons` to look up bass string tuning for a key — returns pitches and LilyPond syntax",
```

---

## Bead 4: i3r.6 — Fretboard SVG Tool

**Files:**
- `src/fretboard.ts` — SVG renderer + tool definition
- `src/fretboard.test.ts` — unit tests
- Update `src/tools.ts` — add `fretboardTool`
- Update `src/prompts.ts` — mention fretboard in `buildTools()`

### What to build

A browser-side `AgentTool` that generates an SVG fretboard diagram from an array of `TabPosition[]` and an instrument ID.

### Types

Schema already exists:

```typescript
export const FretboardParamsSchema = Type.Object({
  positions: Type.Array(TabPositionSchema),
  instrument: InstrumentId,
});
```

### Result type

```typescript
type FretboardResult = {
  svg: string;
  coursesShown: number;
  fretsShown: number;
};
```

### SVG Generation — Pure String Template

No SVG library. Build the SVG as a string using template literals.

**Layout:**
- Horizontal lines = courses (1 at top, N at bottom)
- Vertical lines = frets (nut on left, higher frets to right)
- Only show the relevant fret range: from `min(frets) - 1` to `max(frets) + 1`, clamped to `[0, instrument.frets]`. If all positions are open (fret 0), show frets 0-4.
- Position markers: filled circles at course/fret intersections
- Open strings (fret 0): show as open circle (hollow) at the nut
- Labels: course numbers on the left, fret numbers on top

**Dimensions:**
```
COURSE_SPACING = 20    // px between course lines
FRET_SPACING = 40      // px between fret lines
MARGIN_LEFT = 30       // space for course labels
MARGIN_TOP = 25        // space for fret labels
MARKER_RADIUS = 7      // position marker radius
```

Width = MARGIN_LEFT + (fretsShown × FRET_SPACING) + 20
Height = MARGIN_TOP + ((coursesShown - 1) × COURSE_SPACING) + 20

**SVG structure:**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <!-- Course lines (horizontal) -->
  <line x1="{nutX}" y1="{y}" x2="{lastFretX}" y2="{y}" stroke="#333" stroke-width="1" />

  <!-- Fret lines (vertical) -->
  <line x1="{x}" y1="{topCourseY}" x2="{x}" y2="{bottomCourseY}" stroke="#333" stroke-width="1" />

  <!-- Nut (thicker line at fret 0) -->
  <line x1="{nutX}" y1="{topCourseY}" x2="{nutX}" y2="{bottomCourseY}" stroke="#333" stroke-width="3" />

  <!-- Course labels -->
  <text x="10" y="{y}" font-size="12" text-anchor="middle" dominant-baseline="central">{courseNum}</text>

  <!-- Fret labels -->
  <text x="{x}" y="12" font-size="10" text-anchor="middle">{fretNum}</text>

  <!-- Position markers -->
  <circle cx="{x}" cy="{y}" r="7" fill="#333" />           <!-- fretted -->
  <circle cx="{nutX}" cy="{y}" r="6" fill="none" stroke="#333" stroke-width="2" />  <!-- open -->
</svg>
```

**Fretted position x-coordinate:** Position the marker between fret lines (halfway between fret N-1 and fret N). For fret 0 (open), place at the nut.

**Diapason courses:** If the instrument has diapasons (courses > fretted_courses), still show them as course lines but use a dashed stroke to distinguish them. Position markers on diapason courses should only appear at fret 0 (they can't be fretted — but we show what was passed in, since the tool just renders).

### Tool definition

```typescript
export const fretboardTool: AgentTool<typeof FretboardParamsSchema, FretboardResult> = {
  name: "fretboard",
  label: "Fretboard",
  description:
    "Render an SVG fretboard diagram showing finger positions on the instrument.",
  parameters: FretboardParamsSchema,
  execute: async (_toolCallId, params) =>
    instrumentTool(params.instrument, (model) => {
      // ... generate SVG
    }),
};
```

### Format content

Text description for the LLM: "Fretboard diagram for baroque-lute-13: 13 courses, frets 0-4. 3 positions marked."

The SVG itself goes in `details.svg` for the UI to render (when tool renderers are added in a future wave).

### Tests (src/fretboard.test.ts)

```
- Single position (course 1, fret 2) → SVG contains <circle>, contains <svg, is valid XML
- Multiple positions → correct number of <circle> elements
- Open string (fret 0) → hollow circle (fill="none")
- Fretted position → filled circle (fill="#333")
- All-open chord → frets 0-4 shown (not just fret 0)
- High position (fret 5-7) → only relevant fret range shown
- Course labels present → <text> elements with course numbers
- Fret labels present → <text> elements with fret numbers
- Empty positions array → diagram with no markers (just grid)
- 13-course lute → 13 horizontal lines, diapason courses dashed
- 5-course guitar → 5 horizontal lines, no dashed courses
- SVG viewBox dimensions are reasonable (not 0x0, not huge)
```

### prompts.ts update

Add to `buildTools()`:
```
"- Call `fretboard` to render an SVG fretboard diagram showing finger positions",
```

---

## Bead 5: gwf.3 — POST /api/validate

**Files:**
- `src/server/lib/validate-route.ts` — route handler
- `src/server/lib/validate-route.test.ts` — unit tests
- Update `src/server/index.ts` — wire route into router

### What to build

A lightweight syntax-validation endpoint that runs LilyPond without producing output files.

### Types

Add to `src/types.ts`:

```typescript
export const ValidateParamsSchema = Type.Object({
  source: Type.String({ minLength: 1, description: "LilyPond source to validate" }),
});

export type ValidateParams = Static<typeof ValidateParamsSchema>;

export const ValidateResultSchema = Type.Object({
  valid: Type.Boolean(),
  errors: Type.Array(CompileErrorSchema),
});

export type ValidateResult = Static<typeof ValidateResultSchema>;
```

### Route implementation

```typescript
// src/server/lib/validate-route.ts
import { Value } from "@sinclair/typebox/value";
import type { RequestHandler } from "express";
import { ValidateParamsSchema, type ValidateParams, type ValidateResult } from "../../types.js";
import { createApiRoute } from "./create-route.js";
import { SubprocessRunner } from "./subprocess.js";
import { parseLilyPondErrors } from "./compile-route.js";

export type ValidateRouteOptions = {
  runner?: Pick<SubprocessRunner, "run">;
  timeout?: number;
};

export function createValidateRoute(options: ValidateRouteOptions = {}): RequestHandler {
  const runner = options.runner ?? new SubprocessRunner(options.timeout ?? 15_000);
  const timeout = options.timeout ?? 15_000;

  return createApiRoute<ValidateParams, ValidateResult>({
    validate: (body) => Value.Decode(ValidateParamsSchema, body),
    handler: async (params) => validateSource(params, runner, timeout),
  });
}
```

**Key difference from compile:** Use LilyPond flags that skip rendering:
- `-dno-print-pages` — don't produce output pages
- `--loglevel=ERROR` — only show errors
- Still need `-I` flags for includes

```typescript
async function validateSource(
  params: ValidateParams,
  runner: Pick<SubprocessRunner, "run">,
  timeout: number
): Promise<ValidateResult> {
  const includeArgs = lilypondIncludeDirs().flatMap((dir) => ["-I", dir]);
  const result = await runner.run({
    command: "lilypond",
    args: [...includeArgs, "-dno-print-pages", "--loglevel=ERROR", "-o", "output", "source.ly"],
    inputFile: { name: "source.ly", content: params.source },
    timeout,
    outputGlobs: [],  // We don't care about output files
  });

  const errors = parseLilyPondErrors(result.stderr, params.source);

  // Also treat non-zero exit as an error if no structured errors were parsed
  if (errors.length === 0 && result.exitCode !== 0) {
    errors.push({
      bar: 0, beat: 0, line: 0,
      type: "lilypond",
      message: result.stderr.trim() || `LilyPond exited with code ${result.exitCode}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

**Note:** Import `lilypondIncludeDirs` from compile-route. Currently it's a private function — you'll need to export it from `compile-route.ts`. This is a minor refactor: just add `export` to the function declaration.

### Wire into router

In `src/server/index.ts`, add:

```typescript
import { createValidateRoute } from "./lib/validate-route.js";

// In createApiRouter():
router.post("/validate", createValidateRoute());
```

### Tests (src/server/lib/validate-route.test.ts)

Follow the same pattern as `compile-route.test.ts` — mock the `SubprocessRunner`:

```
- Valid source → { valid: true, errors: [] }
- Invalid source (syntax error) → { valid: false, errors: [...] }
- Source with barcheck failure → { valid: false, errors with type "barcheck" }
- Empty source → 400 (TypeBox validation rejects empty string)
- Non-zero exit with no parseable errors → generic error in array
- Runner uses -dno-print-pages flag (verify args passed to mock)
- Runner uses shorter timeout than compile (15s default vs 30s)
```

Look at the existing `compile-route.test.ts` for the mock pattern — it uses a mock runner that returns canned `SubprocessResult` objects.

### Acceptance criteria

- [ ] POST /api/validate accepts `{ source: string }`
- [ ] Returns `{ ok: true, data: { valid: boolean, errors: CompileError[] } }`
- [ ] Uses `-dno-print-pages` flag (no output files generated)
- [ ] Reuses `parseLilyPondErrors` from compile-route
- [ ] `lilypondIncludeDirs()` exported from compile-route (not duplicated)
- [ ] Route wired in server/index.ts
- [ ] Tests pass with mocked SubprocessRunner

---

## Cross-Cutting: Update tools.ts

After all three new tools are built, update `src/tools.ts`:

1. Import the new tools:
```typescript
import { transposeTool } from "./transpose.js";
import { diapasonsTool } from "./diapasons.js";
import { fretboardTool } from "./fretboard.js";
```

2. Add to the `tools` array:
```typescript
export const tools = [
  tabulateTool,
  voicingsTool,
  checkPlayabilityTool,
  theoryTool,
  compileTool,
  analyzeTool,
  lintTool,
  transposeTool,
  diapasonsTool,
  fretboardTool,
];
```

3. Export them individually too (same pattern as existing tools).

4. **Extract `instrumentTool`** from `src/tools.ts` into `src/lib/tool-helpers.ts` so the new tool files can use it. Update the existing import in `tools.ts`.

Move this function:
```typescript
function instrumentTool<TDetails>(
  instrument: string,
  handler: (model: InstrumentModel) => AgentToolResult<TDetails>
): AgentToolResult<TDetails> {
  try {
    const model = InstrumentModel.fromProfile(loadBrowserProfile(instrument));
    return handler(model);
  } catch (error) {
    return toolError<TDetails>(errorMessage(error));
  }
}
```

Into `src/lib/tool-helpers.ts` as an exported function. It depends on `InstrumentModel`, `loadBrowserProfile`, `errorMessage`, and `toolError` — all of which are importable.

## Cross-Cutting: Update prompts.ts

The `buildTools()` function should list all 10 tools. Updated version:

```typescript
function buildTools(): string {
  return [
    "## Your Tools",
    "",
    "You have access to domain-specific tools for mechanical correctness. Use them:",
    "- Call `tabulate` to find valid course/fret positions — never guess fret/course placements",
    "- Call `voicings` to enumerate chord voicing options — pick from real alternatives",
    "- Call `check_playability` to validate before presenting to the user",
    "- Call `compile` after generating or modifying LilyPond source",
    "- Call `analyze` when given a MusicXML file — get key, chord progression, voice ranges",
    "- Call `lint` after generating an arrangement — catch parallel fifths, voice crossing, spacing errors",
    "- Call `theory` for quick music theory lookups — intervals, chord names, scale degrees, Roman numerals",
    "- Call `transpose` to transpose pitches by interval — validates range and suggests idiomatic keys",
    "- Call `diapasons` to look up bass string tuning for a key — returns pitches and LilyPond syntax",
    "- Call `fretboard` to render an SVG fretboard diagram showing finger positions",
  ].join("\n");
}
```

Update the existing `prompts.test.ts` if it asserts on tool names — it should now expect all 10.

---

## Execution Order

These beads are independent and can be done in any order. Suggested order for least churn:

1. **Extract `instrumentTool` to tool-helpers.ts** (prerequisite for i3r.4, i3r.5, i3r.6)
2. **i3r.5 (diapasons)** — simplest new tool, pure lookup
3. **i3r.4 (transpose)** — uses tonal.js, slightly more complex
4. **i3r.6 (fretboard SVG)** — most code (SVG generation) but self-contained
5. **Update tools.ts** — wire all 3 new tools into the array
6. **Update prompts.ts** — add 3 new tool descriptions
7. **gwf.3 (validate route)** — server-side, independent of tool work
8. **kyq.4 (template tests)** — integration test, run last to verify everything

## Final Gate

Run inside the Nix dev shell:

```bash
cd ~/workspace/vellum && nix develop --command bash -c '
  npm install &&
  npm run typecheck &&
  npm test
'
```

All tests must pass. No typecheck errors. Commit with message: `wave 7: transpose, diapasons, fretboard tools + template tests + validate endpoint`.

Do NOT push — leave the commit local.
