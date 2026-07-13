# Owner scope decision: prototype baseline closeout

Date: 2026-07-13

Decision: accept the implemented Arrangement Intelligence work as a prototype baseline and close the wave without collecting every formal T41–T43 role-scoped attestation.

This is an Owner scope decision, not synthetic human evidence. It does not establish independent physical playability, historical appropriateness, engraving quality, or baseline approval. Those dimensions remain unknown wherever no conforming attestation exists.

## Accepted value

- The local-first source-to-arrangement workflow, versioned musical lineage, exact Instrument Instances, bounded arrangement search, evaluation infrastructure, workbench interaction, notation, playback, and three-target prototype paths are useful foundations for continued work.
- ADRs 0016–0021 are accepted as the prototype architecture baseline. They may be revised when follow-up implementation and evidence expose better boundaries.
- Machine verification and a real PDF-upload functional smoke test remain required before T45 may close the wave.

## Known limitations carried forward

### Five-course baroque guitar

The current Greensleeves realization does not yet establish historically idiomatic punteado, rasgueado, or mixed-style writing. Larger chords require explicit alfabeto-compatible strumming decisions and must not be treated as arbitrary computed multi-finger grips.

### Thirteen-course baroque lute

The current search does not model scale-length-aware physical reach. The Greensleeves measure-3 `f/b` sonority spans frets 1–5 and is rejected for the Owner's 690 mm lute. Equivalent contextual alternatives such as `f/e` and `a/b` must enter phrase search, and the exact Owner Instrument Instance must record 690 mm rather than inherit the 680 mm default.

### Six-string classical guitar

The current Greensleeves artifact preserves the Principal Voice but retains only four source-bass events. It therefore does not establish a coherent two-voice arrangement. Target Voice Plans, phrase-level bass design, joint voice/instrument search, voice-aware engraving and playback, and output-based polyphonic evaluation are follow-up work.

## Staleness and future claims

The T40 review packages remain inspection artifacts for the exact pinned bytes. Any source, Brief, policy, Instrument Instance, arrangement, evaluator, or review-protocol change makes their review identity stale. Production readiness, calibrated playability, historical authority, and promoted-baseline claims still require the role-scoped evidence waived here.
