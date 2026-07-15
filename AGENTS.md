# Vellum Coding Agent Prompt

## Agent skills

### Issue tracker

Current implementation waves use local Markdown tracer bullets under .scratch; do not create beads unless the Owner explicitly requests them. See docs/agents/issue-tracker.md.

### Triage labels

Local tracer bullets use the canonical needs-triage, needs-info, ready-for-agent, ready-for-human, and wontfix states. See docs/agents/triage-labels.md.

### Domain docs

Vellum is a single-context repository governed, in order, by CONTEXT.md, accepted decisions in docs/adr, and the current SPEC.md. See docs/agents/domain.md.

## Current work

The sole current implementation specification is SPEC.md: **Vellum Instrument Intelligence**.

It governs the next program of source-backed Knowledge Packs, Applied Knowledge Manifests, shared phrase and voice planning, and coequal idiom compilers for five-course baroque guitar, thirteen-course baroque lute, and six-string classical guitar.

The active execution wave is `.scratch/instrument-intelligence`. Before implementation:

1. Read CONTEXT.md, applicable accepted ADRs, and SPEC.md.
2. Apply accepted ADR 0022 to all new canonical Reviewed Knowledge Library records.
3. Read `.scratch/instrument-intelligence/PLAN.md`, its requirement ledger, and the selected tracer issue before changing code.
4. Do not reopen .scratch/arrangement-intelligence; it is a frozen completed prototype record with path- and hash-bound evidence.
5. Treat tracer IDs as stable locators, not sequence. Follow the typed dependency/result-predicate graph and temporal execution generations in the generated completion manifest.
6. Sequence autonomous implementation before late human commitments, then resume automatic sealed execution, remediation, packaging, and aggregation after those commitments; never hide AFK work inside one HITL ticket.
7. Treat schema 5 as an evidence-empty execution lock. Before an Owner-local checkpoint exists, one explicit Owner-authorized, evidence-empty pre-trust correction may change only the literal path allowlist below; its Nix exception is limited to the repo-tracked Podman proxy and exact `flake.nix` fixes required to run the pinned execution/music shell and explicit LilyPond sandbox gate. It does not establish trust or permit product work or arbitrary dependency changes. After independently reviewing the exact corrected pushed bootstrap, the Owner establishes the atomic three-ref tuple with `npm run plan:instrument-intelligence:trust-bootstrap`: immutable reviewed-bootstrap commit, immutable canonical-policy blob, and mutable trusted-main compare-and-swap head. Never infer or reconstruct a bootstrap. The publication remote is explicitly unprotected (`remoteProtectionAssumed: false`), and its normalized identity is pinned.
8. T01 first lands and strictly verifies a governance-only next-schema/verifier/clause-ledger pre-registration transaction. Do not add or push T01 evidence before that upgraded pending-evidence validator is active.
9. Thereafter complete, test, commit, push, and record checkpoint descent and `origin/main` reachability for each tracer before beginning a dependent tracer. One publisher serializes ordinary fast-forward pushes; never merge, force-push, delete, amend, or rebase pushed history. Run `npm run spec:verify` for draft/precommit validation; after pushing prevalidated implementation/evidence and its separate manifest-only receipt commit, run `npm run plan:instrument-intelligence:verify`. Strict verification must match fetched `origin/main` to the independent authenticated GitHub GraphQL observation for repository node `R_kgDOSNEx6w` at both ends of the check; this requires no hosted protection setting. Dependents require local `HEAD` and a clean worktree at that verified receipt tip. Divergence, rewind, deletion, remote substitution, GraphQL disagreement, concurrent movement, or partial checkpoint loss/mismatch is `ready-for-human`. Total loss of all three local refs is indistinguishable from a fresh clone, but automation still cannot bootstrap because the explicit Owner ceremony is mandatory.

The sole pre-trust correction allowlist is exactly:

- `.scratch/instrument-intelligence/completion-manifest.json`
- `SPEC.md`
- `AGENTS.md`
- `.scratch/instrument-intelligence/PLAN.md`
- `.scratch/instrument-intelligence/README.md`
- `.scratch/instrument-intelligence/REQUIREMENTS.md`
- `.scratch/instrument-intelligence/issues/01-governing-contract-baseline-guard.md`
- `docs/agents/issue-tracker.md`
- `flake.nix`
- `scripts/nix-podman`
- `scripts/lib/instrument-intelligence-trust.mjs`
- `scripts/verify-instrument-intelligence-plan.mjs`
- `test/instrument-intelligence/bootstrap-trust-policy.test.ts`

No directory expansion is implied. Product code, product tests, package manifests/lockfiles, and other dependencies are forbidden in this correction.

Public tracer artifacts may contain only rights-approved development-fixture details plus typed bounded receipts. Hidden material uses non-resolving case IDs and keyed Vault commitments, never bare hidden-source or truth digests. Exact held-out source identities, reviewed truth, expected observations, forbidden outcomes, mutations, invalidation decisions, reserve order or seed, and per-attempt diagnostics remain exclusively in the Owner Evaluation Vault. Owner-private reference identities, paths, metadata, crops, text, images, and direct digests are equally private unless an explicit repository-inclusion decision authorizes disclosure.

Historical specifications, proposals, audits, reviews, and superseded plans are under docs/archive/specifications/2026-07-13. They are evidence, not current work.

## Quality gates

Every tracer issue must declare its applicable gate matrix, exact commands, toolchain identity, and evidence paths. Run the base gates before every tracer commit:

```bash
cd /Users/jeff/ws/vellum
npm run typecheck
npm test
npm run format:check
npm run spec:verify
npm run build
npm run server:build
```

Add the affected conditional gates:

- UI or workflow changes: `npm run test:browser`
- evaluation changes: the affected `npm run eval:*` suites
- notation or playback: `npm run sandbox:lilypond:verify`, `npm run eval:render`, and `npm run eval:playback` in the Nix shell
- cross-target behavior: `npm run eval:golden` and `npm run eval:parity`
- migration, security, provider, or rights work: the named migration, adversarial-security, fake-provider, rights-leak, and applicable real-tool gates defined by that tracer

Use the Nix development shell when a gate requires the pinned musical toolchain. A required failed or blocked gate prevents commit and dependency advancement. `not_applicable` requires a recorded rationale; gate outputs and toolchain identities belong in the tracer evidence manifest.

### Host and Nix gate profile

- Run deterministic compilation, formatting, focused pure-Node tests, and pinned musical-tool/evaluation gates through the repo-tracked Podman-backed Nix shell.
- Run the complete `npm test` suite on the macOS host because it intentionally mixes real Audiveris, host-path, and Podman-isolation coverage with pure Node tests; do not treat its environment-dependent cases as a portable Nix suite.
- Run `plan:instrument-intelligence:manifest`, `spec:verify`, the strict publication verifier, and the one-time Owner bootstrap ceremony on the macOS host with the existing SSH and authenticated `gh` keychain sessions because they observe publication state. The Nix proxy must not mount or forward GitHub credentials.
- Run real Audiveris and Chrome/browser gates on the macOS host, where those applications and sessions live.
- Keep the Podman API socket absent from ordinary Nix runs. Expose it only for the explicit nested LilyPond sandbox gate using `VELLUM_NIX_PODMAN_GATE=1`.
- Serialize the Nix, nested-Podman, Audiveris, and browser profiles; do not overlap their shared VM, ports, caches, or application state.
