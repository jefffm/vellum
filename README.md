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
