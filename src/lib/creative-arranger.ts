import {
  arrangeFaithfulPluckedString,
  auditFaithfulPrincipalVoice,
} from "./baroque-guitar-arranger.js";
import { assertAuthorityPathRuntime } from "./authority-path-runtime.js";
import { InstrumentModel } from "./instrument-model.js";
import type {
  AnalysisRecord,
  ArrangementCandidate,
  ArrangementEvent,
  ArrangementScore,
  NormalizedScore,
  TargetConfiguration,
} from "./music-domain.js";
import { noteToMidi, transposeNote } from "./pitch.js";
import { applyPreservationPolicy, type PreservationPolicy } from "./preservation-policy.js";

export function arrangeCreativeParaphrase(
  score: NormalizedScore,
  analysis: AnalysisRecord,
  model: InstrumentModel,
  options: {
    arrangementId: string;
    createdAt: string;
    targetConfiguration: TargetConfiguration;
    preservationPolicy: PreservationPolicy;
    allowedStrategies: Array<"ornamented-paraphrase" | "idiomatic-revoicing">;
  }
): { candidates: ArrangementCandidate[]; selected: ArrangementScore } {
  assertAuthorityPathRuntime("authority.ranker.shared-search", "production");
  if (options.preservationPolicy !== "free_paraphrase") {
    throw new Error("Creative arrangement requires the explicit free-paraphrase policy");
  }
  const base = arrangeFaithfulPluckedString(score, analysis, model, options);
  const coverage = base.candidates.find((candidate) => candidate.strategy === "source-coverage")!;
  const economical = base.candidates.find(
    (candidate) => candidate.strategy === "economical-fingering"
  )!;
  const candidates: ArrangementCandidate[] = [];
  if (options.allowedStrategies.includes("ornamented-paraphrase")) {
    const events = addIdiomaticOrnament(coverage.events, model);
    candidates.push({
      ...coverage,
      id: "candidate.ornamented-paraphrase",
      strategy: "ornamented-paraphrase",
      status: "survived",
      events,
      audit: applyPreservationPolicy(
        auditFaithfulPrincipalVoice(
          score,
          analysis,
          events,
          base.selected.transpositionPlan.semitones
        ),
        options.preservationPolicy
      ),
    });
  }
  if (options.allowedStrategies.includes("idiomatic-revoicing")) {
    candidates.push({
      ...economical,
      id: "candidate.idiomatic-revoicing",
      strategy: "idiomatic-revoicing",
      status: "survived",
      events: economical.events.map((event) => ({ ...event, positions: [...event.positions] })),
    });
  }
  if (candidates.length === 0) throw new Error("The Creative Plan permits no candidate strategy");
  const selected = candidates[0]!;
  selected.status = "selected";
  return {
    candidates,
    selected: {
      ...base.selected,
      id: options.arrangementId,
      selectedCandidateId: selected.id,
      events: selected.events,
      preservationAudit: selected.audit,
      createdAt: options.createdAt,
    },
  };
}

function addIdiomaticOrnament(
  events: ArrangementEvent[],
  model: InstrumentModel
): ArrangementEvent[] {
  let changed = false;
  const result = events.map((event) => {
    if (changed || event.type === "rest" || event.pitches.length === 0) return event;
    const principal = event.pitches.slice().sort((a, b) => noteToMidi(b) - noteToMidi(a))[0]!;
    for (const offset of [-2, -1]) {
      const pitch = transposeNote(principal, offset);
      const positions = model.positionsForPitch(pitch);
      for (const position of positions) {
        const ornament = { ...position, pitch };
        if (
          event.positions.some((existing) => existing.course === ornament.course) ||
          !model.isPlayable([...event.positions, ornament]).ok
        ) {
          continue;
        }
        changed = true;
        return {
          ...event,
          type: "chord" as const,
          pitches: [...event.pitches, pitch],
          positions: [...event.positions, ornament],
        };
      }
    }
    return event;
  });
  if (!changed) throw new Error("No playable generated ornament satisfies the Creative Plan");
  return result;
}
