# Vellum

**ve*LLM*um** — an AI music desk for historical plucked strings.

Vellum helps arrange music for baroque lute, baroque guitar, Renaissance lute, theorbo, classical guitar, piano, and voice. Its Musicological Engine combines symbolic analysis, reviewed knowledge, model-assisted judgment, and constraint checks for source fidelity, frets, courses, mechanically valid voicings, alfabeto chords, notation, and rendered output.

## How is it?

It's ... okay! Models don't seem to spend much training time on baroque guitar repertoire, and hallucinate wildly when you ask it to do things outside the training set (even SOTA models like GPT 5.5).

However, because there's a harness of deterministic tooling, it stays very much on-the-rails and makes somewhat plausible arrangements.

I would call this "research quality" at best! Maybe I'll train a custom model for this someday.

## Demo

[![Greensleeves arranged by Vellum for voice and 5-course baroque guitar](./greensleeves_bg.png)](https://youtu.be/D3I8bT7nllc)

_“Greensleeves” for soprano and 5-course baroque guitar, engraved with Vellum using historical alfabeto chord shapes. Click the image to watch the demo video. Based on the Mutopia Project source: [`greensleeves_guitar.ly`](https://www.mutopiaproject.org/ftp/Traditional/greensleeves_guitar/greensleeves_guitar.ly)._

## What Vellum does

- Finds valid pitch → course/fret positions with `tabulate`
- Enumerates mechanically valid chord shapes with `voicings`
- Looks up historical baroque-guitar alfabeto with `alfabeto_lookup`
- Validates stretches, ranges, and fingering conflicts with `check_playability`
- Generates LilyPond from structured music data with `engrave`
- Compiles LilyPond to SVG/PDF with structured error feedback via `compile`
- Analyzes MusicXML, transposes, checks voice-leading, and renders fretboard diagrams

## Why it exists

Language models can be useful musical collaborators, but neither model memory nor mechanical validation alone is enough for informed arrangement. Vellum keeps musical evidence, historical practice, creative judgment, and instrument constraints in one inspectable workflow. The current prototype produces preserved, mechanically checked, engraved candidates; the current specification governs the work required before Vellum may make stronger idiomatic or physical-playability claims.

The default result now includes a short Musicological Analysis summary. Expanding it reveals passage-by-passage textures and contrapuntal techniques, score-anchored claims with evidence and confidence, historically scoped profiles, and alternative interpretations. Corrections are durable new analysis versions, so an Owner can teach Vellum what this particular source means without silently rewriting the prior reading.

Each result also exposes complete provenance: every source event, protected relationship, omission, transposition, octave move, revoicing, reharmonization, rhythm change, and generated event is classified and linked to its arrangement descendants. Continuo figures and the material generated from them remain visibly distinct.

Audio Preview is a literal synthetic check of that same Arrangement Score. It follows a reproducible Performed Form, gives repeats distinct Playback Occurrences, and provides pause, seek, progress, volume, speed, looping, skip-repeats practice playback, and mute/solo/level controls for semantic musical parts. Analysis, audit, and provenance entries seek into the linked playback timeline.

Continuo output is labeled by what actually sounds. Capable targets produce a complete realization; an incapable re-entrant baroque guitar can be paired with an explicit separate bass. The competing Continuo Reduction discloses every unsounded foundation event and is rejected under Faithful Reduction rather than passing on implied harmony.

Multiple targets from one brief form an explicit Arrangement Family while remaining independently searched and audited musical solutions. Every PDF, browser preview, MIDI file, LilyPond source, and literal Audio Preview is a content-addressed Deliverable tied to one exact Arrangement Score version and Notation Layout, so recompilation cannot blur musical lineage.

## Quick start

```bash
nix develop
npm install
npm run dev:all
```

This one supervised command builds and watches the API, restarts it after changes, waits for an exact browser/API schema match, then starts Vite. If any child fails, all children shut down together. `VELLUM_DEV_API_PORT` and `VELLUM_DEV_WEB_PORT` override the loopback development ports.

Then open the Vite URL and use Vellum's first-run **Connect ChatGPT** flow. API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `VELLUM_LLM_API_KEY`) remain fallback configuration for providers that need them. Vellum owns its credentials and does not import Pi or Codex login files.

### Local API trust boundary

The API binds `127.0.0.1` by default. `VELLUM_SERVER_HOST` may select another
numeric loopback address such as `::1`; wildcard, LAN, and hostname binds are
rejected before the server starts. Browser API requests are accepted only from
the exact loopback origin in `VELLUM_FRONTEND_ORIGIN`, which defaults to
`http://127.0.0.1:5173`. Trusted local CLI and native clients may omit `Origin`.
Unknown, malformed, and `null` browser origins are actively rejected.

Authenticated remote access is intentionally unavailable until a focused ADR
defines its transport and authorization boundary. Setting a non-loopback host
does not silently expose the Owner's workspaces, provider connection, or local
tool execution.

On macOS, Vellum stores ChatGPT authorization in Keychain. Set `VELLUM_PROVIDER_CREDENTIAL_STORE=file` only when you explicitly need the atomic, permission-restricted local fallback.

### Isolated notation compiler

Vellum treats LilyPond source as executable input because LilyPond embeds Guile. Browser and arrangement compilation therefore fail closed unless Podman is running and the pinned compiler image is installed. No host LilyPond fallback is used for externally influenced source.

```bash
podman machine start
podman pull --platform linux/amd64 docker.io/codello/lilypond@sha256:e9aeee661e40f9cd4b7cd573e3787f09abc52858b074e03ba04c2e17326b69f4
npm run sandbox:lilypond:verify
```

Each compile uses a disposable container with no network, no inherited secrets, no writable host path, a read-only root, dropped capabilities, and bounded CPU, memory, processes, duration, source, logs, and artifacts. Only `instruments/` and `templates/` are mounted read-only. `VELLUM_LILYPOND_IMAGE` may select another digest-pinned image for controlled testing; mutable tags are not an acceptable production configuration.

The deterministic fake-provider contract suite runs in ordinary tests. To opt into the real ChatGPT subscription lifecycle smoke test (it opens the authorization page twice and never prints tokens, callback parameters, or model content), run:

```bash
VELLUM_REAL_CHATGPT_SMOKE=1 npm test -- --run src/server/lib/provider-connection.real-smoke.test.ts
```

### PDF arrangement tracer bullet

The **New arrangement** control opens Guided Start. Upload an arbitrary score PDF; choose any compatible combination of five-course baroque guitar, 13-course baroque lute, six-course Renaissance lute, six-string classical guitar, and soprano-plus-piano continuo; and optionally add a plain-language instruction. Vellum then:

1. saves the PDF unchanged in a local, versioned arrangement workspace;
2. runs OMR through the backend-neutral recognition boundary;
3. saves the recognized and normalized score with source regions and uncertainty records;
4. pauses on Critical Uncertainty in Score-Anchored Review, focusing the exact Audiveris source-raster region (with the immutable PDF as a fallback) beside editable recognized notation and evidence-backed alternatives, then saves accepted corrections as a new transcription version;
5. identifies and protects the Principal Voice;
6. searches and audits an independent target reduction for every selected instrument while sharing the reviewed source analysis and disclosing unevaluated idiom or ergonomics;
7. engraves the requested output - French letter tablature, classical-guitar standard notation, or a figured-bass continuo score - and creates a literal synthesized Audio Preview with isolatable semantic parts.

Completed Arrangement Searches and all candidates are durable. Reopen an arrangement with `?workspace=<workspace-id>&arrangement=<arrangement-id>` to compare its ranked evidence, audition an unselected candidate on demand, or branch from that candidate without replacing the selected score.

[Audiveris](https://audiveris.github.io/audiveris/_pages/guides/advanced/cli/) must be installed for arbitrary PDF recognition. Vellum discovers the standard macOS application automatically, otherwise uses `audiveris` on `PATH`; `VELLUM_AUDIVERIS_COMMAND` overrides either location. Vellum requires both the native `.omr` project and exported MusicXML: the former supplies symbol bounds and recognition grades, while the latter supplies the interchange score. If Audiveris is unavailable or omits its native project, the source and Arrangement Brief remain saved and Vellum reports the incomplete run without pretending that recognition succeeded. Checked-in public-domain fixtures include reviewed canonical truth plus a production-derived Audiveris 5.10.2 evidence pair, so arrangement regressions and evidence extraction can be tested independently of local OMR drift.

The lute path currently defaults in the editor to a 13-course D-minor-tuning configuration, supports key-specific diapason retuning, and preserves course identity independently from pitch: course 10 is engraved as `///a` and sounds D2 in both the D-minor and D-major bass schemes. This editor default is not claimed as one universal historical standard. Course 13 currently uses `6` as a software convention rather than a source-backed historical claim; the current specification requires explicit disclosure and configurable notation identity. The classical-guitar path uses standard EADGBE tuning and a single `treble_8` staff, so its PDF contains standard notation without tablature and its MIDI has one playback source. Each selected instrument gets an independent arrangement search and Preservation Audit while sharing the same reviewed source analysis.

For a source containing an explicit Continuo Foundation, the soprano-plus-piano path preserves every bass event, figure, and accidental under the `continuo.italian-baroque` Realization Profile. Its contextual validator recognizes prepared dissonance such as a source-supported `4-3` suspension instead of applying blanket counterpoint prohibitions. Principal Voice, Continuo Foundation, and generated realization remain separately audible, and the compiled MIDI is derived from the same semantic events as the engraved score.

For imitative polyphony, Vellum does not invent a permanent Principal Voice. It detects ordered entries with a shared interval-rhythm shape, protects every source voice and cadential goal, searches collision-free six-course assignments, and audits the resulting French-letter intabulation under `counterpoint.renaissance-imitative`. Three rhythm lanes keep each lineage readable above the shared tablature staff without duplicating MIDI playback, and Audio Preview can isolate every source voice.

Preservation Audits recompute protected musical relationships from the selected Arrangement Score. Adversarial regression tests prove that altered melody timing, order, phrase contour, cadential placement, imitative entry shape or order, voice lineage, and prepared `4-3` suspension treatment produce hard failures rather than descriptive success messages.

## Stack

- TypeScript + Vite browser UI
- `pi-agent-core` / `pi-web-ui` for the chat agent interface
- Express API server
- LilyPond for engraving
- music21 for analysis helpers
- Nix dev shell with Node, Python, and LilyPond

## Docs

- [SPEC.md](./SPEC.md) — sole current implementation specification
- [CONTEXT.md](./CONTEXT.md) — domain language and enduring invariants
- [Accepted ADRs](./docs/adr/) — governing architecture decisions
- [Specification archive](./docs/archive/specifications/) — non-current design and execution history
