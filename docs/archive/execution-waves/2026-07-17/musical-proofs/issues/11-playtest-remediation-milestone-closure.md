# 11 — Playtest remediation and milestone closure

Status: ready-for-agent

Type: AFK

Blocked by: 10

## What to build

Repair the direct PDF source-truth path exposed during T10. Audiveris may encode independent
upper- or lower-staff strands as separate MusicXML voices in one passage and as simultaneous chord
members in one voice in another. Vellum must reconstruct a stable voice graph before Principal
Voice selection. It must never silently treat every note in such a chordal container as melody.

Use the rights-approved Old Hundredth PDF as the public regression. Run its real Audiveris export
through production normalization and review, select the recommended upper Principal Voice, and
complete all three target arrangements without substituting LilyPond, ABC, hand-authored
MusicXML, or another reviewed source.

Configure the optical review threshold to 60% for this run. The threshold remains visible only
while OMR review is active, is persisted across reload, and never auto-accepts structurally
critical voice-identity uncertainty.

## Failure contract

The current failure is not ordinary bad fingering and should not be repaired in a target compiler.
For example, Audiveris exported the pickup's G4 soprano and D4 alto as two chord members in
`P1/voice 1`, while later measures sometimes used separate `voice 1` and `voice 2` streams. The
whole-container Principal Voice choice therefore contained simultaneous D4 and G4 events. Search
then received two principal obligations at one onset and exhausted rather than preserving the
recognizable top line.

The repair must:

1. reconstruct stable registral strands across MusicXML voice/chord representation changes;
2. preserve exact measure, onset, duration, staff, source-region, confidence, and provenance links;
3. recommend the upper strand as Principal Voice while retaining lower strands as accompaniment;
4. fail into readable, localized voice-identity review when crossings or missing evidence make
   automatic strand assignment genuinely ambiguous; and
5. reject malformed timing or impossible strand assignments before arrangement search.

## Deliberate non-goals

- No general-purpose OMR correction editor.
- No attempt to outperform Audiveris pitch recognition.
- No new certification, trust, release, or attestation framework.
- No baroque-guitar ornamentation or stylistic enrichment beyond preserving the currently accepted
  playable result.
- No broad MusicXML rewrite beyond the staff/voice/chord and temporal forms exercised by the real
  fixture plus focused malformed/ambiguous cases.

## Acceptance criteria

- [ ] A regression made from the preserved real Audiveris MXL proves the current whole-container
      Principal Voice contains simultaneous melody and inner-part events and cannot pass source-truth
      validation.
- [ ] A focused normalizer/voice-graph regression reconstructs the Old Hundredth soprano as the
      expected top-pitch sequence and keeps the alto, tenor, and bass available as subordinate strands.
- [ ] Chords that are genuinely one harmonic event remain chords; the repair does not split all
      simultaneous notes merely because they have different registers.
- [ ] Ambiguous crossings, absent staff/voice evidence, inconsistent durations, and overfull or
      underfull measures produce bounded review/blocker diagnostics instead of guessed truth.
- [ ] The optical threshold is 60% for a new PDF workflow, survives reload, is absent for non-OMR
      input, and cannot auto-accept critical voice-identity review.
- [ ] In Chrome, upload `test/fixtures/old-hundredth/old-hundredth-satb.pdf`, accept/review the real
      OMR evidence, choose the recommended upper Principal Voice, and generate three saved sibling
      arrangements without a source-format workaround.
- [ ] The direct-PDF Principal Voice is recognizably the source soprano in all three outputs; each
      arrangement passes its existing preservation audit, render evaluation, and playback evaluation.
- [ ] PDF, OMR, MXL, reconstructed strands, review decisions, normalized score, arrangements, and
      deliverables retain reloadable lineage.
- [ ] Existing accepted classical-guitar, lute, and baroque-guitar behavior remains passing.
- [ ] Remaining limitations are stated as concrete non-goals or honest incomplete cases; the
      milestone summary does not claim universal OMR, authenticity, or playability.

## Implementation seams

- `src/server/musicxml_normalize.py`: MusicXML staff/voice/chord event extraction and temporal
  validation.
- `src/server/lib/musicxml-normalizer.ts`: typed normalizer boundary and diagnostics.
- source-truth / Principal Voice analysis: consume reconstructed strands rather than assuming one
  MusicXML voice ID is one musical voice for the entire work.
- `src/guided-start.ts` and guided-workflow persistence: optical-only 60% threshold and localized
  voice review.
- Focused unit and browser tests should extend existing normalizer, OMR, workflow-recovery, and
  Old Hundredth fixtures rather than create a parallel pipeline.

## Gates

Focused first: MusicXML normalizer/OMR tests, source-truth/Principal Voice tests, Guided Start
recovery tests, and one browser regression using the real Old Hundredth PDF. Completion then runs
the base gates plus the real Audiveris smoke test, browser suite, three-target Golden/parity
evaluation, LilyPond sandbox verification, render evaluation, and playback evaluation.

## Stopping condition

This tracer is complete when the same real PDF that failed during T10 creates the three accepted
target formats through the normal product path and survives reload. Do not add adjacent knowledge,
rights, evaluator, or stylistic work to make the tracer look more comprehensive.
