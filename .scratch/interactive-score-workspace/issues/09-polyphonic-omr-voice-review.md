# Polyphonic OMR Voice Identity review

Status: ready-for-agent

Type: AFK

## What to build

Detect when optical recognition may have flattened independent voices into chords or otherwise lost voice identity. Before Musicological Analysis proceeds, open Score-Anchored Review with source evidence, recognized voices, confidence, and ranked corrections. Accepted corrections create a new Score Transcription version.

## Acceptance criteria

- [ ] OMR ingestion records explicit uncertainty about voice count and voice assignment.
- [ ] Suspicious SATB-to-chord flattening blocks authoritative Principal Voice analysis.
- [ ] Review presents source region, recognized notation, voice alternatives, and musical consequence.
- [ ] Corrections are versioned and deterministic normalization/analysis resumes from the corrected transcription.
- [ ] A polyphonic fixture guards against the failure observed in the live Greensleeves workflow.

## Blocked by

- Tracer 07.
