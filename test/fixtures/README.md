# Test Fixtures

## `greensleeves/`

Public-domain four-part _Greensleeves_ golden fixture. The PDF is the uploaded
Source Artifact; the original Mutopia LilyPond file is reviewed test ground truth.
See [`greensleeves/PROVENANCE.md`](greensleeves/PROVENANCE.md) for rights, source
URLs, checksums, and usage constraints.

## `old-hundredth/`

Public-domain four-part _Old 100th_ from the 1551 Genevan Psalter. The Mutopia
PDF is the Source Artifact and its exact LilyPond file is reviewed symbolic truth.
This is the primary non-Greensleeves product baseline. See
[`old-hundredth/PROVENANCE.md`](old-hundredth/PROVENANCE.md).

Run `npm run proof:baseline` to exercise its reviewed source through all three
priority target searches and print the current target-specific defects.

## `continuo/`

CC0 soprano-plus-figured-bass golden fixture with a prepared `4-3`
suspension, reviewed semantic truth, a deterministic MusicXML adapter sample,
and a compiled PDF Source Artifact. See
[`continuo/PROVENANCE.md`](continuo/PROVENANCE.md).

## `imitation/`

CC0 three-voice imitative golden fixture with ordered subject entries, reviewed
LilyPond truth, and a compiled PDF Source Artifact. See
[`imitation/PROVENANCE.md`](imitation/PROVENANCE.md).

## `audiveris/`

Production-derived Audiveris 5.10.2 `.omr` and `.mxl` outputs for the CC0
imitative passage. These files exercise native recognition bounds, grades, page
mappings, uncertainty classification, and Score-Anchored Review without relying
on a fabricated backend result. See
[`audiveris/PROVENANCE.md`](audiveris/PROVENANCE.md).

## `evaluation/`

The held-out-aware three-target Golden corpus combines the public-domain
Greensleeves source with original CC0 baroque-guitar transition, 13-course lute
stopped/diapason, and polyphonic classical-guitar studies. The manifest records
reviewed truth, Analysis, independent target Plans, invariant boundaries,
mutations, and multiple acceptable alternatives. See
[`evaluation/THREE_TARGET_PROVENANCE.md`](evaluation/THREE_TARGET_PROVENANCE.md).

## LilyPond Fixtures

| File                      | Source              | License       |
| ------------------------- | ------------------- | ------------- |
| d-minor-scale-lute.ly     | Hand-written        | N/A           |
| polyphonic-lute.ly        | Hand-written        | N/A           |
| diapason-test.ly          | Hand-written        | N/A           |
| bwv996-bourree-opening.ly | J.S. Bach (1717)    | Public domain |
| flow-my-tears-opening.ly  | John Dowland (1600) | Public domain |
| simple-guitar.ly          | Hand-written        | N/A           |

## MusicXML Fixtures

| File                  | Source                           | License |
| --------------------- | -------------------------------- | ------- |
| bach-chorale-cmaj.xml | Hand-encoded (Bach style)        | N/A     |
| parallel-fifths.xml   | Hand-written (deliberate errors) | N/A     |
| hymn-simple.xml       | Hand-written                     | N/A     |
