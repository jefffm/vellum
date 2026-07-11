# Score-following Audio Preview

Status: ready-for-agent

Type: AFK

## What to build

Project current Playback Occurrences back onto interactive notation. During playback, highlight all sounding events, distinguish the Principal Voice, mark the active measure, and keep it visible. Clicking notation seeks playback; repeated measures use occurrence identity so the marker follows the correct performed iteration.

## Acceptance criteria

- [ ] Playback shows a visible position marker and sounding-event highlights on notation.
- [ ] Principal Voice highlighting is distinguishable without hiding simultaneous accompaniment.
- [ ] The viewport follows the active measure without disruptive jumping.
- [ ] Clicking notation seeks to its first matching occurrence and selection can define a loop range.
- [ ] Repeat iterations retain distinct Playback Occurrences while sharing canonical Arrangement Event identity.
- [ ] Pause, seek, speed, skip-repeats, and stop keep score state synchronized.

## Blocked by

- Tracer 01.
