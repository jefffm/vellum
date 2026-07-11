# Vellum

**ve*LLM*um** — an AI music desk for historical plucked strings.

Vellum helps arrange music for baroque lute, baroque guitar, Renaissance lute, theorbo, classical guitar, piano, and voice. Its Musicological Engine combines symbolic analysis, historical knowledge, model-assisted judgment, and constraint checks for source fidelity, frets, courses, playable voicings, alfabeto chords, notation, and rendered output.

## How is it?

It's ... okay! Models don't seem to spend much training time on baroque guitar repertoire, and hallucinate wildly when you ask it to do things outside the training set (even SOTA models like GPT 5.5).

However, because there's a harness of deterministic tooling, it stays very much on-the-rails and makes somewhat plausible arrangements.

I would call this "research quality" at best! Maybe I'll train a custom model for this someday.

## Demo

[![Greensleeves arranged by Vellum for voice and 5-course baroque guitar](./greensleeves_bg.png)](https://youtu.be/D3I8bT7nllc)

_“Greensleeves” for soprano and 5-course baroque guitar, engraved with Vellum using historical alfabeto chord shapes. Click the image to watch the demo video. Based on the Mutopia Project source: [`greensleeves_guitar.ly`](https://www.mutopiaproject.org/ftp/Traditional/greensleeves_guitar/greensleeves_guitar.ly)._

## What Vellum does

- Finds valid pitch → course/fret positions with `tabulate`
- Enumerates playable chord shapes with `voicings`
- Looks up historical baroque-guitar alfabeto with `alfabeto_lookup`
- Validates stretches, ranges, and fingering conflicts with `check_playability`
- Generates LilyPond from structured music data with `engrave`
- Compiles LilyPond to SVG/PDF with structured error feedback via `compile`
- Analyzes MusicXML, transposes, checks voice-leading, and renders fretboard diagrams

## Why it exists

Language models can be useful musical collaborators, but neither model memory nor mechanical validation alone is enough for informed arrangement. Vellum keeps musical evidence, historical practice, creative judgment, and instrument constraints in one inspectable workflow that produces checked, playable, engraved music.

## Quick start

```bash
nix develop
npm install
npm run server:build
npm run server
```

In another shell:

```bash
nix develop
npm run dev
```

Then open the Vite URL and use Vellum's first-run **Connect ChatGPT** flow. API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `VELLUM_LLM_API_KEY`) remain fallback configuration for providers that need them. Vellum owns its credentials and does not import Pi or Codex login files.

### PDF arrangement tracer bullet

The **New arrangement** control opens Guided Start. Upload an arbitrary score PDF; choose any combination of five-course baroque guitar, 13-course baroque lute, and six-string classical guitar; and optionally add a plain-language instruction. Vellum then:

1. saves the PDF unchanged in a local, versioned arrangement workspace;
2. runs OMR through the backend-neutral recognition boundary;
3. saves the recognized and normalized score with source regions and uncertainty records;
4. pauses on Critical Uncertainty in Score-Anchored Review, focusing the immutable PDF region beside editable recognized notation and ranked alternatives, then saves accepted corrections as a new transcription version;
5. identifies and protects the Principal Voice;
6. searches and audits an independent playable reduction for every selected target while sharing the reviewed source analysis;
7. engraves the requested output - French letter tablature for the historical instruments or standard notation for classical guitar - and creates a literal synthesized Audio Preview with isolatable Principal Voice and accompaniment parts.

[Audiveris](https://audiveris.github.io/audiveris/_pages/guides/advanced/cli/) must be available as `audiveris` on `PATH` for arbitrary PDF recognition. If it is unavailable, the source and Arrangement Brief remain saved and Vellum reports the missing backend without pretending that recognition succeeded. The checked-in public-domain Greensleeves fixture provides deterministic reviewed truth so arrangement and engraving tests do not drift with OMR versions.

The lute path uses the historical default 13-course D-minor tuning, supports key-specific diapason retuning, and preserves course identity independently from pitch: course 10 is engraved as `///a` and sounds D2 in both the D-minor and D-major bass schemes. The classical-guitar path uses standard EADGBE tuning and a single `treble_8` staff, so its PDF contains standard notation without tablature and its MIDI has one playback source. Each selected instrument gets an independent arrangement search and Preservation Audit while sharing the same reviewed source analysis.

## Stack

- TypeScript + Vite browser UI
- `pi-agent-core` / `pi-web-ui` for the chat agent interface
- Express API server
- LilyPond for engraving
- music21 for analysis helpers
- Nix dev shell with Node, Python, and LilyPond

## Docs

- [SPEC.md](./SPEC.md) — full architecture and tool design
- [ALFABETO-SPEC.md](./ALFABETO-SPEC.md) — historical baroque-guitar chord lookup
- [HISTORICAL-RENDERING-SPEC.md](./HISTORICAL-RENDERING-SPEC.md) — engraving goals
