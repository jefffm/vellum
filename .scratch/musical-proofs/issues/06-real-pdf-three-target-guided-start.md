# 06 — Real PDF to three target outputs

Status: ready-for-agent

Type: AFK

Blocked by: 03, 04, 05

## What to build

Exercise Guided Start with a real rights-approved PDF and Audiveris evidence, then create and
save all three target arrangements from the same reviewed transcription. Repair workflow loops,
conditional OCR controls, review visibility, recovery, and cross-target lineage encountered on
that path.

## Acceptance criteria

- [ ] PDF bytes, OMR evidence, MusicXML, transcription versions, corrections, and source regions remain linked.
- [ ] The confidence threshold appears only for OMR input and is adjustable before acceptance.
- [ ] Review crops are readable, zoomable, and unobscured by overlays.
- [ ] Completing OCR review advances to analysis or an honest non-OCR blocker without looping.
- [ ] All three independently planned target arrangements are saved from one reviewed source version.
- [ ] Reload resumes the exact durable workflow state.

## Gates

Base gates, browser suite, one real Audiveris smoke test, cross-target evaluations, render, and playback.
