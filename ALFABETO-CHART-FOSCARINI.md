# Alfabeto — Foscarini Chart

> Source: Foscarini, from Tyler's book (Jeff's transcription April 28, 2026)
> Tuning: c1=E4, c2=B3, c3=G3, c4=D4 (re-entrant), c5=A3 (re-entrant)
> Fret numbers listed c1→c5 (high string to low string)

## Core Shapes

| Symbol | c1 | c2 | c3 | c4 | c5 | Chord | vs Tyler |
|--------|----|----|----|----|-----|-------|----------|
| **+** | 0 | 0 | 0 | 2 | 2 | **E minor** | identical |
| **A** | 3 | 3 | 0 | 0 | 2 | **G major** | identical |
| **B** | 0 | 1 | 0 | 2 | 3 | **C major** | identical |
| **C** | 2 | 3 | 2 | 0 | 0 | **D major** | identical |
| **D** | 0 | 1 | 2 | 2 | 0 | **A minor** | identical |
| **E** | 1 | 3 | 2 | 0 | 0 | **D minor** | identical |
| **F** | 0 | 0 | 1 | 2 | 2 | **E major** | identical |
| **G** | 1 | 1 | 2 | 3 | 3 | **F major** | identical |
| **H** | 1 | 3 | 3 | 3 | 1 | **Bb major** | identical |
| **I** | 0 | 2 | 2 | 2 | 0 | **A major** | identical |
| **K** | 1 | 2 | 3 | 3 | 1 | **Bb minor** | identical |
| **L** | 3 | 3 | 0 | 1 | 3 | **C minor (add9)** | **DIFFERS** — c2=3(D4) not 4(Eb4) |
| **M** | 3 | 4 | 3 | 1 | 1 | **Eb major** | identical |
| **N** | 4 | 1 | 1 | 1 | 3 | **Ab major** | identical |
| **O** | 3 | 3 | 0 | 0 | 1 | **G minor** | identical |
| **P** | 1 | 1 | 1 | 3 | 3 | **F minor** | identical |
| **Q** | 2 | 2 | 3 | 4 | 4 | **Gb major** | identical |
| **R** | 2 | 4 | 4 | 4 | 2 | **B major** | identical |
| **S** | 4 | 5 | 4 | 2 | 2 | **E major** ᵇ | identical |
| **T** | 5 | 2 | 2 | 2 | 4 | **A major** ᵇ | identical |
| **V** | 2 | 2 | 2 | 4 | 4 | **F# minor** | identical |
| **X** | 2 | 3 | 4 | 4 | 2 | **B minor** | identical |
| **Y** | 3 | 3 | 4 | 5 | 5 | **G major** ᵇ | identical |
| **Z** | 3 | 5 | 5 | 5 | 3 | **C major** ᵇ | identical |
| **&** | 1 | 2 | 1 | 3 | 4 | **Db major** | identical |
| **℞** | 4 | 6 | 5 | 3 | 3 | **F minor** ᵇ | identical |

## Foscarini-only symbols

| Symbol | c1 | c2 | c3 | c4 | c5 | Chord | Notes |
|--------|----|----|----|----|-----|-------|-------|
| **"P?"** | 3 | 5 | 4 | 2 | 2 | **E minor** ᵇ | = Tyler's 9 [con], different glyph |
| **B·** | 3 | 3 | 0 | 3 | 0 | **Dm add4 / G7no3** | Non-triadic — {A, D, F, G} |

## Barré transpositions (lettere tagliate)

All "X3" shapes are exactly the base shape shifted up 2 frets (barré at fret 3):

| Symbol | c1 | c2 | c3 | c4 | c5 | Chord | Derivation |
|--------|----|----|----|----|-----|-------|------------|
| **G3** | 3 | 3 | 4 | 5 | 5 | **G major** | G(F maj)+2 = G maj (= Y) |
| **H3** | 3 | 5 | 5 | 5 | 3 | **C major** | H(Bb maj)+2 = C maj (= Z) |
| **M3** | 5 | 6 | 5 | 3 | 3 | **F major** | M(Eb maj)+2 = F maj |
| **N3** | 6 | 3 | 3 | 3 | 5 | **Bb major** | N(Ab maj)+2 = Bb maj |
| **K3** | 3 | 4 | 5 | 5 | 3 | **C minor** | K(Bb min)+2 = C min |
| **P3** | 3 | 3 | 3 | 5 | 5 | **G minor** | P(F min)+2 = G min |
| **M†** | 2 | 4 | 3 | 1 | 1 | **Eb minor** | Unique — fills gap in Tyler |

## Comparison summary

- **25 of 26 core shapes: identical** to Tyler
- **1 difference: L** — Foscarini c2=3 (D4, adds 9th), Tyler c2=4 (Eb4, pure triad)
- **8 additional shapes** in Foscarini (7 barré transpositions + 1 unique voicing)
- **M† = Eb minor** — not available in Tyler's standard set
- **B· = non-triadic voicing** — {A, D, F, G}, used in specific progressions
- **Lettere tagliate confirmed**: "X3" = base shape X shifted +2 frets mechanically

## Chart metadata

```
id: "foscarini"
name: "Foscarini Alfabeto Chart"
source: "Foscarini, via Tyler (2011)"
instrument: "baroque-guitar-5"
parent: "tyler-universal"  # 96% identical, treat as variant
differences_from_parent: ["L"]
extensions: ["B·", "G3", "H3", "M3", "N3", "K3", "P3", "M†", "P?"]
```
