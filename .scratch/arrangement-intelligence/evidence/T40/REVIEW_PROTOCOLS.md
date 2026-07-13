# Deferred human review packages

These are exact T40 artifacts generated from the reviewed public-domain `greensleeves-satb.ly` source (SHA-256 `187caee2fa16c81d9ce8f71f47e928f2276ad81d98bb38ba2d06adfbeee45a4e`) by `eval:parity`. Every package contains LilyPond, SVG, PDF, MIDI, and semantic Audio Preview JSON. Do not regenerate during review: the attestation must cite these bytes and hashes. If code, source, profile, brief, evaluator, or package bytes change, the review becomes stale.

Shared Performance Brief: study use; intermediate performer and difficulty; practice expected; repeatable reliability; tempo not specified; solo role; target-appropriate notation. The reviewer must record the actual review tempo and physical instrument measurements. A deterministic pass is not a physical or historical attestation.

## T41 — five-course baroque guitar

- Modeled Instrument Instance: `baroque-guitar-5`; five courses; French stringing; French letter tablature; solo role.
- Exact artifacts: `review-packages/baroque-guitar-5/`.
- Required roles: target player for physical execution; historical-practice specialist for stringing/alfabeto idiom; engraving/editorial reviewer; Owner/listener for recognition and usefulness. One person may submit separate attestations only when qualified for each declared role.
- Protocol: inspect the PDF against the SVG; listen to MIDI/Audio Preview while following the score; play every measure at a recorded tempo; repeat every transition three times; isolate the Principal Voice; inspect the known cross-course transition counterexample; record reach, common/disappearing fingers, barré changes, right-hand assumptions, recognition, notation defects, and any workaround.
- Stale when: source digest, Arrangement/Performance Brief, baroque-guitar profile or exact physical setup/stringing, arrangement bytes, evaluator protocol, or policy changes.

## T42 — thirteen-course baroque lute

- Modeled Instrument Instance: `baroque-lute-13`; thirteen courses; default D-minor Bass Tuning; French letter tablature; solo role.
- Exact artifacts: `review-packages/baroque-lute-13/`.
- Required roles: thirteen-course-lute player; historical-practice specialist; engraving/editorial reviewer; Owner/listener.
- Protocol: inspect PDF/SVG and diapason signs; listen while following; record actual lute courses, scale length, setup, and Bass Tuning; play every measure at a recorded tempo; repeat stopped-course/diapason transitions three times; evaluate left-hand position, diapason access, sustain, right-hand feasibility, recognition, and notation.
- Stale when: source digest, Brief, lute profile, Bass Tuning, physical setup, arrangement bytes, evaluator protocol, or policy changes.

## T43 — six-string classical guitar

- Modeled Instrument Instance: `classical-guitar-6`; standard EADGBE tuning; standard notation; solo role.
- Exact artifacts: `review-packages/classical-guitar-6/`.
- Required roles: classical-guitar player; notation/engraving editor; Owner/listener. Historical review is required only for claims displayed as historically supported.
- Protocol: inspect PDF/SVG voice layout, stems, ties, spelling, and fingering implications; listen while following; record actual guitar setup and scale length; play every measure at a recorded tempo; repeat position shifts three times; isolate voices; record sustain conflicts, polyphonic legibility, physical feasibility, recognition, editorial defects, and usefulness.
- Stale when: source digest, Brief, guitar profile/tuning/setup, arrangement bytes, evaluator protocol, or policy changes.

## Attestation record

Each scoped attestation must record: tracer and target; exact artifact paths and SHA-256 values; Arrangement/Performance Brief; modeled and actual instrument; protocol version (`T40.review.v1`); reviewer role and qualification; result (`accept`, `reject`, or `accept_with_limitations`); confidence; observations with score anchors; rationale; date; and stale dependencies. Rejection or limitation creates correction work and a new artifact version; it must never be overwritten by baseline promotion.

Each target directory contains a machine-generated `review-request.json` binding these requirements to the exact current Arrangement Score, Performance Brief, Instrument Instance, and five artifact digests. Completed attestations are separate JSON records; no empty or synthetic attestation is shipped. Validate a set with:

```sh
npm run review:validate -- \
  --request .scratch/arrangement-intelligence/evidence/T40/review-packages/<instrument>/review-request.json \
  --attestation <role-one.json> \
  --attestation <role-two.json>
```

The command exits nonzero for missing required roles, stale request identity, changed artifact bytes, unauthorized roles, target-player evidence without a declared physical instrument, historical judgments without documentary evidence, qualified acceptance without limitations, rejection, or omitted staleness dependencies. A successful validation establishes coverage of the declared roles only; T41–T43 still require the corresponding records to be reviewed and committed, and T44 retains final Owner authority.
