# Wave 9 — E2E Test Infrastructure + Pipeline Tests

## Scope

4 beads building the test foundation, then exercising it with real pipeline tests. Also includes housekeeping: close beads already completed in earlier waves.

| #   | Bead         | Title                                                                  | Pri |
| --- | ------------ | ---------------------------------------------------------------------- | --- |
| 1   | 0xd.10       | TestHarness + table-driven test infrastructure                         | P0  |
| 2   | 0xd.9        | Test fixtures: MusicXML and LilyPond sample files                      | P0  |
| 3   | 0xd.2        | French tab pipeline test (real LilyPond)                               | P0  |
| 4   | 0xd.4        | Tool chain pipeline test (tabulate → voicings → playability → compile) | P0  |
| —   | housekeeping | Close completed beads in tracker                                       | —   |

After this wave: shared test infrastructure (TestServer, table-driven runner, fixture loader), 10 fixture files, and 2 end-to-end pipeline tests proving the full stack works.

---

## Environment Setup

Bootstrap Nix (required every session):

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

Run all commands via the dev shell:

```bash
cd ~/workspace/vellum && nix develop --command bash -c 'npm install && npm run typecheck && npm test'
```

**Gate:** All existing tests (213 across 23 files) must pass before AND after changes.

---

## Housekeeping: Close Completed Beads

Before starting new work, update `.beads/issues.jsonl` to close beads that are already implemented but still marked "open":

| Bead         | Title                                         | Why it's done                                                           |
| ------------ | --------------------------------------------- | ----------------------------------------------------------------------- |
| vellum-gwf.3 | POST /api/validate                            | `validate-route.ts` exists with 7 passing tests                         |
| vellum-gwf.4 | Integration test: compile French tab template | `test/templates.test.ts` compiles all templates including french-tab.ly |
| vellum-i3r.4 | transpose tool                                | `src/transpose.ts` exists with 8 passing tests                          |
| vellum-i3r.5 | diapasons tool                                | `src/diapasons.ts` exists with 14 passing tests                         |
| vellum-i3r.6 | fretboard tool                                | `src/fretboard.ts` exists with 17 passing tests                         |
| vellum-kyq.4 | Template compilation test suite               | `test/templates.test.ts` auto-discovers all 8 templates                 |
| vellum-8zf.6 | theory.py chordify subcommand                 | Already status "done", mark closed                                      |

To close a bead, find its line in `.beads/issues.jsonl` and change `"status":"open"` (or `"status":"done"`) to `"status":"closed"`. Do this for all 7 beads listed above.

Also close parent epics where all children are now closed:

- **vellum-i3r** (Instrument Mechanics Tools) — all sub-beads done (i3r.4, i3r.5, i3r.6)
- **vellum-kyq** (Epic 4: LilyPond Templates & Includes) — all sub-beads done (kyq.3, kyq.4)

---

## Bead 1: 0xd.10 — Test Infrastructure

Read the full bead: `grep '"id":"vellum-0xd.10"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

Three components in `test/lib/`:

#### 1. TestServer (`test/lib/test-server.ts`)

A wrapper that starts the Express app on a random port for integration tests. Does NOT start a child process — imports `createApp()` from `src/server/index.ts` and calls `app.listen()` directly.

```typescript
import { createApp } from "../../src/server/index.js";

export class TestServer {
  private server: Server;
  private port: number;

  static async start(opts?: { port?: number }): Promise<TestServer>;
  async post(path: string, body: object): Promise<{ status: number; data: any }>;
  async get(
    path: string,
    opts?: { raw?: boolean }
  ): Promise<{ status: number; data: any; text?: string }>;
  async delete(path: string): Promise<{ status: number; data: any }>;
  async stop(): Promise<void>;
  get baseUrl(): string;
}
```

Implementation notes:

- Use port 0 for random port assignment (or accept explicit port)
- Use Node's built-in `fetch` (available in Node 20) for HTTP requests
- `post()` sends JSON, parses JSON response
- `get()` with `raw: true` returns raw text (for template source endpoint)
- `stop()` calls `server.close()` and waits for it to finish
- Handle errors gracefully — if the server fails to start, throw a clear error

#### 2. Table-driven test runner (`test/lib/table-test.ts`)

A thin wrapper around Vitest's `it.each` that takes typed test case arrays:

```typescript
export type TestCase = { name: string; [key: string]: unknown };

