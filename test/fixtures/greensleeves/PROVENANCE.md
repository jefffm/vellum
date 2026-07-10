# Greensleeves SATB golden fixture

## Source

- Work: _Greensleeves_ (traditional 16th-century English melody)
- Setting: Voice (SATB), hymn-tune setting
- Typesetter and Mutopia maintainer: Steve Dunlop
- Mutopia identifier: `Mutopia-2008/01/13-1247`
- Catalog page: https://www.ibiblio.org/mutopia/cgibin/piece-info.cgi?id=1247
- PDF source: https://www.ibiblio.org/mutopia/ftp/Traditional/greensleeves/greensleeves-a4.pdf
- LilyPond ground-truth source: https://www.ibiblio.org/mutopia/ftp/Traditional/greensleeves/greensleeves.ly
- Retrieved: 2026-07-10

## Rights

The Mutopia catalog and the score footer identify the work and typesetting as
Public Domain. The score states that it is free to download, distribute, modify,
and perform. The fixture is stored in this repository so acceptance tests do not
depend on the availability or behavior of a third-party site.

## Integrity

| File                    | SHA-256                                                            |
| ----------------------- | ------------------------------------------------------------------ |
| `greensleeves-satb.pdf` | `41242dae463d8fefbfa3a11cefe78ea025f7649f4e8b631329e4904989fc5348` |
| `greensleeves-satb.ly`  | `187caee2fa16c81d9ce8f71f47e928f2276ad81d98bb38ba2d06adfbeee45a4e` |

## Test role

The PDF is the immutable Source Artifact used by the end-to-end fixture. The
LilyPond file is reviewed ground truth only: it may be used to derive expected
voices and event invariants in tests, but production import and arrangement code
must not inspect it or special-case this work.
