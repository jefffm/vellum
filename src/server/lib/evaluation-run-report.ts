import { EvaluationStore } from "./evaluation-store.js";

export function buildEvaluationRunReport(store: EvaluationStore, runId: string, now: Date) {
  const run = store.getRun(runId);
  const cards = run.caseRunIds.map((id) => store.getCardForCaseRun(id)).filter(Boolean);
  const items = store.listExternalEvaluationEvidence().map((evidence) => ({
    id: evidence.id,
    kind: evidence.kind,
    mode: evidence.mode,
    observedAt: evidence.observedAt,
    compatible: evidence.compatibility.compatible,
    stale: evidence.staleAfter ? new Date(evidence.staleAfter) <= now : false,
    reproducibility: evidence.reproducibility,
    limitations: evidence.compatibility.limitations,
  }));
  return {
    ok: true as const,
    command: "eval:report" as const,
    run,
    cards,
    externalEvidence: {
      status: items.length ? ("reported_separately" as const) : ("not_available" as const),
      items,
    },
    disclaimer:
      "Missing or stale live external evidence is reported separately and is never inferred from offline CI success.",
  };
}
