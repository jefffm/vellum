# Wave 11 — System Prompt Update + Integration Tests + Bead Cleanup

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

## Current State

- **Branch:** `feat/nix-package` at `a61bc9b`
- **Test baseline:** ~530+ tests across 34 files. All passing. Must not regress.
- **Engrave engine:** Fully implemented (schema, validation, pitch resolution, leaf construction, template strategies, server wiring, route handler)
- **Key source files:**
  - `src/prompts.ts` (132 lines) — system prompt builder. Mentions `compile` tool but NOT `engrave`. Needs update.
  - `src/prompts.test.ts` — corresponding tests
  - `src/server/lib/engrave.ts` (engine core, 912-line test file)
  - `src/server/lib/template-strategies.ts` (270-line test file)
  - `src/server/lib/engrave-route.ts` + test (HTTP handler, already has 2 tests)
  - `src/lib/engrave-schema.ts` (TypeBox schemas for EngraveParams)
  - `src/server-tools.ts` (engraveTool registered, 11 tools total)

## Phase 1: Bead Cleanup (housekeeping)

These beads are DONE in code but still open in the tracker. Close them:

```
br close ke7.1 ke7.2 ke7.3 ke7.4 ke7   # Server wiring — all implemented
br close y0g.1 y0g.2 y0g.3 y0g.4 y0g.5 y0g  # Template strategies — all implemented
br close x0l                              # Engrave engine — implemented
```

## Phase 2: kv5 — System Prompt Update

**kv5.1:** Update `src/prompts.ts` to document the `engrave` tool in the workflow.

The current `buildTools()` section lists tools but doesn't mention `engrave`. The current `buildWorkflow()` describes a compile-only flow. After the engrave tool, the preferred workflow for tablature is:

1. User describes what they want (piece, instrument, arrangement)
2. Agent uses `engrave` tool to generate structurally correct LilyPond from musical parameters
3. Agent calls `compile` to render the engrave output
4. If compile errors, agent fixes and retries (existing auto-compile loop)

Add to `buildTools()`:

- `engrave` — generates LilyPond source from structured musical data (instrument, template, bars with note events). Use for tablature generation instead of writing raw LilyPond. Eliminates syntax errors.

Add to `buildWorkflow()` or a new section:

- When generating tablature: prefer `engrave` over raw LilyPond. Construct the EngraveParams (instrument, template, bars), call engrave, then compile the result.
- For edits to existing LilyPond: continue using direct edit + compile.

**kv5.2:** Update `src/prompts.test.ts` to assert the new engrave-related content appears in the prompt output.

## Phase 3: f31 — Integration Tests

**f31.1 — Golden output tests** (`src/server/lib/engrave.integration.test.ts` or similar):

- Test full pipeline for each template: `solo-tab`, `french-tab`, `tab-and-staff`, `voice-and-tab`
- Use `classical-guitar-6` and `baroque-lute-11` instruments
- Assert the output contains expected LilyPond structures (TabStaff, Staff, includes, version header)
- Snapshot or structural assertion — not exact string match (too brittle)

**f31.2 — Error handling tests:**

- Missing required fields → validation error
- Unknown instrument → clear error
- Empty bars array → clear error
- Invalid pitch values → clear error
- These may partially exist in `engrave.test.ts` already — check before duplicating

**f31.3 — Route handler HTTP tests:**

- Already has 2 tests in `engrave-route.test.ts`. Extend with:
  - POST with each template type → 200
  - POST with malformed JSON → 400
  - POST with valid JSON but missing instrument → 400

**f31.4 — Cross-instrument template matrix:**

- For each instrument in the registry × each applicable template, call engrave and assert no errors
- This is the most comprehensive test — catches instrument/template incompatibilities

## Validation Gate

After all changes:

```bash
nix develop --command bash -c 'npm run typecheck && npm test && npm run format:check'
```

Must pass with zero failures. Commit message: `feat(engrave): Wave 11 — system prompt update + integration tests`

Then push: `git push origin feat/nix-package`

## Beads to close when done

- `kv5.1`, `kv5.2`, `kv5` (after Phase 2)
- `f31.1`, `f31.2`, `f31.3`, `f31.4`, `f31` (after Phase 3)
