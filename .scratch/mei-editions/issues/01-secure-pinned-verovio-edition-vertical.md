# 01 — Secure pinned Verovio edition vertical

Status: ready-for-agent

Type: AFK

Blocked by: None

## What to build

Carry one project-authored constrained MEI 5.1 French-tablature fixture through the real local
product: persisted edition identity, locally bundled pinned Verovio worker rendering, safe SVG
mounting, one selected musical object, synchronized literal preview, and a reproducible server
SVG/PDF export. Include the thirteen-course diapason sequence as a focused companion rendering
assertion so the renderer foundation does not overfit five-course guitar.

## Acceptance criteria

- [ ] The exact Verovio runtime is pinned locally; the browser and server load no executable code
      from a CDN.
- [ ] A constrained MEI fixture renders five-line French tablature with stable canonical IDs and
      expected rhythm/tab semantics in the browser.
- [ ] The current notation security boundary safely preserves only required Verovio definitions,
      fragment-local references, and mapped interaction metadata while rejecting external URLs,
      active content, and malformed references.
- [ ] Clicking one rendered tablature object produces a version-bound Passage Selection and a
      restrained playback highlight follows the same identity.
- [ ] The server produces reproducible SVG and PDF Deliverables using the same pinned version and
      rendering profile; browser/server semantic parity is tested.
- [ ] Companion assertions render courses 7–12 as `a`, `/a`, `//a`, `///a`, `4`, and `5`, with
      course 13 explicitly configurable rather than asserted as historical fact.
- [ ] Existing LilyPond arrangement preview and generated-artifact security behavior remain
      passing.

## Blocked by

None - can start immediately.

## Gates

Focused Verovio renderer, worker, sanitizer, selection, playback, and export tests; then the base
gates plus browser, render, and playback evaluation. LilyPond sandbox verification applies only
if the existing LilyPond path changes.
