# Wave 8 — Instrument Profiles + Templates + Template/Arrangement APIs

## Scope

4 beads. All fully testable without a browser — real LilyPond compilation, schema validation, Express route tests.

| # | Bead | Title |
|---|------|-------|
| 1 | jlj.5 | Remaining instrument profiles (8 YAML + browser loading) |
| 2 | kyq.3 | Additional templates (7 new .ly files) |
| 3 | d0c.4 | GET /api/templates — serve template source |
| 4 | d0c.5 | GET/POST /api/arrangements — file-based CRUD |

After this wave: 10 instrument profiles loaded in the browser (was 2), 8 LilyPond templates (was 1), and template/arrangement REST endpoints.

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

**Gate:** All existing tests (165 across 20 files) must pass before AND after changes.

---

## Bead 1: jlj.5 — Remaining Instrument Profiles

Read the full bead description: `grep '"id":"vellum-jlj.5"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

8 new YAML profiles in `instruments/`:

1. **renaissance-lute-6.yaml** — 6 fretted courses, G tuning (G4/D4/A3/F3/C3/G2), 8 frets, notation: italian-number
2. **theorbo-14.yaml** — 6 fretted + 8 diapasons (14 total), courses 1-2 an octave lower than baroque lute (A3/E3 not A4/E4), French letter tab, needs `diapason_schemes`
3. **classical-guitar-6.yaml** — Standard EADGBE tuning (E4/B3/G3/D3/A2/E2), 19 frets, notation: number-tab
4. **piano.yaml** — type: keyboard, no tuning/courses/frets, range A0-C8, 2 staves, notation: standard
5. **voice-soprano.yaml** — type: voice, range C4-A5, notation: standard
6. **voice-alto.yaml** — type: voice, range F3-D5, notation: standard
7. **voice-tenor.yaml** — type: voice, range C3-A4, notation: standard
8. **voice-bass.yaml** — type: voice, range E2-E4, notation: standard

### Schema considerations

The `InstrumentProfileSchema` in `src/types.ts` already makes `tuning`, `frets`, `courses` optional. Piano and voice profiles won't have tuning arrays or fret counts — they use `range` and `type` instead. The schema should validate them as-is. If it doesn't, adjust the schema to accommodate non-fretted instruments (make `constraints` accept empty arrays, etc.).

Each YAML profile must match the patterns in existing profiles (`baroque-lute-13.yaml`, `baroque-guitar-5.yaml`). Use those as structural templates. Key fields:
- `id`, `name`, `notation`, `constraints` (required)
- `tuning` entries use `{ course/string, pitch, note }` format — `pitch` is LilyPond notation, `note` is scientific
- Voice/piano profiles: use `type: voice` or `type: keyboard`, provide `range` but skip `tuning`/`frets`/`courses`

### Browser profiles update

`src/lib/browser-profiles.ts` currently hardcodes two imports via Vite `?raw`:

```typescript
import lute13ProfileYaml from "../../instruments/baroque-lute-13.yaml?raw";
import guitar5ProfileYaml from "../../instruments/baroque-guitar-5.yaml?raw";
```

Add all 8 new profiles the same way. Update `profileSources` map to include all 10. Update `loadAllBrowserProfiles()` — it already returns all keys from the map, so just adding to the map is sufficient.

### Server profiles

`src/server/profiles.ts` uses `readdirSync` on the instruments/ directory — it auto-discovers YAML files. No code change needed, but verify new profiles load via the existing server test or add a test.

### Tests

Add `src/lib/profiles.test.ts` (or extend existing `instrument-model.test.ts`):

```
- Each new YAML profile validates against InstrumentProfileSchema
- loadBrowserProfile("renaissance-lute-6") returns valid profile
- loadBrowserProfile("theorbo-14") → course 1 pitch is A3 (octave lower)
- loadBrowserProfile("classical-guitar-6") → 19 frets, 6 strings
- loadBrowserProfile("piano") → type "keyboard", no tuning array, range A0-C8
- loadBrowserProfile("voice-soprano") → type "voice", range C4-A5
- loadAllBrowserProfiles() returns 10 profiles
- InstrumentModel.fromProfile works for fretted instruments (renaissance-lute, theorbo, classical-guitar)
- InstrumentModel.fromProfile for piano/voice — should construct without error even though they're not fretted (the model just won't have meaningful fret operations)
- Theorbo has diapason_schemes
- Classical guitar has no diapason_schemes
```

### Acceptance criteria

- [ ] All 8 YAML profiles validate against schema
- [ ] Browser profiles loads all 10 instruments
- [ ] Server `/api/instruments` endpoint returns all 10
- [ ] InstrumentModel constructs for all fretted profiles
- [ ] Piano/voice profiles load without errors
- [ ] Theorbo courses 1-2 are A3/E3 (not A4/E4)

---

## Bead 2: kyq.3 — Additional Templates

Read the full bead: `grep '"id":"vellum-kyq.3"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