export function tableTest<TCase extends TestCase>(
  description: string,
  cases: TCase[],
  run: (tc: TCase) => Promise<void> | void
): void {
  describe(description, () => {
    for (const tc of cases) {
      it(tc.name, () => run(tc));
    }
  });
}
```

Keep it minimal. The value is in the convention (every case has a `name`, the runner generates one test per row), not in complex logic.

#### 3. Fixture loader (`test/lib/fixtures.ts`)

```typescript
export function fixtureDir(): string; // absolute path to test/fixtures/
export function loadFixture(name: string): string; // raw text by filename
export function loadLyFixture(name: string): string; // loads from test/fixtures/{name}.ly
export function loadMusicXMLFixture(name: string): string; // loads from test/fixtures/{name}.xml
```

Uses `path.resolve(process.cwd(), "test", "fixtures")` to locate fixtures directory. Throws a clear error if the fixture file doesn't exist.

### Tests

**File:** `test/lib/test-infra.test.ts`

Self-hosting tests — the infrastructure tests itself:

```
- TestServer starts on a random port and responds to GET /health
- TestServer.post sends JSON and parses response
- TestServer.stop shuts down cleanly (no lingering handles)
- TestServer.get with raw:true returns text
- tableTest generates one test per case
- tableTest uses case.name as the test name
- loadFixture reads a file from test/fixtures/
- loadFixture throws for missing files
- loadLyFixture reads .ly files
```

For the TestServer tests, use real requests to `GET /health` (which already returns `{ status: "ok" }`). This proves the wiring works end-to-end.

### Acceptance criteria

- [ ] TestServer starts, serves requests, stops cleanly
- [ ] No lingering handles after stop (Vitest exits cleanly)
- [ ] tableTest generates named tests
- [ ] Fixture loader reads files, throws on missing
- [ ] Self-hosting tests pass

---

## Bead 2: 0xd.9 — Test Fixtures

Read the full bead: `grep '"id":"vellum-0xd.9"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

Create `test/fixtures/` directory with real music data.

#### LilyPond fixtures (6 files)

All `.ly` fixtures must compile with LilyPond. They should use `\include` with paths relative to the project root's `instruments/` and `templates/` dirs (the compile route passes `-I instruments -I templates`). For fixture compilation tests, pass the same `-I` flags.

1. **`d-minor-scale-lute.ly`** — D minor scale for 13-course baroque lute.

   ```lilypond
   \version "2.24.0"
   % D minor scale for baroque lute, French tab notation
   \include "../instruments/baroque-lute-13.ily"

   music = \relative c' {
     d4 e f g a bes cis d
   }
   % ... use french-tab style TabStaff with baroque lute tuning
   ```

   Must use `\frenchtab` format from baroque-lute-13.ily. 8-note ascending scale, D4 to D5.

2. **`polyphonic-lute.ly`** — Two-voice passage for baroque lute.

   ```lilypond
   % Two-voice polyphonic passage demonstrating voice layers in French tab
   ```

   Two voices using `\voiceOne` / `\voiceTwo` in a TabStaff. 4 bars, simple counterpoint. This tests that LilyPond correctly renders multiple voice layers in tab notation.

3. **`diapason-test.ly`** — Passage using open bass strings (diapasons).
   The diapason courses (7-14) on a baroque lute are open strings tuned diatonically. Write a passage that uses courses 1-6 for melody and courses 7-10 for bass notes. The bass notes should use `/a,` style notation (bass below staff in French tab).

4. **`bwv996-bourree-opening.ly`** — Opening 8 bars of Bach BWV 996 Bourrée for baroque lute.
   This is public domain (1717). The Bourrée is in E minor. Encode the opening for baroque lute using French tab. This is a widely-known test piece. Use the standard lute transcription (in E minor, using courses 1-6 primarily).

5. **`flow-my-tears-opening.ly`** — Opening bars of Dowland's Lachrimae (voice + lute).
   Public domain (1600). Use the `voice-and-tab.ly` template pattern: vocal melody Staff + lute TabStaff. A minor, opening 4 bars. Include lyrics.

6. **`simple-guitar.ly`** — Simple passage for classical guitar.
   Use the classical-guitar-6.ily include. Number tablature. Simple arpeggio or scale passage. 4 bars.

#### MusicXML fixtures (4 files)

MusicXML is a standard music interchange format. These don't need music21 to validate at this stage — they just need to be well-formed XML that music21 _will_ parse later (bead 8zf.3). Hand-encode minimal but correct MusicXML.

1. **`bach-chorale-cmaj.xml`** — Simple 4-voice SATB in C major.
   8 bars. Parts: Soprano, Alto, Tenor, Bass. Key signature: C major. Time signature: 4/4. Use a simple I-IV-V-I style progression. Each voice has whole notes or half notes — keep it simple.

