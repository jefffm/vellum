# Vellum

**ve*LLM*um** — the writing surface where the LLM writes music.

Vellum is an LLM-powered music arrangement tool for historical plucked string instruments (baroque lute, baroque guitar, Renaissance lute, theorbo), classical guitar, piano, and voice. It renders properly formatted tablature and standard notation via [LilyPond](https://lilypond.org).

## How It Works

The LLM makes the musical decisions. Custom tools handle mechanical correctness:

- **`tabulate`** — pitch → all valid course/fret positions, ranked by quality
- **`voicings`** — chord → all playable voicings, ranked by stretch and idiom
- **`check_playability`** — catches impossible stretches and fingering conflicts
- **`compile`** — runs LilyPond, returns structured errors instead of raw stderr
- **`transpose`** — transposes with range validation and key suggestions
- **`diapasons`** — returns historically informed bass string tuning for a key
- **`fretboard`** — renders SVG fret diagrams

The browser hosts the Agent (pi-agent-core) and shows a conversational interface (ChatPanel) alongside a tablature workbench (ArtifactsPanel with SVG preview, fretboard diagrams). Tools call server API endpoints for LilyPond compilation and instrument data. LLM API calls are proxied through the server to keep API keys secure.

## Architecture

Built on [pi-mono](https://github.com/badlogic/pi-mono) (`pi-agent-core` + `pi-web-ui` + `pi-ai`). Deployed as a NixOS module on servoid.

```
Browser: Agent + pi-web-ui (ChatPanel + ArtifactsPanel + tool renderers)
   ↕ HTTPS (mTLS) — tool API calls + LLM streamProxy
Server: Express + LilyPond subprocess + instrument profiles + arrangement storage
   ↕ systemd / Traefik
NixOS: servoid (jefffm/.nix flake)
```

See [SPEC.md](./SPEC.md) for the full architecture, tool signatures, instrument profiles, and design rationale.

## Deployment

Consumed via the `jefffm/.nix` flake:

```nix
# inputs
inputs.vellum.url = "github:jefffm/vellum";

# hosts/servoid/default.nix
services.vellum = {
  enable = true;
  domain = "vellum.aoeu.pw";
  apiKeyFile = "/run/secrets/anthropic-key";
};
```

## Status

Pre-v1. Spec and architecture defined. No remaining design blockers. Implementation not yet started.

## Docs

- [SPEC.md](./SPEC.md) — full specification
- [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) — tracked gaps and research items
- [BLUNDER-HUNT.md](./BLUNDER-HUNT.md) — adversarial review findings (R1)
- [BLUNDER-HUNT-R2.md](./BLUNDER-HUNT-R2.md) — adversarial review findings (R2)
