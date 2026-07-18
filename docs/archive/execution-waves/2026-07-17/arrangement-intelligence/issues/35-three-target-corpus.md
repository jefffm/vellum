# Three-target Golden corpus

Status: complete

Type: AFK

User stories: U4, U6, U8

## What to build

Create a legally reusable, held-out-aware fixture corpus that exposes real musical and target-specific failures rather than one showcase output.

## Acceptance criteria

- [x] Every fixture retains source and license provenance, reviewed truth, Analysis, Plans, invariants, and mutations.
- [x] Greensleeves supplies a shared cross-target case without becoming the sole target evidence.
- [x] Lute and classical-guitar fixtures exercise their distinct mechanics and musical planning.
- [x] Reference arrangements remain evidence and alternatives rather than exact required output.

## Delivered

- A typed, digest-verified held-out corpus manifest contains one shared Greensleeves case and distinct baroque-guitar, 13-course lute, and classical-guitar cases.
- Every case records reusable source provenance, reviewed musical truth, Analysis concepts, independent target Plans, acceptable-boundary invariants, scoped mutations, and two non-exclusive reviewed-valid alternatives.
- The baroque-guitar study covers exact French stringing, chart-cited alfabeto role, and the observed course-5 fret-6 to course-2 fret-1 counterexample.
- The lute study combines stopped-course upper material with open diapasons and retains the course-10 D2/`///a` notation-playback contract.
- The classical-guitar study is genuine two-voice polyphony, with independent duration and modeled six-single-string fingering boundaries in standard notation.
- Generator-visible projection excludes reviewed truth, Analysis expectations, Plans, invariants, mutations, and alternatives.
- A private-fixture export boundary requires a digest, reusable license, deliberate selection, privacy review, and review reference; no private export is present in the repository corpus.
- `eval:golden` now loads all corpus cases, proves both alternatives satisfy their common boundaries, proves every scoped mutation violates its named boundary, and retains the existing end-to-end first-loop run.

## Verification

- Corpus tests verify schema, source/provenance digests, held-out separation, three-target coverage, target-specific concepts, alternative-valid-output behavior, mutation sensitivity, source drift, dangling refs, missing Plans, and private-export enforcement.
- LilyPond compilation verifies the new baroque-guitar and polyphonic classical-guitar sources plus the revised CC0 lute source.
- Full gates and exact dependency hashes are recorded in `evidence/T35/verification.json`.

## Honest limits

- Corpus alternatives are reviewed boundary descriptions, not claims that every musically valid alternative has been enumerated.
- Machine validation establishes model/schema mechanics and mutation sensitivity, not physical playability, historical authority, visual editorial quality, audible quality, or Owner usefulness; those remain explicitly late human evidence.
- T36 executes the complete three-target workflow and Evaluation Cards. T35 supplies the licensed evaluator-side corpus and command contract without pretending static cases are generated arrangements.

## Blocked by

- 24
- 25
- 27
- 33
- 34