2. **`parallel-fifths.xml`** — Deliberate parallel fifths for lint testing.
   4 bars, 2 voices. Include at least one pair of parallel fifths between soprano and bass (e.g., C-G moving to D-A in parallel motion). This is an intentional voice-leading violation.

3. **`hymn-simple.xml`** — Generic 4-bar hymn in D major.
   SATB, 4/4, simple block chords. Use a standard hymn-like progression: I - IV - V - I.

4. **`all-creatures-satb.xml`** — Opening of LASST UNS ERFREUEN in D major.
   This is the tune for "All Creatures of Our God and King." Public domain (1623 melody). 8 bars of the opening, SATB harmonization. D major, 3/4 time (or common time depending on arrangement).

#### MusicXML format reference

Each MusicXML file needs this basic structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Soprano</part-name></score-part>
    <!-- ... more parts ... -->
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <note>
        <pitch><step>C</step><octave>5</octave></pitch>
        <duration>4</duration><type>whole</type>
      </note>
    </measure>
  </part>
</score-partwise>
```

Key rules:

- `<divisions>` sets the divisions per quarter note (1 = quarter note has duration 1)
- `<duration>` is relative to divisions: if divisions=1, duration=1 is a quarter, duration=4 is a whole
- Each `<part>` has its own `<measure>` elements
- SATB uses 4 parts (or 2 parts with 2 voices each)
- For parallel fifths fixture: make the fifths OBVIOUS — direct parallel motion, same rhythm

#### README

**`test/fixtures/README.md`** — Provenance and license notes:

```markdown
# Test Fixtures

## LilyPond Fixtures

| File                      | Source              | License       |
| ------------------------- | ------------------- | ------------- |
| d-minor-scale-lute.ly     | Hand-written        | N/A           |
| polyphonic-lute.ly        | Hand-written        | N/A           |
| diapason-test.ly          | Hand-written        | N/A           |
| bwv996-bourree-opening.ly | J.S. Bach (1717)    | Public domain |
| flow-my-tears-opening.ly  | John Dowland (1600) | Public domain |
| simple-guitar.ly          | Hand-written        | N/A           |

## MusicXML Fixtures

| File                   | Source                           | License       |
| ---------------------- | -------------------------------- | ------------- |
| bach-chorale-cmaj.xml  | Hand-encoded (Bach style)        | N/A           |
| parallel-fifths.xml    | Hand-written (deliberate errors) | N/A           |
| hymn-simple.xml        | Hand-written                     | N/A           |
| all-creatures-satb.xml | LASST UNS ERFREUEN (1623)        | Public domain |
```

### Tests

The existing `test/templates.test.ts` auto-discovers `.ly` files in `templates/` but NOT in `test/fixtures/`. Add a new test:

**File:** `test/fixtures.test.ts`

```
- Each .ly fixture compiles with LilyPond (same approach as templates.test.ts but targeting test/fixtures/)
- Each .ly fixture produces non-empty SVG
- Each .xml fixture is well-formed XML (parse with DOMParser or a simple XML check)
```

For the LilyPond fixture compilation, pass `-I instruments -I templates` just like the compile route does. The fixtures use `\include "../instruments/..."` relative paths, so also pass the fixture directory itself.

**Important:** The `.ly` fixtures in `test/fixtures/` use `\include` with paths relative to their own location. When compiling, you need to pass appropriate `-I` flags so LilyPond can find the instrument `.ily` files. Two approaches:

- Use `\include "../instruments/baroque-lute-13.ily"` (relative from fixtures/ to project root) — works when compiling from the project root
- Or use `-I` flags to add `instruments/` to the include path, and use `\include "baroque-lute-13.ily"` in the fixture

Choose whichever is simpler. The existing templates use `\include "../instruments/..."` style, so matching that pattern is fine. Just make sure `cwd` is set to the project root when compiling fixtures.

### Acceptance criteria

- [ ] All 6 .ly fixtures compile with LilyPond (zero errors)
- [ ] All 4 .xml fixtures are well-formed XML
- [ ] README.md documents provenance for each fixture
- [ ] BWV 996 and Flow My Tears use correct public-domain music
- [ ] Parallel fifths fixture has obvious parallel fifth motion

---

## Bead 3: 0xd.2 — French Tab Pipeline Test

Read the full bead: `grep '"id":"vellum-0xd.2"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

End-to-end test: POST LilyPond source to the real server → verify compilation output.

**File:** `test/e2e/french-tab.test.ts`

