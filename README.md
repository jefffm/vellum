# Vellum

**Upload a score. Choose an instrument. Get a playable arrangement you can read, hear, inspect,
and revise.**

Vellum is a personal musicologist and practical arranger for instruments ordinary AI understands
poorly. It reads the source, identifies the voices and musical relationships that matter, adapts
them to the target instrument's real mechanics and idiom, and produces an engraved score with
playback and an explanation of every compromise. You should not need to know which historical
technique, counterpoint rule, or fingering constraint to put in the prompt.

- **Source in:** PDF, image, MusicXML, LilyPond, ABC, MEI, or MSCZ
- **Arrangement out:** engraved PDF, versioned score, and synchronized Audio Preview
- **Built for:** musicians who want expert defaults without losing expert-level inspection

The arrangement engine treats three targets as coequal:

- five-course baroque guitar in French letter tablature;
- thirteen-course baroque lute in French letter tablature; and
- six-string classical guitar in standard notation.

## Demo

[![Greensleeves arranged by Vellum for voice and five-course baroque guitar](./greensleeves_bg.png)](https://youtu.be/D3I8bT7nllc)

_“Greensleeves” for soprano and five-course baroque guitar. Click the image to watch the demo._

## What works

- Upload PDF or image scores through Audiveris, or import MusicXML, restricted LilyPond, ABC, MEI,
  or MSCZ.
- Review uncertain recognition against the exact source region and save corrections as a new
  transcription version.
- Identify a Principal Voice and preserve its phrase, cadence, timing, and lineage under Faithful
  Reduction.
- Generate independently searched sibling arrangements for any combination of the three primary
  targets.
- Apply target-specific mechanics: five-course guitar technique and alfabeto, calibrated lute
  reaches and diapasons, and coherent classical-guitar voice planning.
- Produce PDF, browser preview, LilyPond, MIDI, and a synthesized Audio Preview from the same saved
  Arrangement Score.
- Follow playback in the rendered score, loop and seek, and mute or solo semantic musical parts.
- Select notes for score-anchored prompting, make supported manual edits, and save a batch as a new
  immutable arrangement version.
- Inspect the Musicological Analysis, Transformation Report, Preservation Audit, alternatives,
  uncertainty, and source-to-output provenance.
- Add reviewed, cited local knowledge without silently changing existing arrangements.

Experimental Renaissance-lute and continuo routes also exist, but they are not part of the current
three-target acceptance boundary.

## Quick start

### Prerequisites

- Node.js 20.19 or newer and npm
- [Podman](https://podman.io/) for isolated LilyPond compilation
- [Audiveris](https://audiveris.github.io/audiveris/) for PDF and image recognition
- Nix only when you want the pinned development and musical-tool environment

On macOS, install Audiveris as `/Applications/Audiveris.app`. Other installations may expose an
`audiveris` executable on `PATH`.

### Start Vellum

```bash
npm install
podman machine start
podman pull --platform linux/amd64 docker.io/codello/lilypond@sha256:e9aeee661e40f9cd4b7cd573e3787f09abc52858b074e03ba04c2e17326b69f4
npm run sandbox:lilypond:verify
npm run dev:all
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). `dev:all` watches and restarts the API,
waits for the browser/API schema to agree, and then starts Vite.

Use **Connect ChatGPT** in Guided Start to authorize Vellum with a ChatGPT subscription. On macOS,
the authorization is stored in Keychain. `OPENAI_API_KEY` or `VELLUM_LLM_API_KEY` can provide a
fallback provider credential.

## Create an arrangement

1. Choose **New arrangement**.
2. Upload a score and select one or more output formats.
3. For optical input, set the confidence threshold and review only the uncertain or structurally
   important readings.
4. Confirm the source voice interpretation when Vellum cannot establish it safely.
5. Let each selected target build and audit its own arrangement.
6. Open the saved project to read the score, audition it, inspect alternatives and provenance, or
   create a revised version.

All workspaces and knowledge are local by default. Model-dependent actions send only their
authorized inputs to the selected provider; local import, review, deterministic checks, engraving,
playback, and saved projects remain local capabilities.

## Current status

The three generated target scores have passed an Owner playtest:

- classical guitar: accepted as good;
- thirteen-course baroque lute: accepted; and
- five-course baroque guitar: accepted as playable, though stylistic enrichment remains desirable.

The current task builds a native MEI edition path for historical tablature. The first proof turns
page 9 of de Visée's 1686 _Pièces pour la guittare_ into a facsimile-linked, correctable,
interactive French-tablature edition with synchronized playback and then derives one bounded
Attested Realization only after Owner acceptance. See the
[MEI Editions plan](./.scratch/mei-editions/PLAN.md).

Other important limitations:

- Optical recognition is fallible and may require correction.
- Historical claims are only as strong as their reviewed sources and applicability.
- Mechanical checks do not by themselves prove idiomatic or performance-ready music.
- The primary runtime is local and single-Owner; authenticated remote deployment is intentionally
  out of scope.
- There is currently no repository license file.

## Development

Common commands:

| Command                  | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `npm run dev:all`        | Start the watched API and browser application                   |
| `npm test`               | Run the complete host test suite                                |
| `npm run test:browser`   | Run browser workflow tests                                      |
| `npm run typecheck`      | Check TypeScript                                                |
| `npm run format:check`   | Check formatting                                                |
| `npm run spec:verify`    | Verify that current and archived planning state are unambiguous |
| `npm run proof:musical`  | Run the focused musical regression suite                        |
| `npm run proof:baseline` | Print the public Old Hundredth three-target baseline            |
| `npm run eval:golden`    | Evaluate the versioned Golden corpus                            |
| `npm run eval:parity`    | Check coequal target behavior                                   |
| `npm run eval:render`    | Check engraving output                                          |
| `npm run eval:playback`  | Check playback identity                                         |

Use `nix develop` for the pinned Node, Python/music21, LilyPond, MuseScore, and Podman toolchain.
Real Audiveris and Chrome tests run on the macOS host. LilyPond source influenced by imports or
models is compiled only inside the disposable Podman sandbox: no network, inherited secrets,
writable host path, or host-LilyPond fallback.

The development API binds to loopback and accepts browser requests only from the configured
loopback frontend origin. Vellum does not provide authenticated remote access.

## Repository guide

- [SPEC.md](./SPEC.md) — sole current product specification
- [Current execution plan](./.scratch/mei-editions/PLAN.md) — six slices with one late Owner gate
- [CONTEXT.md](./CONTEXT.md) — domain language and enduring invariants
- [Accepted ADRs](./docs/adr/) — architectural decisions
- [Execution-wave archive](./docs/archive/execution-waves/) — completed and superseded plans, not a
  backlog
- [Specification archive](./docs/archive/specifications/) — historical designs and audits
- [Public fixture provenance](./test/fixtures/README.md) — rights and provenance for test music
