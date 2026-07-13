# OMR and model evaluation isolation

Status: complete

Type: AFK

User stories: U2, U6

## What to build

Evaluate retained and live external intelligence honestly without confusing contract fixtures with current quality or reproducibility.

## Acceptance criteria

- [x] Recorded provider and retained OMR fixtures run deterministically.
- [x] Live checks are explicit dated evidence and never hidden CI dependencies.
- [x] Model judges disclose self-evaluation, prompt, provider, order, evidence, and uncertainty.
- [x] Stochastic aggregation retains individual hard failures and compatibility limits.

## Delivered

- `eval:omr` and `eval:model` are offline-by-default machine-readable commands backed by retained versioned JSON fixtures. Their evidence is explicitly `recorded_contract` and `deterministic_recorded_fixture`, with `currentQualityClaim: not_established` for OMR.
- Recorded OMR evidence reports contract symbol-error and voice-assignment fields while naming the recorded Audiveris backend and compatibility limitations. It is not presented as a current Audiveris benchmark.
- Every recorded model judgment is an immutable Model Judge Action with provider, model, full prompt, configuration, candidate order, exact evidence refs, generator relationship, uncertainty, retained output, and date. Same-model self-evaluation is disclosed.
- Protected fidelity, history, musical-quality, and physical-playability dimensions can receive model observations only; a model judge is never their sole hard gate.
- Stochastic aggregation retains every sample, sampling count/temperature, uncertainty, compatibility limits, and separate deterministic/stochastic statuses. Any individual hard failure forces failure even when the aggregate mean is favorable.
- `--live` requires `VELLUM_EVAL_LIVE=1` plus an explicit adapter result. Live evidence is dated, has a stale-after date, and is labeled `external_not_reproducible`; ordinary commands and the full test suite never invoke it.
- Held-out-canary testing runs generator-visible input in a separately spawned process with a minimal environment. The held-out environment canary is absent from both input and output.
- External evidence and Model Judge Actions persist in the Evaluation Store, separate from canonical workspaces.

## Verification

- Focused tests run both recorded fixtures twice and prove byte-equivalent typed results, contract-only language, complete judge metadata, and protected-dimension observation-only presentation.
- A favorable three-sample stochastic fixture containing one hard failure remains failed and retains the failing sample.
- Tests prove live evidence rejects implicit invocation and retains observation/staleness dates when explicitly enabled.
- Process-isolation tests prove a secret held-out canary cannot reach the generator/fitting worker.
- Both new CLI commands execute against retained fixtures, emit valid JSON, and persist their records.
- Full quality gates and evaluation evidence are recorded in `evidence/T32/verification.json`.

## Honest limits

- Recorded OMR/provider fixtures prove contracts, not current external-system quality. No live evidence was generated or promoted by this AFK tracer.
- T34 owns the complete command family, CI impact selection, retention, external-evidence status reporting, and promotion gates. T32 adds only `eval:omr` and `eval:model`.
- T35 owns licensed corpus breadth and held-out fixture expectations. The small retained fixtures here are intentionally contract fixtures, not a representative music-quality corpus.
- Actual OMR/model quality claims require reviewed current or held-out evidence and remain unknown.

## Blocked by

- 10
- 12
- 14