This test uses TestServer (from bead 1) and fixtures (from bead 2). It starts the actual Express server, sends real LilyPond source, and verifies real LilyPond compilation.

```typescript
import { TestServer } from "../lib/test-server.js";
import { loadLyFixture } from "../lib/fixtures.js";

let server: TestServer;

beforeAll(async () => {
  server = await TestServer.start();
});

afterAll(async () => {
  await server.stop();
});
```

### Test cases

1. **Simple D minor scale → SVG with French letters**
   - POST `/api/compile` with `d-minor-scale-lute.ly` fixture source
   - Verify: status 200, `data.svg` is non-empty, SVG contains `<text` elements
   - Verify: no errors in response

2. **Polyphonic passage → both voices render**
   - POST `/api/compile` with `polyphonic-lute.ly` fixture source
   - Verify: status 200, SVG contains text elements for both voices

3. **Diapason bass notes → compiles without error**
   - POST `/api/compile` with `diapason-test.ly` fixture source
   - Verify: status 200, SVG is non-empty

4. **BWV 996 Bourrée opening → valid French tab**
   - POST `/api/compile` with `bwv996-bourree-opening.ly` fixture source
   - Verify: status 200, SVG is non-empty, no errors

5. **Invalid source → structured errors, no SVG**
   - POST `/api/compile` with `{ source: "\\version \"2.24.0\"\n{ c4 d e f \\invalid_command }" }`
   - Verify: response contains errors array with at least one entry
   - Verify: SVG is empty or absent

6. **MIDI output** (if the fixture includes `\midi` block)
   - POST `/api/compile` with `{ source: ..., format: "both" }` using d-minor-scale fixture
   - Verify: response includes midi data (or at minimum, no error when midi is requested)

### Important implementation notes

