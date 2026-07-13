# Scale-aware thirteen-course-lute ergonomic compiler

Status: ready-for-agent

Type: AFK

## Tracer

Bind the Owner's 690 mm thirteen-course D-minor lute as an exact Instrument Instance and regenerate the Greensleeves measure-3 region. Search all equivalent course assignments, reject the `f/b` fret-1-to-fret-5 span under the Owner Ergonomic Profile, and compare the context-preserving `f/e` and first-position `a/b` alternatives across the phrase boundary.

## Acceptance criteria

- Exact scale length determines physical fret positions and simultaneous reach distance.
- Left-hand search uses satisfiable finger assignments, span, hand position, common fingers, and transition context rather than clamped annotations.
- Stopped-course reach, diapason preparation/access, resonance, and damping remain distinct constraints.
- Alternative course assignments are complete within declared bounds and retained in candidate evidence.
- French tablature keeps `a`, `/a`, `//a`, `///a`, `4`, `5`, `6` diapason identity under the exact instance.
- The rejected `f/b` grip fails an output-level regression; a phrase-level alternative passes without damaging the Principal Voice.
