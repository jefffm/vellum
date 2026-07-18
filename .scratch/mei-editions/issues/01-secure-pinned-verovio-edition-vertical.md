# 01 — Secure pinned Verovio edition vertical

Status: completed

Type: AFK

Blocked by: None

## What to build

Carry one project-authored constrained MEI 5.1 French-tablature fixture through the real local
product: persisted edition identity, locally bundled pinned Verovio worker rendering, safe SVG
mounting, one selected musical object, synchronized literal preview, and a reproducible server
SVG/PDF export. Include the thirteen-course diapason sequence as a focused companion rendering
assertion so the renderer foundation does not overfit five-course guitar.

## Acceptance criteria

- [x] The exact Verovio runtime is pinned locally; the browser and server load no executable code
      from a CDN.
- [x] A constrained MEI fixture renders five-line French tablature with stable canonical IDs and
      expected rhythm/tab semantics in the browser.
- [x] The current notation security boundary safely preserves only required Verovio definitions,
      fragment-local references, and mapped interaction metadata while rejecting external URLs,
      active content, and malformed references.
- [x] Clicking one rendered tablature object produces a version-bound Passage Selection and a
      restrained playback highlight follows the same identity.
- [x] The server produces reproducible SVG and PDF Deliverables using the same pinned version and
      rendering profile; browser/server semantic parity is tested.
- [x] Companion assertions render courses 7–12 as `a`, `/a`, `//a`, `///a`, `4`, and `5`, with
      course 13 explicitly configurable rather than asserted as historical fact.
- [x] Existing LilyPond arrangement preview and generated-artifact security behavior remain
      passing.

## Blocked by

None - can start immediately.

## Gates

Focused Verovio renderer, worker, sanitizer, selection, playback, and export tests; then the base
gates plus browser, render, and playback evaluation. LilyPond sandbox verification applies only
if the existing LilyPond path changes.

## Evidence

- Base gates passed on the macOS host: 1,628 tests passed and four skipped; typecheck, formatting,
  spec verification, browser/server builds all passed.
- `npm run test:browser`: 42 scenarios passed, including the bundled-WASM MEI vertical.
- Pinned Nix shell: `npm run eval:render` and `npm run eval:playback` both passed.
- LilyPond source, compiler, and sandbox code were unchanged, so the LilyPond-only sandbox gate was
  not applicable.
