# Idiomatic five-course baroque-guitar phrase compiler

Status: ready-for-agent

Type: AFK

## Tracer

Regenerate the reviewed Greensleeves phrase under explicit punteado, rasgueado, and mixed-style candidates. Punteado respects the applicable right-hand finger model and simultaneous-note limits. Rasgueado and mixed-style events use valid alfabeto shapes and contiguous strumming courses, with intentionally skipped edge courses represented explicitly.

## Acceptance criteria

- Research-backed Knowledge Packs define applicable technique vocabulary, mechanics, source scope, confidence, and consequences without presenting one historical practice as universal.
- The existing alfabeto library is wired through MCP lookup, engrave events, search, prompt guidance, playback, and output evaluation.
- Punteado rejects non-idiomatic oversized simultaneous grips.
- Rasgueado never silently skips an interior course; edge-course omissions and stroke direction are explicit.
- Mixed-style search plans technique changes across phrases rather than labeling computed chords after generation.
- Greensleeves preserves its Principal Voice while the selected accompaniment is a coherent declared technique realization.
- Audio Preview and engraving distinguish plucked notes from strummed alfabeto events.