7 new `.ly` template files in `templates/`. Each must compile with LilyPond and produce valid SVG.

The existing `test/templates.test.ts` from wave 7 auto-discovers all `.ly` files in `templates/` and compiles them. New templates are automatically covered.

### Templates

1. **`solo-tab.ly`** — Simple TabStaff for guitar number tablature. Uses standard number format (not French letters). Include hidden Staff for MIDI output. This is the guitar equivalent of french-tab.ly.
   - Uses `\include` for an instrument .ily (default to classical-guitar-6.ily)
   - Placeholder `music` variable like french-tab.ly

2. **`tab-and-staff.ly`** — TabStaff + standard notation Staff side by side. Two staves showing the same music in both tab and standard notation.
   - Uses `\include` for instrument .ily
   - Both staves share the same `music` variable

3. **`voice-and-tab.ly`** — Vocal melody Staff above lute/guitar TabStaff. For song arrangements (Dowland ayres etc).
   - Two separate variables: `melody` (vocal) and `lute` (tab)
   - Vocal staff with lyrics placeholder
   - Tab staff below

4. **`voice-and-piano.ly`** — Voice line above piano grand staff. Standard art song layout.
   - Three variables: `melody`, `upper` (piano RH), `lower` (piano LH)
   - Vocal Staff + PianoStaff

5. **`grand-staff.ly`** — Piano grand staff (treble + bass clef). Standard PianoStaff with connected barlines.
   - Two variables: `upper`, `lower`
   - Uses `\new PianoStaff`

6. **`satb.ly`** — Four-part choral on 2 staves. SA on treble clef, TB on bass clef.
   - Four variables: `soprano`, `alto`, `tenor`, `bass`
   - Two staves, each with two voices (`\voiceOne`, `\voiceTwo`)

7. **`continuo.ly`** — Figured bass stub. Bass line with `\figuremode` figures above. Can be minimal for now — the important thing is it compiles.
   - Variables: `bass`, `figures`
   - Uses `\new Staff` for bass + `\new FiguredBass`

### Important LilyPond notes

- All templates must start with `\version "2.24.0"`
- Use `\include` with relative paths to instrument .ily files (e.g., `\include "../instruments/classical-guitar-6.ily"` for tab templates)
- Tab templates that don't use French letter format should NOT include baroque-lute-13.ily — use the appropriate instrument
- Each template needs placeholder music that actually compiles. Use simple scales or chord progressions — enough to prove the template works.
- Include `\midi { \tempo 4 = 72 }` in templates that should produce MIDI
- The `-I instruments -I templates` flags are passed by the compile route, so `\include` paths relative to those dirs work

### Tests

The existing `test/templates.test.ts` will auto-discover and compile all new templates. No new test file needed — but verify the test suite runs and all 8 templates (1 existing + 7 new) pass.

If any template uses features specific to an instrument .ily that was just created in bead 1 (jlj.5), make sure that bead is done first or that the template's `\include` resolves correctly.

### Acceptance criteria

- [ ] All 7 new templates compile with LilyPond (zero errors)
- [ ] SVG output is non-empty for each
- [ ] Templates with `\midi` blocks produce MIDI
- [ ] `test/templates.test.ts` passes for all 8 templates
- [ ] Each template has meaningful placeholder music (not empty)

---

## Bead 3: d0c.4 — GET /api/templates

Read the full bead: `grep '"id":"vellum-d0c.4"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

Two endpoints for template access:

1. **GET /api/templates** — List available templates. Returns `{ ok: true, data: [{ name: "french-tab", description: "..." }, ...] }`
2. **GET /api/templates/:name** — Return template source as text. Content-Type: text/plain.

### Implementation

**File:** `src/server/lib/template-route.ts`

```typescript
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

function templatesDirectory(): string {
  return path.resolve(process.cwd(), "templates");
}

