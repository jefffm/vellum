# Audiveris native-evidence contract fixture

- Source artifact: `../imitation/imitative-passage.pdf`
- Source license: CC0 1.0 Universal / Public Domain Dedication
- Recognition backend: Audiveris 5.10.2, commit `1b7cf44088c68f4168801822a613751d1bb1b584`
- Runtime: official macOS arm64 release, OpenJDK 25.0.2, Tesseract 5.5.1
- Generated: 2026-07-11
- Purpose: deterministic contract coverage for native `.omr` bounds/grade correlation, MusicXML normalization, Critical Uncertainty classification, and Score-Anchored Review

The `.omr` and `.mxl` files are unedited outputs of:

```text
Audiveris -batch -transcribe -save -export -output <directory> -- imitative-passage.pdf
```

The recognition result is deliberately not treated as reviewed musical truth. The
fixture proves that Vellum preserves and correlates Audiveris evidence, including
recognition mistakes and uncertainty. The reviewed CC0 source data remains in
`../imitation/` for independent arrangement-engine regression tests.

## SHA-256

- `imitative-passage-audiveris-5.10.2.omr`: `6745c2881d22789bd60ea1fe4e85c2b926ae9e6d41b038ee4e7b5664a7b62294`
- `imitative-passage-audiveris-5.10.2.mxl`: `e94f51a817b3e308f869c8bf20053331b2392ab2584637286a255a84033a6af1`
