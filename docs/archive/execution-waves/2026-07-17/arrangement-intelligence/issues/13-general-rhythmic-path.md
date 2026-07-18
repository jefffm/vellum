# General rhythmic source-to-deliverable path

Status: complete

Type: AFK

User stories: U2, U4

## What to build

Carry common rational duration and performed-form semantics from imported source through arrangement, engraving, and playback.

## Acceptance criteria

- [x] Tuplets, double dots, ties, and supported rational durations survive normalization and engraving.
- [x] Unsupported notation is detected before arrangement with precise source scope.
- [x] Repeats, endings, and navigation create Performed Form from imported evidence.
- [x] Notation and playback agree on exact canonical events and occurrences.

## Completion evidence

- MusicXML normalization retains exact performed rational duration separately from written duration, dots, and explicit tuplet group/ratio/boundary semantics. Ties survive as canonical event semantics.
- Arrangement engraving derives written notation from the source-linked canonical event, supports single through triple dots and arbitrary positive rational duration scaling, and emits balanced LilyPond tuplet groups and ties without changing playback time.
- Imported repeat barlines, numbered endings, Da Capo/Fine, Dal Segno, and To Coda evidence resolve to stable Performed Form measure occurrences and traversal decisions. Audio Preview consumes those occurrences rather than reconstructing form independently.
- Unsupported grace timing becomes a typed blocking notation issue with exact measure/event scope. The Arrangement Service refuses the source before planning or search with an unprocessable-content response.
- Workspace persistence validates Performed Form and notation-issue references, including occurrence identity uniqueness, before saving immutable transcription or normalization records.
- Focused MusicXML, rhythmic-gate, engraving, playback, workspace, and arrangement tests pass; the complete suite passes 959 tests with one explicitly skipped real-provider smoke.
- Retained machine-readable verification: `.scratch/arrangement-intelligence/evidence/T13/verification.json`.

## Blocked by

- 12