// GET /api/templates
function listTemplates(): TemplateSummary[] {
  return readdirSync(templatesDirectory())
    .filter(f => f.endsWith(".ly"))
    .map(f => ({
      name: path.basename(f, ".ly"),
      // Extract description from first comment line in the .ly file
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// GET /api/templates/:name
function getTemplate(name: string): string {
  const filePath = path.join(templatesDirectory(), `${name}.ly`);
  // Read and return, or throw 404
}
```

Use `createApiRoute` from `create-route.ts` for the list endpoint. For the single-template endpoint, return plain text (not JSON) — use a raw Express handler or customize the response content type.

**Security:** Sanitize the `:name` param — reject anything with path separators (`/`, `\`, `..`) to prevent directory traversal.

### Wire into router

In `src/server/index.ts`, add both routes:

```typescript
router.get("/templates", createTemplateListRoute());
router.get("/templates/:name", createTemplateGetRoute());
```

### Tests

**File:** `src/server/lib/template-route.test.ts`

```
- GET /api/templates → lists all templates, each has name field
- GET /api/templates/french-tab → 200, body contains "\version"
- GET /api/templates/nonexistent → 404
- GET /api/templates/../etc/passwd → 400 or 404 (no traversal)
- List includes all 8 templates after kyq.3
```

Use the same test pattern as other route tests — mock as needed, or use real filesystem if simpler (templates are static files).

### Acceptance criteria

- [ ] GET /api/templates returns list of all template names
- [ ] GET /api/templates/:name returns raw LilyPond source
- [ ] 404 for unknown template
- [ ] Path traversal rejected
- [ ] Wired into Express router

---

## Bead 4: d0c.5 — GET/POST /api/arrangements

Read the full bead: `grep '"id":"vellum-d0c.5"' .beads/issues.jsonl | python3 -c "import sys,json; print(json.loads(next(sys.stdin))['description'])"`

### What to build

File-based arrangement persistence:

1. **POST /api/arrangements** — Save an arrangement. Body: `{ title, instrument, lySource, metadata? }`. Returns `{ id, title, createdAt }`.
2. **GET /api/arrangements** — List saved arrangements. Returns array of `{ id, title, instrument, createdAt }`.
3. **GET /api/arrangements/:id** — Get full arrangement (including lySource).
4. **DELETE /api/arrangements/:id** — Delete an arrangement.

### Storage

JSON files in an `arrangements/` directory at project root (or configurable via env var). Each arrangement is one JSON file named `{uuid}.json`:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "BWV 996 Bourrée",
  "instrument": "baroque-lute-13",
  "lySource": "\\version \"2.24.0\"\\n...",
  "metadata": { "key": "E minor", "bars": 32 },
  "createdAt": "2026-04-27T12:00:00.000Z",
  "updatedAt": "2026-04-27T12:00:00.000Z"
}
```

Use `crypto.randomUUID()` for IDs.

### Types

Add to `src/types.ts`:

```typescript
export const ArrangementMetadataSchema = Type.Optional(
  Type.Record(Type.String(), Type.Any())
);

export const CreateArrangementSchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  instrument: Type.String({ minLength: 1 }),
  lySource: Type.String({ minLength: 1 }),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

export const ArrangementSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  instrument: Type.String(),
  lySource: Type.String(),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const ArrangementSummarySchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  instrument: Type.String(),
  createdAt: Type.String(),
});
```

### Implementation

**File:** `src/server/lib/arrangement-route.ts`

- `createArrangementListRoute()` — GET handler, reads all JSON files from arrangements dir
- `createArrangementGetRoute()` — GET :id handler
- `createArrangementCreateRoute()` — POST handler, validates body, writes JSON file
- `createArrangementDeleteRoute()` — DELETE :id handler

Use `createApiRoute` for the JSON endpoints. Sanitize the `:id` param (UUID format only — reject anything that doesn't match `/^[a-f0-9-]{36}$/`).

Create the arrangements directory on first write if it doesn't exist (`mkdirSync({ recursive: true })`).

### Wire into router

```typescript
router.get("/arrangements", createArrangementListRoute());
router.get("/arrangements/:id", createArrangementGetRoute());
router.post("/arrangements", createArrangementCreateRoute());
router.delete("/arrangements/:id", createArrangementDeleteRoute());
```

### Tests

**File:** `src/server/lib/arrangement-route.test.ts`

Use a temp directory for the arrangements storage in tests (pass via options or env var).

```
- POST valid arrangement → 200, returns { id, title, createdAt }
- POST → GET by id → body matches what was posted
- POST two → GET list → both appear
- GET nonexistent id → 404
- DELETE existing → 200, GET after → 404
- POST missing title → 400
- POST missing lySource → 400
- ID format validation (non-UUID → 400 or 404)
```

### Acceptance criteria

- [ ] POST creates arrangement file, returns id
- [ ] GET list returns all arrangements (summary only, no lySource)
- [ ] GET by id returns full arrangement including lySource
- [ ] DELETE removes arrangement
- [ ] 404 for unknown ids
- [ ] Input validation rejects incomplete bodies
- [ ] Wired into Express router
- [ ] Uses temp dir in tests (no filesystem pollution)

---

## Execution Order

Bead 1 (profiles) should complete before bead 2 (templates), since some templates `\include` the new instrument .ily files. Beads 3 and 4 are independent of 1 and 2.

Suggested order:
1. jlj.5 (profiles) — creates YAML + updates browser-profiles.ts
2. kyq.3 (templates) — creates .ly files that may reference new .ily includes
3. d0c.4 (template API) — serves the templates just created
4. d0c.5 (arrangement API) — independent

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

`wave 8: instrument profiles, templates, template/arrangement APIs`

Do NOT push — leave the commit local.
