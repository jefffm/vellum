# 10 — Owner three-target playtest

Status: completed

Type: HITL

Blocked by: 09

## What to review

Play and inspect the exact generated artifacts for all three priority instruments. Record
score-anchored findings for playability, idiom, voice coherence, notation, playback, explanation,
and usefulness. This is one practical product review, not a certification or historical attestation.

## Acceptance criteria

- [x] Baroque-guitar findings distinguish punteado, rasgueado, alfabeto, and mixed-style behavior.
- [x] Lute findings cover reach, shifts, right hand, diapasons, and tablature readability.
- [x] Classical-guitar findings cover Principal Voice, bass coherence, joint fingering, and notation.
- [x] Shared findings cover source recognizability, phrase/cadence fidelity, editing, and playback following.
- [x] Every nonpassing finding names a score location, observed problem, and desired musical outcome.
- [x] The Owner records whether the workflow is useful enough for continued real arranging.

## Recorded outcome

- Six-string classical guitar: accepted as good.
- Five-course baroque guitar: accepted as playable. A richer idiomatic treatment could add
  ornament, texture, and mixed-style interest, but that is a deferred enhancement rather than a
  blocker for this milestone.
- Thirteen-course baroque lute: accepted.
- The three generated scores were readable and recognizable enough to justify continued real
  arranging.
- The direct optical route did not produce the reviewed source used for these accepted outputs.
  Audiveris represented independent upper-staff strands inconsistently: sometimes as separate
  MusicXML voices and sometimes as chord members in one voice. Selecting that whole recognized
  voice therefore selected both the melody and an inner part at the same onset, which left the
  arranger without a valid single Principal Voice event. The accepted artifacts used a reviewed
  LilyPond transcription of the same rights-approved fixture as a temporary source-truth bridge.

The only milestone-blocking remediation is the optical source-to-voice reconstruction defect.
Baroque-guitar enrichment remains a follow-up product improvement after the direct-PDF path is
honest and reliable.

## Gates

No automated gate substitutes for the physical playtest. Existing test results and exact artifacts
must be available during review.
