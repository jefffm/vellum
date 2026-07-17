# 07 — Interactive revision and score-following playback

Status: ready-for-agent

Type: AFK

Blocked by: 02

## What to build

Let the Owner select multiple score events, use that anchored selection in a revision prompt,
perform supported manual edits, and save either operation as a new Arrangement Score version.
During playback, follow the rendered score with a restrained marker that does not obscure notation.

## Acceptance criteria

- [ ] Multi-note selection persists as explicit score-event IDs and is visible without covering glyphs.
- [ ] Prompted feedback receives the exact selection and returns a proposed score-anchored change.
- [ ] Supported manual edits validate before commit.
- [ ] A batch commit creates a child version with rationale and recomputed audit; cancel leaves the parent unchanged.
- [ ] Playback marker follows, seeks, pauses, and resumes against the rendered score without obscuring tablature or notation.
- [ ] Prior and new versions can be reopened and compared.

## Gates

Base gates plus browser, render, and playback suites.