- The compile route reads the `source` field from the POST body and writes it to a temp file before running LilyPond. The fixture `.ly` files use `\include` with relative paths like `"../instruments/baroque-lute-13.ily"`. When the compile route writes source to a temp file, these relative includes WON'T resolve.
- **Solution:** The compile route already passes `-I` flags via `lilypondIncludeDirs()` (exported from `compile-route.ts`). Check what directories it includes. The fixtures should use `\include` paths that work with those `-I` directories. If the compile route adds `instruments/` and `templates/` to the include path, fixtures should use `\include "baroque-lute-13.ily"` (not `"../instruments/baroque-lute-13.ily"`).
- **This means the fixture `.ly` files for the E2E tests might need DIFFERENT include paths than the fixture `.ly` files used for direct LilyPond compilation in `fixtures.test.ts`.** Two options:
  1. Have the E2E fixtures use `\include "baroque-lute-13.ily"` (works with server's `-I` flags) and the compilation test in `fixtures.test.ts` pass matching `-I instruments` flags
  2. Have two versions of include paths (messy, avoid this)

  **Prefer option 1:** All `.ly` fixtures use `\include "baroque-lute-13.ily"` (bare filename), and both `fixtures.test.ts` and the compile route pass `-I instruments`.

- Read `src/server/lib/compile-route.ts` to understand what `-I` flags are passed. The function `lilypondIncludeDirs()` is exported — check its implementation and match your fixture include paths to what it provides.

### Acceptance criteria

- [ ] D minor scale compiles to SVG via real server
- [ ] Polyphonic passage compiles successfully
- [ ] Diapason passage compiles successfully
- [ ] BWV 996 opening compiles successfully
- [ ] Invalid source returns errors, no SVG
- [ ] TestServer starts and stops cleanly around the tests

---

## Bead 4: 0xd.4 — Tool Chain Pipeline Test

Read the full bead: `grep '"id":"vellum-0xd.4"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

Integration test: chain browser-side tools together to simulate an arrangement workflow. No server needed for steps 1-4 (browser tools run in-process). Server needed only for the final compile step.

**File:** `test/e2e/tool-chain.test.ts`

This test imports the browser-side tool functions directly and calls them in sequence, then uses TestServer for the final compile.

### Pipeline under test

```
melody pitches → tabulate() → positions → voicings() → best voicing
→ check_playability() → verify clean → generate .ly source → compile() → SVG
```

### Test cases

1. **D minor scale → tabulate each note → all have baroque lute positions**

   ```typescript
   const pitches = ["D4", "E4", "F4", "G4", "A4", "Bb4", "C#5", "D5"];
   // For each pitch, call tabulate tool with instrument "baroque-lute-13"
   // Verify: every pitch returns at least one TabPosition
   ```

2. **D minor chord → voicings → at least one option**

   ```typescript
   const chord = ["D3", "A3", "D4", "F4"];
   // Call voicings tool with these notes + instrument "baroque-lute-13"
   // Verify: at least one Voicing returned
   // Verify: best voicing (lowest stretch) has stretch < 5
   ```

3. **Best voicing → check_playability → no violations**

   ```typescript
   // Take the best voicing from test 2
   // Call check_playability tool
   // Verify: no violations of type "stretch" or "same_course"
   ```

4. **Deliberately bad voicing → check_playability catches it**

   ```typescript
   // Construct a voicing with a 6+ fret stretch
   // Call check_playability
   // Verify: at least one violation reported
   ```

5. **Generate .ly source from positions → compile → valid SVG**
   ```typescript
   // Take the tabulated positions from test 1
   // Generate minimal LilyPond source using french-tab format
   // POST /api/compile
   // Verify: SVG output, no errors
   ```

### Tool import notes

The browser-side tools are in:

- `src/tools.ts` — exports tool definitions
- `src/lib/instrument-model.ts` — `InstrumentModel` with `positionsForPitch()`, `voicingsFor()`, `checkPlayability()`
- `src/lib/browser-profiles.ts` — `loadBrowserProfile()`

For the test, import `InstrumentModel` and `loadBrowserProfile` directly:

```typescript
import { InstrumentModel } from "../../src/lib/instrument-model.js";
import { loadBrowserProfile } from "../../src/lib/browser-profiles.js";

const profile = loadBrowserProfile("baroque-lute-13");
const model = InstrumentModel.fromProfile(profile);

// tabulate
const positions = model.positionsForPitch("D4");

// voicings
const voicings = model.voicingsFor(["D3", "A3", "D4", "F4"]);

// playability
const result = model.checkPlayability(voicings[0].positions);
```

**Check the actual method signatures** on `InstrumentModel` before writing the tests — the above is pseudocode. Read `src/lib/instrument-model.ts` to get the real API.

For the compile step (test 5), generate a minimal `.ly` string inline:

```typescript
const lySource = `\\version "2.24.0"
\\include "baroque-lute-13.ily"
% ... generated from tabulated positions
`;
```

### Acceptance criteria

- [ ] Every D minor scale pitch maps to at least one baroque lute position
- [ ] D minor chord has at least one playable voicing
- [ ] Best voicing passes playability check
- [ ] Bad voicing is caught by playability check
- [ ] Generated LilyPond compiles to SVG via server
- [ ] Full pipeline (tabulate → voicings → playability → compile) works end-to-end

---

## Execution Order

Bead 1 (infrastructure) first — beads 3 and 4 depend on TestServer and fixtures. Bead 2 (fixtures) next — beads 3 and 4 reference fixture files. Beads 3 and 4 can be done in either order after 1 and 2.

Housekeeping (closing old beads) can happen at any point — do it at the start to clean up the tracker.

```
housekeeping → bead 1 (test infra) → bead 2 (fixtures) → bead 3 (french tab e2e) + bead 4 (tool chain e2e)
```

---

## Key Gotchas

1. **Include paths in fixtures:** Read `compile-route.ts` → `lilypondIncludeDirs()` to understand what `-I` flags the server passes. Match your fixture `\include` paths accordingly. The fixtures in `test/fixtures/` and the inline LilyPond in e2e tests must both work when compiled through the server's compile route.

2. **TestServer port conflicts:** Use port 0 (random) to avoid conflicts if tests run in parallel.

3. **Vitest handles:** Make sure TestServer.stop() actually closes the HTTP server. Vitest will hang if handles are left open. Use `server.close()` with a callback/promise.

4. **Fixture LilyPond vs template LilyPond:** The fixtures in `test/fixtures/` are standalone `.ly` files (they have their own `\version`, `\score`, etc). They are NOT templates — they are complete, compilable LilyPond documents.

5. **Browser-side tool imports in Node tests:** The tools use `?raw` Vite imports in `browser-profiles.ts`. Vitest handles these via its transform pipeline, but verify the existing profile tests work as a reference (they do — `profiles.test.ts` already imports `loadBrowserProfile` successfully).

6. **MusicXML fixtures don't need music21 validation in this wave.** Just make them well-formed XML. They'll be used with music21 in a future wave (8zf.3). For now, a basic XML parse check is sufficient.

---

## Final Gate

```bash
cd ~/workspace/vellum && nix develop --command bash -c '
  npm install &&
  npm run typecheck &&
  npm test
'
```

All tests must pass. No typecheck errors. Commit with message:

`wave 9: e2e test infrastructure, fixtures, french tab + tool chain pipeline tests`

Do NOT push — leave the commit local.
