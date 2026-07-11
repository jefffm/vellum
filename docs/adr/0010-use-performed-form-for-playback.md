# Use Performed Form and Playback Occurrences for Audio Preview

Vellum Audio Preview will project the literal Arrangement Score through an explicit Performed Form rather than treating written measure order as the only possible timeline. A Performed Form stores ordered measure occurrences and the traversal decisions produced from repeats, endings, da capo or dal segno instructions, codas, and fine. Each sounding pitch becomes a distinct Playback Occurrence linked to its canonical Arrangement Event, source events, Transformation Report entries, Preservation Targets, performed-measure occurrence, and iteration.

## Considered options

- Schedule visible notation or exported MIDI and infer identity from pitch and time
- Flatten repeats into copied canonical events
- Keep canonical score events singular and project them into explicit Playback Occurrences

## Consequences

Literal preview uses the same Arrangement Score pitches, durations, tempo, and course-dependent sounding octaves as engraving and MIDI generation without creating playback duplicates for staff-plus-tablature layouts. Repeated events receive distinct occurrence identities while canonical musical lineage remains singular. A reproducible traversal decision list supports arbitrary repeat, ending, segno, coda, and jump structures once an importer supplies the resolved Performed Form.

Practice State is temporary. Speed, loop bounds, part mute/solo/level, master volume, seeking, and “skip repeats” alter only the browser playback projection. “Skip repeats” retains the first occurrence of each written measure and rebuilds a condensed timeline without changing the Normalized Score, Arrangement Score, Performed Form, audit, MIDI, or Deliverables. Reset restores literal full-form playback.

The workbench provides play, pause, stop, progress, seek, volume, speed, loop, and semantic-part mixer controls. Selecting an Analysis Claim, Transformation Report entry, or Preservation Audit target seeks to its first matching Playback Occurrence. During playback the same stable lineage dimensions highlight simultaneously active diagnostic entries. Candidate previews use the same player and remain on demand.
