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

The browser shows a conversational interface (chat) alongside a live tablature workbench (SVG preview, fretboard diagrams, MIDI playback). Arrangements update in real-time as the agent works.

## Architecture

Built on [pi-mono](https://github.com/badlogic/pi-mono) (`pi-agent-core` + `pi-web-ui` + `pi-ai`). Deployed as a NixOS module on servoid.

```
Browser: pi-web-ui ChatPanel + tablature workbench
   ↕ HTTPS (mTLS)
Server: Node.js + pi-agent-core + custom tools + LilyPond
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

Pre-v1. Spec and architecture are defined. Implementation not yet started.

## Docs

- [SPEC.md](./SPEC.md) — full specification
- [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) — tracked gaps and research items
- [BLUNDER-HUNT.md](./BLUNDER-HUNT.md) — adversarial review findings
