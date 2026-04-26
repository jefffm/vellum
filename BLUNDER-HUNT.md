# Vellum — Blunder Hunt Report

> **Architecture Update (2026-04-26):** This report was originally written against a TypeScript + Rust/WASM architecture. The project has pivoted to a pi-mono web app on NixOS. Many findings below are addressed by this pivot:
>
> - **C-1 (LilyPond can't run in browser):** Acknowledged. LilyPond runs server-side on servoid. The browser receives rendered artifacts.
> - **C-2 (WASM contract types are fiction):** No longer applicable. Rust/WASM engine removed from v1. All tools are TypeScript.
> - **C-3 (No Rust LilyPond parser):** No longer applicable. Validation operates on structured tool inputs, not .ly source. LilyPond errors caught by the error-parser hook.
> - **S-1 (tonal.js has no tab capabilities):** tonal.js removed. Tab math is in the custom `tabulate()` / `voicings()` / `check_playability()` tools, written in TypeScript.
> - **S-2 (TypeScript never does pitch math violated in v1):** Rule removed. All tools are TypeScript. Rust/WASM is a v2 consideration if performance demands it.
> - **S-3 (hedgetechllc/musicxml WASM readiness):** Deferred. MusicXML import is v2; may use a JS parser instead.
> - **S-5 (Spec conflates WASM in browser):** Resolved. Clear server/browser boundary in new architecture.
> - **S-6 (Double-rewrite cost):** Eliminated. No throwaway TypeScript → Rust migration path. Tools stay in TypeScript.
> - **O-1 (No server architecture):** Resolved. NixOS module, Traefik reverse proxy, systemd service fully specified.
> - **O-2 (No intermediate representation):** Partially addressed. Tools operate on structured data (pitches, positions, instruments). A formal IR is not yet defined but may not be needed — the LLM works with .ly source and calls tools for mechanical checks.
>
> **Findings that remain relevant:**

---

## Still Relevant

### C-4: LilyPond template had wrong function name

**Original:** `tablatureFormat = #fret-letter-tablature`
**Correct:** `tablatureFormat = #fret-letter-tablature-format`

**Status:** Fixed in updated spec templates.

---

### C-5: French tablature requires RhythmicStaff

French letter tab needs a separate `RhythmicStaff` above the `TabStaff` for rhythm flags. This is the native notation for baroque lute and is significantly more complex than the spec originally implied.

**Status:** Acknowledged in new spec. Dedicated `french-tab.ly` template planned. Still needs LilyPond testing (see OQ-07).

---

### S-4: OSMD tablature is guitar tab only — not French letter tab

OSMD supports standard guitar tab (numbers on lines), not French letter tab. For baroque lute display in the browser, LilyPond-rendered SVG is the path for v1. Custom VexFlow extensions would be needed for interactive French tab.

**Status:** Acknowledged. v1 uses server-rendered LilyPond SVG. OSMD/VexFlow is v2, limited to guitar/piano display.

---

### S-7: Playability scoring has no defined algorithm

The `check_playability()` tool returns difficulty ratings and violations, but the algorithm isn't specified.

**Status:** Open (see OQ-06). Minimum viable: fret stretch per chord, same-course conflicts, RH pattern feasibility.

---

### M-1: Baroque lute stringTuning definition needs verification

The LilyPond `\stringTuning` pitch order (lowest to highest vs highest to lowest) needs testing.

**Status:** Needs verification during v1 development.

---

### M-2: Inconsistent schema — courses vs strings

Lute profiles use `courses`, guitar uses `strings`, piano uses `staves`. The tools need to handle this polymorphism.

**Status:** Acceptable for v1. Tools can branch on instrument type. A unified schema could be revisited in v2.

---

### O-3: LLM context limits for large scores

A full multi-movement suite could exceed context limits. The spec doesn't discuss chunking.

**Status:** v1 targets single movements/pieces. Batch conversion (whole suites) is explicitly v2.

---

## New Concerns (pi-mono Architecture)

### N-1: pi-mono is a young, single-maintainer project

Pi-mono is badlogic's (Mario Zechner) open-source project. It's actively developed and well-designed, but:
- Breaking API changes are possible
- Documentation may lag behind the code
- Vellum depends on pi-mono's extension system working as expected

**Mitigation:** Pin pi-mono versions. The codebase is readable. Worst case: fork or inline the needed modules.

---

### N-2: Custom tool visual feedback path is unproven

The `compile()` and `fretboard()` tools need to return SVG artifacts that display in the browser while also returning text results for the LLM. Whether pi-agent-core supports this dual-channel pattern needs verification.

**Mitigation:** Test early. If not supported, the server can push artifacts directly to the frontend via WebSocket/SSE, bypassing the tool return mechanism.

---

### N-3: mTLS deployment complexity

Servoid uses step-ca for certificate management. Vellum needs to integrate with the existing mTLS setup. This is infrastructure work, not Vellum-specific, but it's in the critical path.

**Mitigation:** Follow existing patterns from A2A adapter deployment.
