# Event-anchored interactive notation

Status: complete

Type: AFK

## What to build

Create the narrowest complete Lineage Navigation path through engraving and the workbench. One rendered notation object must carry the stable identity of its Arrangement Event. Clicking it selects it, exposes a concise musical summary, and seeks Audio Preview to the first matching Playback Occurrence. The mapping must survive recompilation and must not rely on matching MIDI pitch or page coordinates alone.

## Acceptance criteria

- [x] Compiled browser notation exposes stable Arrangement Event and measure identities for selectable sounding objects.
- [x] Clicking a selectable object produces a visible selection and a summary containing pitch, duration, musical role, measure, and course/fret where applicable.
- [x] Clicking the object seeks Audio Preview through its Arrangement Event identity.
- [x] Selection remains a UI projection and does not mutate the Arrangement Score.
- [x] The Greensleeves production-path fixture proves the opening Principal Voice event maps to the correct glyph and Playback Occurrence.
- [x] PDF remains a downloadable Deliverable; interactive behavior uses the browser notation projection.

## Blocked by

None - can start immediately.
