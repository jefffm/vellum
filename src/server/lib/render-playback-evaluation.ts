import type { AudioPreview, PlaybackEvent } from "../../lib/audio-preview.js";
import type {
  CanonicalPlaybackEvaluation,
  FocusedVisualEvaluation,
  MutationManifest,
  SemanticNotationEvaluation,
} from "../../lib/evaluation-domain.js";

export type SemanticNotationEvent = {
  id: string;
  pitches: string[];
  duration: string;
  role: string;
  notationIdentity: string;
};

export function evaluateSemanticNotation(
  expected: SemanticNotationEvent[],
  rendered: SemanticNotationEvent[]
): SemanticNotationEvaluation {
  const actual = new Map(rendered.map((event) => [event.id, event]));
  const findings: SemanticNotationEvaluation["findings"] = [];
  for (const event of expected) {
    const candidate = actual.get(event.id);
    if (!candidate) {
      findings.push({
        code: "notation.event_missing",
        eventId: event.id,
        message: "Canonical notation event is missing from the rendered semantic projection.",
      });
      continue;
    }
    if (JSON.stringify(candidate.pitches) !== JSON.stringify(event.pitches)) {
      findings.push({
        code: "notation.pitch_changed",
        eventId: event.id,
        message: "Rendered pitch semantics differ from the canonical score.",
      });
    }
    if (candidate.duration !== event.duration) {
      findings.push({
        code: "notation.duration_changed",
        eventId: event.id,
        message: "Rendered duration semantics differ from the canonical score.",
      });
    }
    if (candidate.role !== event.role || candidate.notationIdentity !== event.notationIdentity) {
      findings.push({
        code: "notation.identity_changed",
        eventId: event.id,
        message: "Rendered role or target-specific notation identity changed.",
      });
    }
  }
  return {
    status: findings.length ? "fail" : "pass",
    comparedEventIds: expected.map(({ id }) => id),
    findings,
  };
}

export function evaluateFocusedVisualRegions(
  regions: Array<{ id: string; changedFraction: number; tolerance: number }>
): FocusedVisualEvaluation {
  const evaluated = regions.map((region) => ({
    ...region,
    status:
      region.changedFraction <= region.tolerance ? ("pass" as const) : ("review_required" as const),
  }));
  return {
    status: evaluated.some((region) => region.status === "review_required")
      ? "review_required"
      : "pass",
    regions: evaluated,
    wholePageComparison: "supplementary",
  };
}

export function evaluateCanonicalPlayback(
  expected: AudioPreview,
  actual: AudioPreview
): CanonicalPlaybackEvaluation {
  const findings: CanonicalPlaybackEvaluation["findings"] = [];
  const expectedOccurrences = expected.performedForm.measureOccurrences.map(({ id }) => id);
  const actualOccurrences = actual.performedForm.measureOccurrences.map(({ id }) => id);
  if (JSON.stringify(expectedOccurrences) !== JSON.stringify(actualOccurrences)) {
    findings.push({
      code: "playback.traversal_changed",
      occurrenceId: expectedOccurrences[0] ?? "occurrence.none",
      message: "Performed Form occurrence traversal differs from canonical playback.",
    });
  }
  if (
    JSON.stringify(expected.performedForm.traversalDecisions) !==
    JSON.stringify(actual.performedForm.traversalDecisions)
  ) {
    findings.push({
      code: "playback.repeat_decision_changed",
      occurrenceId: expectedOccurrences[0] ?? "occurrence.none",
      message: "Repeat or traversal decisions differ from canonical playback.",
    });
  }
  const actualByOccurrence = new Map(actual.events.map((event) => [event.occurrenceId, event]));
  for (const event of expected.events) {
    const candidate = actualByOccurrence.get(event.occurrenceId);
    if (!candidate) {
      findings.push({
        code: "playback.occurrence_missing",
        occurrenceId: event.occurrenceId,
        message: "Canonical sounding occurrence is missing.",
      });
      continue;
    }
    const fields: Array<keyof PlaybackEvent> = [
      "measureOccurrenceId",
      "iteration",
      "arrangementEventId",
      "part",
      "midi",
      "startSeconds",
      "durationSeconds",
    ];
    if (
      fields.some((field) => candidate[field] !== event[field]) ||
      JSON.stringify(candidate.sourceEventIds) !== JSON.stringify(event.sourceEventIds)
    ) {
      findings.push({
        code: "playback.canonical_event_changed",
        occurrenceId: event.occurrenceId,
        message: "Pitch, onset, duration, part, occurrence, or canonical identity changed.",
      });
    }
  }
  const duplicateIds = actual.events
    .map(({ occurrenceId }) => occurrenceId)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  duplicateIds.forEach((occurrenceId) =>
    findings.push({
      code: "playback.display_staff_duplication",
      occurrenceId,
      message: "A display-staff event was duplicated in canonical sounding playback.",
    })
  );
  return {
    status: findings.length ? "fail" : "pass",
    comparedOccurrenceIds: expected.events.map(({ occurrenceId }) => occurrenceId),
    comparedParts: [...new Set(expected.events.map(({ part }) => part))],
    findings,
    waveformCompared: false,
  };
}

export function verifyMutationManifest(manifest: MutationManifest): void {
  const requiredCategories = [
    "principal_voice",
    "cadence",
    "continuo_foundation",
    "figures",
    "imitation",
    "positions",
    "stringing",
    "lute_course_identity",
    "classical_duration",
    "plan_decisions",
    "playback_duplication",
    "repeats",
    "artifact_handoff",
    "staleness",
    "search_truthfulness",
  ];
  const present = new Set(manifest.mutations.map(({ category }) => category));
  const missing = requiredCategories.filter((category) => !present.has(category));
  if (missing.length) throw new Error(`Mutation Manifest is missing: ${missing.join(", ")}`);
  const requiredEvaluators = [
    "evaluator.preservation",
    "evaluator.continuo",
    "evaluator.counterpoint",
    "evaluator.mechanics",
    "evaluator.notation",
    "evaluator.plan",
    "evaluator.playback",
    "evaluator.workflow",
    "evaluator.lineage",
    "evaluator.search",
  ];
  const evaluatorIds = new Set(manifest.mutations.map(({ evaluatorId }) => evaluatorId));
  const uncovered = requiredEvaluators.filter((id) => !evaluatorIds.has(id));
  if (uncovered.length) {
    throw new Error(`Authoritative evaluator lacks a scoped mutation: ${uncovered.join(", ")}`);
  }
  if (manifest.universalCompletenessClaim !== false) {
    throw new Error("Mutation sensitivity cannot claim universal completeness");
  }
}
