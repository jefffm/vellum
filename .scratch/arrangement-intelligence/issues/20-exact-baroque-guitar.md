# Exact five-course baroque-guitar projection

Status: complete

Type: AFK

User stories: U4

## What to build

Represent and project the exact selected five-course guitar rather than one pitch per historical course label.

## Acceptance criteria

- [x] Instrument Instance and Course Configurations support single and doubled courses, octaves, unisons, and bourdons.
- [x] Stringing changes deterministic sounding sets, range, alfabeto results, engraving, and playback.
- [x] Rasgueado and punteado applicability remain distinct.
- [x] Exact configuration identity participates in lineage and evaluation.

## Delivered

- `src/lib/instrument-instance.ts` defines immutable Course and constituent-string configurations, tuning state, physical setup, notation identity, technique applicability, canonical browser/server SHA-256 identity, and exact sounding-set/range mechanics.
- Named French, Italian, and mixed five-course configurations distinguish the single chanterelle, doubled unisons, fourth-course octave/bourdon construction, and fifth-course bourdon construction. The profile text now agrees with those modeled pitches.
- `InstrumentModel` consumes the exact instance and exposes every string sounded by a stopped course. A position is no longer treated as one acoustic pitch.
- Principal-voice feasibility rejects a course position when another constituent string would sound above the intended melody. Transposition selection therefore considers the complete sounding set.
- Alfabeto retains historical chart/letter/shape identity while optionally returning the selected instance's distinct physical sounding set and digest. The MCP tool accepts a stringing selection and reports that set.
- Arrangement Search, Performance Brief snapshot, Arrangement Score, Audio Preview, engraving subtitle, edit validation, and search constraints retain the exact instance digest. Persistence rejects identity/content, Brief/Search, Search/Score, and Outcome lineage mismatch.
- Rasgueado, punteado, campanella, barré, and damping are separate applicability claims; mechanical availability does not claim passage suitability, comfort, or historical appropriateness.
- Arrangement Family identity no longer depends on a mutable whole-workspace Brief, so independently configured sibling targets remain in one family.

## Verification

- Exact-instance tests cover canonical digest verification, mutation identity, single/doubled courses, unisons, octave pairs, bourdons, re-entrant ranges, independent notation identity, technique applicability, alfabeto shape-versus-sound separation, and engraving identity.
- A Greensleeves differential runs unchanged source through French and Italian instances and proves distinct arrangement events, playback, engraving, and instance identities while preserving the Principal Voice audit.
- The real Arrangement Service test proves exact instance persistence through Brief, Search, execution identity, selected Score, reload, and tamper rejection.
- Full repository gates and evaluation evidence are recorded in `evidence/T20/verification.json`.

## Honest limits

- Historical configuration claims and physical behavior remain unreviewed by a specialist/player and therefore explicitly unknown at that authority level.
- Tracers 21–22 complete exact lute and classical-guitar instances; T23 adds baroque-guitar phrase-state technique evaluators; T29 implements dimension-specific stale-evidence propagation.

## Blocked by

- 19
