# Alfabeto Chord Shape Lookup — Design Spec (v2)

> Verified against Tyler, _A Guide to Playing the Baroque Guitar_ (2011), Example 6.7
> and cross-referenced with Foscarini chart data. All fret numbers confirmed by
> direct book transcription; pitch math verified against baroque guitar tuning.

## Problem

When arranging music for baroque guitar, chordal passages should idiomatically use
**alfabeto** chord shapes — the standard shorthand chord notation system from
17th-century Italian guitar practice. Currently, the engrave tool produces chord
voicings by raw pitch placement without awareness of these conventional shapes. An
idiomatic baroque guitar arrangement should prefer alfabeto shapes whenever a chord
maps to one, falling back to free voicings only for chords outside the alfabeto
vocabulary.

## Background

### What is alfabeto?

Alfabeto is a chord notation system where uppercase letters (plus the "cross" symbol
`+`) each denote a specific fixed chord shape on the 5-course baroque guitar. It was
codified by **Girolamo Montesardo** in _Nuova inventione d'intavolatura_ (1606) and
became the standard chord vocabulary for the instrument through the 17th century.

The system has three tiers:

1. **Standard shapes (lettere)** — 26 fixed chord shapes: cross (+), A–P (no J),
   Q–Z (no U/W), plus three special symbols (&, 9, ℞). Defined as fret positions
   across the 5 courses. Tyler's "Universal Alfabeto Reference Chart" (Ex. 6.7)
   is the canonical modern reference.

2. **Barré variants (lettere tagliate / "cut letters")** — Standard shapes transposed
   up the neck via a barré. Mechanically: add N to every fret in the shape, transposing
   the chord up N semitones. Confirmed by Foscarini's "X3" notation (base shape + 2 frets).

3. **Auxiliary / artist-defined shapes** — Additional shapes defined by individual
   composers (Corbetta, Foscarini, Sanz, etc.) for chords not in the standard set.
   These vary between sources.

### Verified chart data

Fret numbers are listed **c1→c5** (high string to low string, chanterelle first).
Tuning: c1=E4, c2=B3, c3=G3, c4=D4 (re-entrant), c5=A3 (re-entrant).

Two verified charts exist:

- **Tyler Universal** (`tyler-universal`) — canonical default, 26 shapes
- **Foscarini** (`foscarini`) — 25 identical + 1 difference (L) + 8 extra shapes

See `ALFABETO-CHART-TYLER.md` and `ALFABETO-CHART-FOSCARINI.md` for full data.

### Stringing affects sounding pitches, not shapes

Shapes are defined by fret positions, not sounding pitches. The same shape produces
the same chord regardless of stringing (French re-entrant vs Italian bourdons).

## API Design

### Types

```typescript
type ChartId = "tyler-universal" | "foscarini";

interface AlfabetoShapeEntry {
  letter: string; // "+", "A", "B", ..., "&", "9", "℞"
  chord: string; // "G major", "C minor", etc.
  frets: number[]; // [c1, c2, c3, c4, c5] fret numbers
  category: "cross" | "standard" | "extended" | "special";
}

interface AlfabetoChart {
  id: ChartId;
  name: string;
  source: string;
  shapes: AlfabetoShapeEntry[];
}

interface AlfabetoLookupParams {
  chordName?: string; // "G major", "Dm", "Bb"
  pitchClasses?: number[]; // MIDI pitch classes (0-11)
  chartId?: ChartId; // default: "tyler-universal"
  maxFret?: number; // limit barré transpositions (default: 8)
  includeBarreVariants?: boolean; // default: true
}

interface AlfabetoMatch {
  letter: string;
  chord: string;
  positions: TabPosition[];
  source: "standard" | "barre";
  barreAt?: number;
  baseShape?: string;
}

interface AlfabetoLookupResult {
  matches: AlfabetoMatch[];
  chartId: ChartId;
}
```

### Ranking

When multiple shapes match:

1. **Standard exact** — highest priority
2. **Standard at low barré** (1–3) — common in period practice
3. **Standard at high barré** (4–8) — playable but less idiomatic

Within each tier: prefer fewer barred frets, lower position, smaller stretch.

### Chord name parsing

Start strict: `"G major"`, `"C minor"`, `"Bb major"`, `"F# minor"`.
Add common aliases: `"Gm"` → `"G minor"`, `"Bb"` → `"Bb major"`, `"F#m"` → `"F# minor"`.

### Pitch-class matching

Exact match on pitch classes (mod 12). Ignore octave. Compare the set of unique
pitch classes produced by a shape against the requested set.

## File structure

```
src/lib/alfabeto/
  types.ts                    # AlfabetoShapeEntry, ChartId, LookupParams, etc.
  charts/
    tyler-universal.ts        # Tyler chart as typed constant (default)
    foscarini.ts              # Foscarini: extends Tyler with L override + extras
    index.ts                  # Chart registry
  barre-transpose.ts          # Transpose shape via barré
  lookup.ts                   # Chord name → shape matching
  index.ts                    # Barrel export
  __tests__/
    pitch-validation.test.ts  # Verify every shape produces correct pitches
    barre-transpose.test.ts   # Transposition math
    lookup.test.ts            # Chord name → shape matching, multi-chart
    charts.test.ts            # Chart integrity (no duplicate letters, all valid)
```

## Non-goals (v1)

- Full continuo realization (figured bass → alfabeto)
- Strumming pattern / rhythmic notation
- Historical variant comparison UI
- Server tool exposure (library only for now; server tool in v2)
