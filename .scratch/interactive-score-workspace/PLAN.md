# Interactive Score Workspace execution plan

Status: in-progress

## Outcome

Make the engraved score the central interactive surface of Vellum: users can select musical objects, ask context-aware questions, stage and save manual edits as one immutable version, and follow playback through linked notation and source evidence.

## Execution rules

- Execute tracer bullets in numeric order unless their dependency section permits parallel work.
- Each tracer must produce a demoable user path, not a horizontal subsystem.
- Run typecheck, the complete test suite, formatting, and relevant rendered-output checks for every tracer.
- Commit and push every completed tracer before starting the next one.
- Preserve canonical musical identity in Arrangement Scores; SVG, PDF, Audio Preview, and UI state remain projections.

## Tracer bullets

1. **Event-anchored interactive notation** — connect one engraved note to its Arrangement Event, selection state, and playback seek.
2. **Multi-object Selection Context** — select note groups and send exact structured musical context into chat.
3. **Atomic Edit Batch** — stage several manual edits and save them as one new Arrangement Score version with commitments and audit.
4. **Version-aware score refresh and history** — immediately display the new version and compare it with its parent.
5. **Score-following playback** — visible playhead, sounding-note highlighting, active-measure following, and notation-to-seek.
6. **Inline validation and repair** — preview playability and preservation consequences before committing an edit batch.
7. **Bidirectional Source Lineage** — reveal the selected arrangement passage beside its linked source facsimile and transcription evidence.
8. **Passage-level Candidate Adoption** — audition and adopt a candidate for a selected region as a versioned edit.
9. **Polyphonic OMR Voice Review** — detect uncertain voice flattening and require score-anchored review before analysis.
10. **Workspace and Arrangement Family navigation** — recent projects, sibling targets, branches, versions, and stale status.
11. **Owner Knowledge and Personal Defaults workbench** — inspect, approve, correct, and release accumulated knowledge and defaults.
12. **Versioned Performance Interpretation** — add optional stylistic playback without changing the Arrangement Score or literal preview.

## Definition of done

The complete wave is done when the Greensleeves fixture can be opened, its opening phrase selected, discussed with Vellum using structured selection context, edited in several places, saved as one audited Arrangement Score version, compared with its parent, and played while the score and linked source follow the current Playback Occurrence. The remaining navigation, OMR review, knowledge, and interpretation tracers must also be independently demonstrated and covered by production-path tests.
