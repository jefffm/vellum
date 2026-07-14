# Post-qualification exact-artifact review package

Status: ready-for-agent

Type: AFK

Initial execution eligibility: blocked

Completion semantics: implementation-pass

User stories: U1, U2, U3, U4, U5, U6, U7, U8, U9, U10

SPEC coverage: Slice 14 exact-digest artifact review package

Requirement families touched: II-EXEC-014A, II-RC-001–010

## What to build

After Machine Complete, generate and validate the exact artifact packages that every role-scoped human review will attest. Packages must bind the final successful qualification generation; a prequalification or stale package is invalid.

## Acceptance criteria

- [ ] Each review package binds exact Work/Edition/File and extraction identities, source truth/review scope, Instrument Instance and Performance Brief, Applied Knowledge Manifest, pack releases/attestations/profiles, compiler/search/evaluator/execution/performance versions, Capability Qualification, score, notation, playback, exports, and all relevant digests.
- [ ] Packages include role-specific review forms for metadata/rights, transcription/extraction, historical claims/pack profiles, shared source-to-output musical-structure fidelity, three target-player playtests, three target idiom/historical reviews, Continuo, imitative intabulation, engraving/playback, conditional lyric underlay, and Owner usefulness, plus machine-readable lyric applicability, disagreement/unknown fields, and rerun instructions.
- [ ] Builder derives packages only from the current all-pass T85 Machine Complete generation and rejects stale, mismatched, missing, cross-target, or prequalification evidence; every post-package byte change invalidates the affected package.
- [ ] Exact held-out assets, truth, expectations, diagnostics, private rights evidence, and private review forms are written only to capability-scoped Vault/private review storage. Public output uses opaque package IDs, keyed non-resolving Vault commitments, public-artifact digests, role classes, and scope.
- [ ] A clean authorized reviewer can open, verify, inspect, play, and submit against the exact package after reload without receiving any other role's private notes or Vault reserve access.
- [ ] Successful generation emits `review_package_ready` for the exact package generation; any package change or invalidation removes that current result before reviewers can proceed.

## Gate matrix

- Focused: `npm test -- test/instrument-intelligence/T81-post-qualification-exact-artifact-package.test.ts`.
- Base: `npm run typecheck`; `npm test`; `npm run format:check`; `npm run spec:verify`; `npm run build`; `npm run server:build`.
- Conditional: `npm run test:browser -- test/browser/instrument-intelligence/T81-post-qualification-exact-artifact-package.spec.ts`; `npm run review:validate`; `npm run eval:render`; `npm run eval:playback`; focused stale-package, capability-isolation, rights, and leak-canary cases.
- Toolchain: record Node, npm, review-package schema/builder, credential verifier, Nix/LilyPond, browser, OS, and every bound system/qualification identity.
- Observable outcome: build packages from a qualifying test generation, open them through each scoped reviewer capability, reload, and prove a one-byte binding change invalidates review submission.
- Evidence: `../evidence/T81/verification.json` plus digest-bound public package receipts; exact packages remain authorized private/Vault artifacts.

## Public/Vault boundary

Public manifests contain only opaque package/case IDs, review-role and coverage classes, keyed non-resolving Vault commitments, digests of already-public artifacts, compatibility status, and typed bounded instructions. Exact source identity/assets, direct private-package digests, held-out truth/expectations, private rights evidence, reserve state, per-attempt diagnostics, and unredacted review materials remain exclusively Vault/private review data.

## Dependency result predicates

Result predicate: `{"all":[{"sourceTracer":85,"generation":"current","field":"resultCode","operator":"eq","expected":"machine_complete"}]}`

- T85 Machine Complete is current and binds the unchanged qualification and Generation System.

## Blocked by

- 85
