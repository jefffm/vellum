import { noteToMidi } from "./pitch.js";
import type { AnalysisRecord, NormalizedScore, ScoreEvent, ScorePart } from "./music-domain.js";

export type AnalyzeMusicOptions = {
  id: string;
  createdAt: string;
};

export function analyzeMusicologicalScore(
  score: NormalizedScore,
  options: AnalyzeMusicOptions
): AnalysisRecord {
  const principal = selectPrincipalVoice(score);
  const principalEvents = score.events.filter(
    (event) => event.partId === principal.part.id && event.type === "note"
  );
  if (principalEvents.length === 0) {
    throw new Error(`Principal Voice candidate has no notes: ${principal.part.id}`);
  }

  return {
    id: options.id,
    normalizedScoreId: score.id,
    version: 1,
    texture: inferTexture(score),
    principalVoicePartId: principal.part.id,
    claims: [
      {
        id: `claim.${options.id.slice("analysis.".length)}.principal-voice`,
        kind: "principal_voice",
        subjectIds: [principal.part.id],
        statement: `${principal.part.name} carries the Principal Voice (${principal.reason}).`,
        basis: principal.basis,
        confidence: principal.confidence,
      },
      {
        id: `claim.${options.id.slice("analysis.".length)}.texture`,
        kind: "texture",
        subjectIds: score.parts.map((part) => part.id),
        statement: `The source texture is ${inferTexture(score)}.`,
        basis: "observation",
        confidence: 0.9,
      },
    ],
    preservationTargets: [
      {
        id: `target.${options.id.slice("analysis.".length)}.principal-voice`,
        kind: "principal_voice",
        partId: principal.part.id,
        eventIds: principalEvents.map((event) => event.id),
        rationale:
          "Faithful Reduction preserves every Principal Voice pitch, duration, order, phrase position, and perceptual prominence.",
      },
    ],
    createdAt: options.createdAt,
  };
}

type PrincipalSelection = {
  part: ScorePart;
  reason: string;
  basis: "observation" | "inference";
  confidence: number;
};

function selectPrincipalVoice(score: NormalizedScore): PrincipalSelection {
  const explicit = score.parts.find((part) => part.role === "principal_voice");
  if (explicit) {
    return {
      part: explicit,
      reason: "the source explicitly assigns the Principal Voice role",
      basis: "observation",
      confidence: 1,
    };
  }

  const soprano = score.parts.find(
    (part) => part.role === "soprano" || /\bsoprano\b/i.test(part.name)
  );
  if (soprano) {
    return {
      part: soprano,
      reason: "the labeled soprano presents the tune in this four-part setting",
      basis: "observation",
      confidence: 0.99,
    };
  }

  const ranked = score.parts
    .map((part) => ({ part, median: medianMidi(score.events, part.id) }))
    .filter((entry): entry is { part: ScorePart; median: number } => entry.median !== undefined)
    .sort((left, right) => right.median - left.median || left.part.id.localeCompare(right.part.id));
  if (ranked.length === 0) {
    throw new Error(
      "Normalized score contains no pitched voice suitable for Principal Voice inference"
    );
  }

  return {
    part: ranked[0]!.part,
    reason: "it has the highest median register among the available unlabeled voices",
    basis: "inference",
    confidence: ranked.length === 1 ? 0.8 : 0.65,
  };
}

function medianMidi(events: ScoreEvent[], partId: string): number | undefined {
  const values = events
    .flatMap((event) =>
      event.partId === partId && event.type === "note" ? [noteToMidi(event.pitch)] : []
    )
    .sort((left, right) => left - right);
  if (values.length === 0) return undefined;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[middle - 1]! + values[middle]!) / 2 : values[middle];
}

function inferTexture(score: NormalizedScore): string {
  if (score.parts.length === 1) return "monophonic";
  if (score.parts.length === 4 && score.parts.some((part) => part.role === "bass")) {
    return "homophonic-four-part";
  }
  return "polyphonic";
}
